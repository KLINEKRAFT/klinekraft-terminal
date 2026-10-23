"""Read-only host telemetry. Optional X1202 gauge; no shell commands or network probes."""
import asyncio
from contextlib import suppress
from datetime import datetime, timezone
import logging
import math
from pathlib import Path
import platform
from typing import Literal

from .battery import read_battery

import psutil
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

log = logging.getLogger(__name__)


class WireModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, allow_inf_nan=False)


class NetworkInterface(WireModel):
    name: str
    is_up: bool


class HostSnapshot(WireModel):
    source: Literal["host"] = "host"
    sampled_at: datetime
    stale: bool = False
    system: str
    architecture: str
    cpu: float | None = Field(default=None, ge=0, le=100)
    cpu_cores: int | None = None
    memory_used: float | None = None
    memory_total: float | None = None
    storage_used: float | None = None
    storage_total: float | None = None
    temperature: float | None = None
    interfaces: list[NetworkInterface] | None = None
    battery_percent: float | None = Field(default=None, ge=0, le=100)
    battery_voltage: float | None = None
    battery_status: str = "Not configured"


def number(value: float | None) -> float | None:
    return round(value, 2) if value is not None and math.isfinite(value) else None


def cpu_temperature() -> float | None:
    """Use recognized CPU sensors only; never substitute disk/GPU temperature."""
    sensors = getattr(psutil, "sensors_temperatures", None)
    if not sensors:
        return None  # Expected on macOS, without a privileged extra driver.
    readings = sensors()
    candidates = [entry.current for key, entries in readings.items()
                  if key.lower() in {"cpu_thermal", "cpu-thermal", "coretemp", "k10temp"}
                  for entry in entries if entry.current is not None
                  and math.isfinite(entry.current) and -20 <= entry.current <= 150]
    return number(max(candidates)) if candidates else None


def collect_snapshot() -> HostSnapshot:
    """Run in a worker, not a request handler. Individual failures become null."""
    data: dict = {"system": "macOS" if platform.system() == "Darwin" else platform.system(),
                  "architecture": platform.machine()}
    # Independent reads mean a missing sensor cannot suppress memory or storage.
    operations = {
        "battery": read_battery,
        "cpu": lambda: {"cpu": number(psutil.cpu_percent(interval=0.1)), "cpu_cores": psutil.cpu_count()},
        "memory": lambda: _memory(),
        "storage": lambda: _storage(),
        "temperature": lambda: {"temperature": cpu_temperature()},
        "interfaces": lambda: {"interfaces": [NetworkInterface(name=name, is_up=stats.isup)
                         for name, stats in sorted(psutil.net_if_stats().items())
                         if name not in {"lo", "lo0"}]},
    }
    for name, operation in operations.items():
        try:
            data.update(operation())
        except (OSError, psutil.Error, NotImplementedError, AttributeError, ValueError):
            log.debug("Telemetry unavailable: %s", name)
    return HostSnapshot(sampled_at=datetime.now(timezone.utc), **data)


def _memory() -> dict:
    memory = psutil.virtual_memory()
    # Used excludes reclaimable/available memory; units are decimal GB.
    return {"memory_used": number((memory.total - memory.available) / 1e9),
            "memory_total": number(memory.total / 1e9)}


def _storage() -> dict:
    disk = psutil.disk_usage(Path.cwd().anchor)
    return {"storage_used": number(disk.used / 1e9), "storage_total": number(disk.total / 1e9)}


class TelemetryService:
    """One bounded polling loop per process; requests read the cached snapshot."""
    def __init__(self):
        self.snapshot: HostSnapshot | None = None
        self.task: asyncio.Task | None = None

    async def _sample(self):
        try:
            self.snapshot = await asyncio.to_thread(collect_snapshot)
        except Exception:
            # Keep the old timestamp so failed sampling never looks fresh.
            log.exception("Host telemetry sampling failed")

    async def start(self):
        await self._sample()
        self.task = asyncio.create_task(self._run())

    async def _run(self):
        while True:
            await asyncio.sleep(3)
            await self._sample()

    async def stop(self):
        if self.task:
            self.task.cancel()
            with suppress(asyncio.CancelledError):
                await self.task

    def read(self) -> HostSnapshot | None:
        if self.snapshot is None:
            return None
        age = (datetime.now(timezone.utc) - self.snapshot.sampled_at).total_seconds()
        return self.snapshot.model_copy(update={"stale": age > 10})
