"""Loopback-only service scaffold. No command execution or filesystem API."""
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .services import Capabilities, get_capabilities

app = FastAPI(title="Klinekraft Terminal", version="0.1.0")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "[::1]"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "foundation"}


@app.get("/api/capabilities", response_model=Capabilities)
def capabilities() -> Capabilities:
    return get_capabilities()


# Build once with npm; production needs no Vite server or external CDN.
dist = Path(__file__).resolve().parents[2] / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
