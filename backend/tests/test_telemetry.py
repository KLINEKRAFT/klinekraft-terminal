from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from klinekraft import telemetry


def test_sensor_failure_does_not_hide_other_readings(monkeypatch):
    monkeypatch.setattr(telemetry.psutil, "sensors_temperatures", lambda: (_ for _ in ()).throw(OSError()), raising=False)
    monkeypatch.setattr(telemetry.psutil, "virtual_memory", lambda: SimpleNamespace(total=8e9, available=6e9))
    monkeypatch.setattr(telemetry.psutil, "disk_usage", lambda _: SimpleNamespace(total=128e9, used=32e9))
    monkeypatch.setattr(telemetry.psutil, "cpu_percent", lambda interval: 25)
    monkeypatch.setattr(telemetry.psutil, "cpu_count", lambda: 4)
    monkeypatch.setattr(telemetry.psutil, "net_if_stats", lambda: {"lo0": SimpleNamespace(isup=True), "en0": SimpleNamespace(isup=False)})
    data = telemetry.collect_snapshot()
    assert data.temperature is None
    assert (data.memory_used, data.memory_total) == (2, 8)
    assert (data.storage_used, data.storage_total) == (32, 128)
    assert data.cpu == 25
    assert [(i.name, i.is_up) for i in data.interfaces] == [("en0", False)]


def test_disk_temperature_is_not_cpu_temperature(monkeypatch):
    monkeypatch.setattr(telemetry.psutil, "sensors_temperatures", lambda: {"nvme": [SimpleNamespace(current=52)]}, raising=False)
    assert telemetry.cpu_temperature() is None
    monkeypatch.setattr(telemetry.psutil, "sensors_temperatures", lambda: {"cpu_thermal": [SimpleNamespace(current=43.2)], "nvme": [SimpleNamespace(current=90)]})
    assert telemetry.cpu_temperature() == 43.2


def test_missing_macos_temperature_and_network_failure(monkeypatch):
    monkeypatch.delattr(telemetry.psutil, "sensors_temperatures", raising=False)
    monkeypatch.setattr(telemetry.psutil, "net_if_stats", lambda: (_ for _ in ()).throw(PermissionError()))
    data = telemetry.collect_snapshot()
    assert data.temperature is None
    assert data.interfaces is None


def test_old_snapshot_is_stale_without_changing_its_timestamp():
    service = telemetry.TelemetryService()
    sampled_at = datetime.now(timezone.utc) - timedelta(seconds=20)
    service.snapshot = telemetry.HostSnapshot(sampled_at=sampled_at, system="Linux", architecture="aarch64", cpu=10)
    assert service.read().stale is True
    assert service.read().sampled_at == sampled_at
    assert service.snapshot.stale is False
