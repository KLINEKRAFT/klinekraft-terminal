import json
from fastapi.testclient import TestClient
from klinekraft.main import app
from klinekraft import assistant

client = TestClient(app, base_url="http://127.0.0.1")
HEADERS = {"X-Klinekraft-Client": "local-ui"}


def test_diagnostics_require_opt_in(monkeypatch):
    calls = []
    monkeypatch.setenv("OPENAI_API_KEY", "test-only")
    monkeypatch.setattr(assistant.diagnostics, "collect", lambda: {"sample": 42})
    def provider(messages, key):
        calls.append(json.loads(messages[-1]["content"])["piDiagnostics"])
        return {"answer": "Test", "sources": [], "imageSources": []}
    monkeypatch.setattr(assistant, "ask_provider", provider)
    for enabled in (False, True):
        response = client.post("/api/ai/ask", headers=HEADERS, json={
            "question": "How is my Pi?", "use_wiki": False, "use_diagnostics": enabled,
        })
        assert response.status_code == 200
    assert calls == [None, {"sample": 42}]
    assert client.get("/api/diagnostics").status_code == 403
