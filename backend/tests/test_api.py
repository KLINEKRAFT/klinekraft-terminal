from datetime import datetime, timezone

from fastapi.testclient import TestClient
import pytest

from klinekraft.main import app
from klinekraft.telemetry import HostSnapshot


@pytest.fixture
def client():
    with TestClient(app, base_url="http://localhost") as instance:
        yield instance


def test_capabilities_only_claim_implemented_services(client):
    data = client.get("/api/capabilities").json()
    assert data.pop("mode") == "host-telemetry"
    assert data.pop("system_telemetry") is True
    assert all(value is False for value in data.values())


def test_unknown_host_is_rejected(client):
    assert client.get("/api/system", headers={"Host": "untrusted.example"}).status_code == 400


def test_no_command_execution_endpoint(client):
    assert client.post("/api/command", json={"command": "echo test"}).status_code in (404, 405)


def test_system_contract_and_no_cache(client):
    app.state.telemetry.snapshot = HostSnapshot(sampled_at=datetime.now(timezone.utc), system="macOS", architecture="arm64", cpu=25)
    response = client.get("/api/system")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    data = response.json()
    assert data["source"] == "host"
    assert data["cpu"] == 25
    assert data["temperature"] is None
    assert data["memoryUsed"] is None
    assert data["sampledAt"]
    assert data["stale"] is False


def test_sampler_unavailable_is_not_a_fake_snapshot(client):
    app.state.telemetry.snapshot = None
    assert client.get("/api/system").status_code == 503
