"""Loopback-only telemetry service. Read-only files and an allowlisted game launcher."""
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .local_content import router as local_content_router
from .games import router as games_router
from .tools_launcher import router as tools_router
from .services import Capabilities, get_capabilities
from .telemetry import HostSnapshot, TelemetryService


@asynccontextmanager
async def lifespan(app: FastAPI):
    service = TelemetryService()
    app.state.telemetry = service
    await service.start()
    try:
        yield
    finally:
        await service.stop()


app = FastAPI(title="Klinekraft Terminal", version="0.2.0", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "[::1]"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "host-telemetry"}


@app.get("/api/capabilities", response_model=Capabilities)
def capabilities() -> Capabilities:
    return get_capabilities()


@app.get("/api/system", response_model=HostSnapshot)
def system_status(request: Request, response: Response) -> HostSnapshot:
    response.headers["Cache-Control"] = "no-store"
    snapshot = request.app.state.telemetry.read()
    if snapshot is None:
        raise HTTPException(status_code=503, detail="Host telemetry is not available yet")
    return snapshot


app.include_router(local_content_router)
app.include_router(games_router)
app.include_router(tools_router)


# Build once with npm; production needs no Vite server or external CDN.
dist = Path(__file__).resolve().parents[2] / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
