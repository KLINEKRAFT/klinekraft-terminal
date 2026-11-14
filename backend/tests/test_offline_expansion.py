import json
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from klinekraft import assistant, research, mesh, field_library
from klinekraft.conversations import database


def test_field_library_cannot_read_private_content(tmp_path,monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR',str(tmp_path))
    with database() as c:
        research.init(c)
        for collection,name in [('Private','SECRET NOTE'),('Emergency - Test','Public guide')]:
            c.execute('INSERT INTO research_files(collection,name,mime,digest,extracted) VALUES(?,?,?,?,?)',(collection,name,'text/plain',name,name))
    research.files_root().mkdir()
    (research.files_root()/'Public guide').write_text('Public guide')
    client=TestClient(field_library.app)
    assert 'SECRET' not in client.get('/').text
    assert client.get('/documents/1').status_code==404
    assert client.get('/documents/2').text=='Public guide'
    assert client.post('/api/ai/ask',json={'question':'hello'}).status_code==404
    assert 'SECRET NOTE' not in client.get('/?q=SECRET').text
    assert '<script>alert' not in client.get('/?q=<script>alert(1)</script>').text


def test_offline_request_never_falls_back_to_cloud(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    def unavailable(messages,key,local=False):
        assert local and key==''
        raise HTTPException(503,'offline service unavailable')
    monkeypatch.setattr(assistant,'ask_provider',unavailable)
    with pytest.raises(HTTPException) as exc:
        assistant.ask(assistant.Question(provider='local',question='hello',use_wiki=False))
    assert exc.value.status_code==503


def test_mesh_requires_radio_and_bounds_bytes(monkeypatch):
    monkeypatch.setattr(mesh,'connected',False)
    with pytest.raises(HTTPException) as exc:mesh.send(mesh.Message(text='hello'))
    assert exc.value.status_code==503
    with pytest.raises(HTTPException) as exc:mesh.send(mesh.Message(text='😀'*60))
    assert exc.value.status_code==400


def test_local_payload_stays_on_loopback(monkeypatch):
    monkeypatch.setattr(assistant,'local_key',lambda:'local-test')
    class Response:
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def read(self,n):return json.dumps({'choices':[{'finish_reason':'stop','message':{'content':'Local answer'}}]}).encode()
    class Opener:
        def open(self,request,timeout):
            assert request.full_url=='http://127.0.0.1:8082/v1/chat/completions'
            assert request.headers['Authorization']=='Bearer local-test'
            assert timeout==240
            return Response()
    monkeypatch.setattr(assistant.urllib.request,'build_opener',lambda *args:Opener())
    assert assistant.ask_provider([{'role':'user','content':'hello'}],'',local=True)['answer']=='Local answer'


def test_route_saves_and_restores_without_external_destination(tmp_path,monkeypatch):
    from klinekraft import routing
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR',str(tmp_path))
    route={'type':'FeatureCollection','features':[{'type':'Feature','geometry':{'type':'LineString','coordinates':[[-96,36],[-95,36]]},'properties':{'track-length':'100'}}]}
    class Response:
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def read(self,n):return json.dumps(route).encode()
    class Opener:
        def open(self,request,timeout):
            assert request.full_url.startswith('http://127.0.0.1:17777/brouter?')
            return Response()
    monkeypatch.setattr(routing.urllib.request,'build_opener',lambda *a:Opener())
    request=routing.Route(start=routing.Point(longitude=-96,latitude=36),end=routing.Point(longitude=-95,latitude=36))
    assert routing.route(request)==route
    saved=routing.saved()
    assert len(saved)==1 and routing.saved_route(saved[0]['id'])==route


def test_mesh_cannot_open_arbitrary_paths(monkeypatch):
    monkeypatch.setattr(mesh,'ports',lambda:[])
    with pytest.raises(HTTPException) as exc:mesh.connect(mesh.Connect(port='/etc/passwd'))
    assert exc.value.status_code==400


def test_reference_mode_quotes_source_without_model_call(tmp_path,monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR',str(tmp_path))
    with database() as c:
        research.init(c)
        c.execute('INSERT INTO research_files(collection,name,mime,digest,extracted) VALUES(?,?,?,?,?)',('Emergency - Power','Generator safety','text/plain','test','Never run a generator inside a garage.'))
    def forbidden(*a,**kw):raise AssertionError('Reference mode must not call an AI provider')
    monkeypatch.setattr(assistant,'ask_provider',forbidden)
    result=assistant.ask(assistant.Question(provider='local',reference_only=True,question='generator garage',use_research=True,use_wiki=False))
    assert 'Never run a generator inside a garage.' in result['answer']
    assert result['sources'][0]['fileId']==1
    assert result['model']=='Local reference search'
