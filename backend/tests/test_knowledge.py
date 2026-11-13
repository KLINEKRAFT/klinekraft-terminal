import json
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from klinekraft.main import app
from klinekraft import wiki_reader as wiki, assistant as ai

client = TestClient(app, base_url="http://127.0.0.1")
HEADERS = {"X-Klinekraft-Client": "local-ui"}
ARTICLE = {"title": "Moon", "path": "/content/wikipedia_en/Moon", "original": None,
           "blocks": [{"kind": "p", "text": "The Moon orbits Earth."}],
           "images": [{"path": "/content/wikipedia_en/moon.jpg", "caption": "Moon"}]}

@pytest.mark.parametrize("path", ["https://example.com/a", "//localhost:9000/x", "/etc/passwd", "/content/x/%2e%2e/a", "/content/x/%252e%252e/a"])
def test_reject_non_archive_paths(path):
    with pytest.raises(HTTPException):
        wiki.content_path(path)

def test_catalog_search_and_safe_article(monkeypatch):
    def fetch(path, **kwargs):
        if path.startswith("/catalog"):
            return b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Wikipedia</title><link type="text/html" href="/content/wikipedia_en"/></entry></feed>', "application/atom+xml", path
        if path.startswith("/search"):
            assert "books.name=wikipedia_en" in path
            return b'<rss><channel><item><title>Moon</title><link>/content/wikipedia_en/Moon</link><description>Our &lt;b&gt;Moon&lt;/b&gt;</description></item></channel></rss>', "text/xml", path
        return b'<html><h1>Moon</h1><main><script>bad()</script><p>The Moon orbits Earth.</p><figure><img src="moon.jpg" width="300" height="300"><figcaption>Moon</figcaption></figure><img src="https://evil.test/x"><a href="Earth">Earth</a></main></html>', "text/html", path
    monkeypatch.setattr(wiki, "fetch_local", fetch)
    assert wiki.search("moon")[0]["snippet"] == "Our Moon"
    article = wiki.article(ARTICLE["path"])
    assert article["blocks"] == ARTICLE["blocks"]
    assert article["images"] == ARTICLE["images"]
    assert article["links"][0]["path"] == "/content/wikipedia_en/Earth"

def test_local_guard_and_key_status(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "secret")
    assert client.get("/api/ai/status").status_code == 403
    response = client.get("/api/ai/status", headers=HEADERS)
    assert response.json()["configured"]
    assert "secret" not in response.text
    monkeypatch.delenv("OPENAI_API_KEY")
    assert client.post("/api/ai/ask", headers=HEADERS, json={"question": "Moon?"}).status_code == 503

def test_sources_and_images_must_exist_in_retrieval(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "secret")
    monkeypatch.setattr(wiki, "article", lambda path: ARTICLE)
    def provider(messages, key):
        assert key == "secret"
        assert "The Moon orbits Earth" in messages[-1]["content"]
        return {"answer": "It orbits Earth [1]. Invented [99].", "sources": [1, 99], "imageSources": [99, 1, 1]}
    monkeypatch.setattr(ai, "ask_provider", provider)
    response = client.post("/api/ai/ask", headers=HEADERS, json={"question": "Explain", "article_path": ARTICLE["path"]})
    assert response.status_code == 200
    data = response.json()
    assert [s["id"] for s in data["sources"]] == [1]
    assert len(data["images"]) == 1
    assert "[99]" not in data["answer"]
    assert not ai.busy.locked()

def test_offline_cloud_failure_releases_lock(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "secret")
    def fail(*args): raise HTTPException(503, "Cloud unreachable")
    monkeypatch.setattr(ai, "ask_provider", fail)
    response = client.post("/api/ai/ask", headers=HEADERS, json={"question": "Hello", "use_wiki": False})
    assert response.status_code == 503
    assert not ai.busy.locked()

def test_image_rejects_active_content(monkeypatch):
    monkeypatch.setattr(wiki, "fetch_local", lambda *a, **k: (b"<svg/>", "image/svg+xml", "/content/x/a"))
    assert client.get("/api/wiki/image", params={"path": "/content/x/a"}, headers=HEADERS).status_code == 415

def test_provider_contract(monkeypatch):
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self, count):
            return json.dumps({"choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"answer": "Hello", "sources": [], "imageSources": []})}}]}).encode()
    class Opener:
        def open(self, request, timeout):
            payload = json.loads(request.data)
            assert request.full_url == "https://api.openai.com/v1/chat/completions"
            assert payload["response_format"]["json_schema"]["strict"]
            assert payload["store"] is False
            return Response()
    monkeypatch.setattr(ai.urllib.request, "build_opener", lambda *a: Opener())
    assert ai.ask_provider([], "test")["answer"] == "Hello"
