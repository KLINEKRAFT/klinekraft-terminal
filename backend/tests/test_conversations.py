from uuid import uuid4
from fastapi.testclient import TestClient
import pytest
from klinekraft.main import app
from klinekraft import conversations as chats

HEAD = {"X-Klinekraft-Client": "local-ui"}
DATA = {"revision":0,"title":"Moon notes","turns":[{"question":"Explain lunar craters","answer":"Impacts.","sources":[],"images":[]}]}

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv("KLINEKRAFT_DATA_DIR",str(tmp_path/"private"))
    return TestClient(app,base_url="http://127.0.0.1",headers=HEAD)

def test_save_survives_new_client_search_rename_export_delete(client):
    path="/api/conversations/"+str(uuid4())
    assert client.put(path,json=DATA).json()["revision"]==1
    other=TestClient(app,base_url="http://127.0.0.1",headers=HEAD)
    chat=other.get(path).json()
    assert chat["turns"][0]["answer"]=="Impacts."
    assert chats.db_path().stat().st_mode & 0o777 == 0o600
    assert other.get("/api/conversations?q=craters").json()["chats"][0]["title"]=="Moon notes"
    chat["title"]="Astronomy"
    assert other.put(path,json=chat).json()["revision"]==2
    backup=other.get("/api/conversations/export").json()
    assert backup["chats"][0]["title"]=="Astronomy"
    assert other.delete(path+"?revision=1").status_code==409
    assert other.delete(path+"?revision=2").status_code==200
    assert other.get(path).status_code==404
    assert other.put(path,json=chat).status_code==409

def test_conflict_does_not_overwrite(client):
    path="/api/conversations/"+str(uuid4())
    client.put(path,json=DATA)
    assert client.put(path,json={**DATA,"title":"Stale"}).status_code==409
    assert client.get(path).json()["title"]=="Moon notes"

def test_guard_validation_and_literal_search(client):
    assert client.get("/api/conversations",headers={"X-Klinekraft-Client":""}).status_code==403
    assert client.get("/api/conversations/not-a-uuid").status_code==422
    assert client.put("/api/conversations/"+str(uuid4()),json={**DATA,"turns":DATA["turns"]*201}).status_code==422
    assert client.get("/api/conversations?q=%27%20OR%201=1").json()["chats"]==[]

def test_storage_failure_is_explicit(client,monkeypatch,tmp_path):
    bad=tmp_path/"file";bad.write_text("not a directory")
    monkeypatch.setenv("KLINEKRAFT_DATA_DIR",str(bad))
    response=client.put("/api/conversations/"+str(uuid4()),json=DATA)
    assert response.status_code==503
    assert "storage is unavailable" in response.json()["detail"]
