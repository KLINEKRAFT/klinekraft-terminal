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
                ["systemctl", "--user", "show", name, "--property=ActiveState,SubState,Result,ExecMainStatus,ExecMainCode,NRestarts,StateChangeTimestamp"],
                capture_output=True, text=True, timeout=3, check=True,
            )
            state = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
            explanations = {
                "exit-code": "A service process exited with an error code.",
                "signal": "A service process was terminated by a signal.",
                "core-dump": "A service process crashed and generated a core dump.",
                "timeout": "A service operation exceeded its configured time limit.",
                "oom-kill": "The service was terminated because of memory pressure.",
                "start-limit-hit": "Repeated start failures reached the service restart limit.",
            }
            state["explanation"] = explanations.get(state.get("Result"), "No recorded service failure." if state.get("Result") == "success" else "Failure cause unavailable.")
            services[name] = state
        except (OSError, subprocess.SubprocessError):
            services[name] = {"status": "unavailable"}
    return {"measurements": snapshot, "units": {"temperature": "Celsius", "memory": "GB", "storage": "GB",
            "batteryVoltage": "volts", "cpu": "percent"}, "services": services}


@router.get("")
def read(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return collect()
