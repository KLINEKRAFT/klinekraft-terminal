"""Browser test backend: real SQLite routes, fake AI provider, disposable data."""
import os
import tempfile
import uvicorn
from klinekraft import assistant
from klinekraft.main import app

assistant.ask_provider = lambda messages, key: {"answer": "Saved answer from the fixture.", "sources": [], "imageSources": []}
with tempfile.TemporaryDirectory(prefix="klinekraft-chat-") as directory:
    os.environ["KLINEKRAFT_DATA_DIR"] = directory
    os.environ["OPENAI_API_KEY"] = "fixture-not-a-real-key"
    uvicorn.run(app, host="127.0.0.1", port=8015)
