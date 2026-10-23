from pathlib import Path
from fastapi.testclient import TestClient
import pytest
from klinekraft.main import app
from klinekraft import local_content

HEADERS = {'X-Klinekraft-Client': 'local-ui'}


@pytest.fixture
def local(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, 'home', classmethod(lambda cls: tmp_path))
    docs = tmp_path / 'Documents'
    docs.mkdir()
    (docs / 'folder').mkdir()
    (docs / 'note.txt').write_text('hello Pi')
    (docs / '.private').write_text('hidden')
    (tmp_path / 'secret.txt').write_text('outside')
    (docs / 'link.txt').symlink_to(tmp_path / 'secret.txt')
    with TestClient(app, base_url='http://localhost') as client:
        yield client, docs


def test_list_and_download(local):
    client, _ = local
    response = client.get('/api/files', headers=HEADERS)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    assert [x['name'] for x in response.json()['entries']] == ['folder', 'note.txt']
    response = client.get('/api/files/download', params={'root': 'documents', 'path': 'note.txt'}, headers=HEADERS)
    assert response.content == b'hello Pi'
    assert response.headers['content-disposition'].startswith('attachment;')
    assert response.headers['x-content-type-options'] == 'nosniff'


@pytest.mark.parametrize('path', ['../secret.txt', '/etc/passwd', '.private', 'link.txt', 'folder/../../secret.txt'])
def test_path_boundaries(local, path):
    client, _ = local
    for endpoint in ['/api/files', '/api/files/download']:
        assert client.get(endpoint, params={'root': 'documents', 'path': path}, headers=HEADERS).status_code == 403


def test_browser_boundary_and_missing_paths(local):
    client, _ = local
    assert client.get('/api/files').status_code == 403
    assert client.get('/api/wiki').status_code == 403
    response = client.options('/api/files', headers={'Origin': 'https://unrelated.example', 'Access-Control-Request-Headers': 'x-klinekraft-client', 'Access-Control-Request-Method': 'GET'})
    assert 'access-control-allow-origin' not in response.headers
    assert client.get('/api/files', params={'root': 'unknown'}, headers=HEADERS).status_code == 404
    assert client.get('/api/files', params={'path': 'missing'}, headers=HEADERS).status_code == 404
    assert client.post('/api/files', headers=HEADERS).status_code == 405


def test_download_size_limit_and_empty_folder(local):
    client, docs = local
    with (docs / 'large.bin').open('wb') as file:
        file.truncate(local_content.MAX_DOWNLOAD + 1)
    assert client.get('/api/files/download', params={'root': 'documents', 'path': 'large.bin'}, headers=HEADERS).status_code == 413
    assert client.get('/api/files', params={'path': 'folder'}, headers=HEADERS).json()['entries'] == []


def test_root_symlink_is_rejected(local):
    client, docs = local
    (docs.parent / 'Downloads').symlink_to(docs, target_is_directory=True)
    assert client.get('/api/files', params={'root': 'downloads'}, headers=HEADERS).status_code == 403


def test_wiki_stopped_and_ready(local, monkeypatch):
    client, docs = local
    (docs / 'Wikipedia').mkdir()
    (docs / 'Wikipedia' / 'sample.zim').write_bytes(b'ZIM\x04')
    class Connection:
        def __init__(self, *args, **kwargs): pass
        def request(self, *args): pass
        def getresponse(self): return self
        status = 200
        def read(self, size): return b'<title>Kiwix</title>'
        def close(self): pass
    monkeypatch.setattr(local_content.http.client, 'HTTPConnection', Connection)
    data = client.get('/api/wiki', headers=HEADERS).json()
    assert data == {'ready': True, 'archives': ['sample.zim'], 'url': 'http://127.0.0.1:8081/'}
    Connection.status = 503
    assert client.get('/api/wiki', headers=HEADERS).json()['ready'] is False
    def unavailable(self, *args): raise OSError('offline')
    Connection.request = unavailable
    assert client.get('/api/wiki', headers=HEADERS).json()['url'] is None
