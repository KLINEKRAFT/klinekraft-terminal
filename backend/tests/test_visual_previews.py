import hashlib
from PIL import Image
from fastapi.testclient import TestClient
from klinekraft.main import app
from klinekraft import research,games
from klinekraft.conversations import database


def test_pdf_preview_is_private_rendered_and_cached(tmp_path,monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR',str(tmp_path))
    source=tmp_path/'test.pdf'
    Image.new('RGB',(100,140),'white').save(source,'PDF')
    data=source.read_bytes();digest=hashlib.sha256(data).hexdigest()
    research.files_root().mkdir(exist_ok=True)
    (research.files_root()/digest).write_bytes(data)
    with database() as c:
        research.init(c)
        row=c.execute('INSERT INTO research_files(collection,name,mime,digest,extracted) VALUES(?,?,?,?,?)',('Test','test.pdf','application/pdf',digest,'test'))
        id=row.lastrowid
    client=TestClient(app,base_url='http://127.0.0.1')
    url=f'/api/research/{id}/thumbnail'
    assert client.get(url).status_code==403
    result=client.get(url,headers={'X-Klinekraft-Client':'local-ui'})
    assert result.status_code==200 and result.content.startswith(b'\xff\xd8')
    monkeypatch.setattr(research.subprocess,'run',lambda *a,**k: (_ for _ in ()).throw(AssertionError('cached preview rerendered')))
    assert client.get(url,headers={'X-Klinekraft-Client':'local-ui'}).content==result.content


def test_artwork_cannot_follow_link_outside_cache(tmp_path,monkeypatch):
    monkeypatch.setattr(games,'library_root',lambda:tmp_path)
    cache=tmp_path/'artwork';cache.mkdir()
    outside=tmp_path/'private.jpg';outside.write_bytes(b'private')
    (cache/('a'*64+'.jpg')).symlink_to(outside)
    client=TestClient(app,base_url='http://127.0.0.1',headers={'X-Klinekraft-Client':'local-ui'})
    assert client.get('/api/games/'+'a'*64+'/artwork').status_code==404
