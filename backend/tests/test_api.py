from fastapi.testclient import TestClient
from klinekraft.main import app

client = TestClient(app, base_url="http://localhost")


def test_capabilities_do_not_claim_hardware():
    response = client.get("/api/capabilities")
    assert response.status_code == 200
    data = response.json()
    assert data.pop("mode") == "foundation"
    assert all(value is False for value in data.values())


def test_unknown_host_is_rejected():
    assert client.get("/api/health", headers={"Host": "untrusted.example"}).status_code == 400


def test_no_command_execution_endpoint():
    assert client.post("/api/command", json={"command": "echo test"}).status_code in (404, 405)
