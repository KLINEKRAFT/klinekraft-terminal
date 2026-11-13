"""Bounded read-only Pi measurements and fixed service status queries."""
import subprocess
from fastapi import APIRouter, Depends, Response
from .local_content import local_request
from .telemetry import collect_snapshot

router = APIRouter(prefix="/api/diagnostics", dependencies=[Depends(local_request)])
SERVICES = ("klinekraft.service", "klinekraft-wiki.service")


def collect():
    snapshot = collect_snapshot().model_dump(mode="json", by_alias=True)
    snapshot.pop("interfaces", None)
    services = {}
    for name in SERVICES:
        try:
            result = subprocess.run(
                ["systemctl", "--user", "show", name, "--property=ActiveState,SubState,Result,ExecMainStatus"],
                capture_output=True, text=True, timeout=3, check=True,
            )
            services[name] = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
        except (OSError, subprocess.SubprocessError):
            services[name] = {"status": "unavailable"}
    return {"measurements": snapshot, "units": {"temperature": "Celsius", "memory": "GB", "storage": "GB",
            "batteryVoltage": "volts", "cpu": "percent"}, "services": services}


@router.get("")
def read(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return collect()
