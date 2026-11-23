"""Loopback-only Terminal service with guarded local controls."""
import asyncio
from contextlib import suppress
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .local_content import router as local_content_router, local_request
from .games import router as games_router
from .wiki_reader import router as wiki_reader_router
from .assistant import router as assistant_router
from .tools_launcher import router as tools_router
from .conversations import router as conversations_router, database
from . import research, trips, voice
from .audio import router as audio_router
from .radio import router as radio_router
from .speech import router as speech_router
from .research import router as research_router
from .diagnostics import router as diagnostics_router
from .notebook import router as notebook_router
from .organizer import router as organizer_router
from .mesh import router as mesh_router
from .hotspot import router as hotspot_router
from .casting import router as casting_router
from . import power, desktop_away, briefing
from .routing import router as routing_router
from .maps import router as maps_router
from .emergency import router as emergency_router
from .services import Capabilities, get_capabilities
from .telemetry import HostSnapshot, TelemetryService


@asynccontextmanager
async def lifespan(app: FastAPI):
    with database() as connection:
        research.init(connection)
    voice.companion.start()
    trips.interrupt()
    trip_task = asyncio.create_task(trips.monitor())
    service = TelemetryService()
    app.state.telemetry = service
    await service.start()
    power_task = asyncio.create_task(power.monitor())
    briefing_task = asyncio.create_task(briefing.monitor())
    try:
        yield
    finally:
        voice.companion.close()
        trip_task.cancel()
        with suppress(asyncio.CancelledError):
            await trip_task
        trips.interrupt()
        briefing_task.cancel()
        with suppress(asyncio.CancelledError):
            await briefing_task
        power_task.cancel()
        with suppress(asyncio.CancelledError):
            await power_task
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


@app.get("/api/processes", dependencies=[Depends(local_request)])
def processes(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    service = request.app.state.telemetry
    snapshot = service.read()
    return {"sampledAt": snapshot.sampled_at if snapshot else None,
            "stale": snapshot.stale if snapshot else True, "processes": service.processes}


app.include_router(local_content_router)
app.include_router(games_router)
app.include_router(wiki_reader_router)
app.include_router(assistant_router)
app.include_router(conversations_router)
app.include_router(research_router)
app.include_router(notebook_router)
app.include_router(organizer_router)
app.include_router(maps_router)
app.include_router(trips.router)
app.include_router(audio_router)
app.include_router(radio_router)
app.include_router(speech_router)
app.include_router(voice.router)
app.include_router(routing_router)
app.include_router(mesh_router)
app.include_router(hotspot_router)
app.include_router(casting_router)
app.include_router(power.router)
app.include_router(desktop_away.router)
app.include_router(emergency_router)
app.include_router(briefing.router)
app.include_router(diagnostics_router)
app.include_router(tools_router)


# Build once with npm; production needs no Vite server or external CDN.
dist = Path(__file__).resolve().parents[2] / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
