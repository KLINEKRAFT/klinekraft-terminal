import sys
from types import SimpleNamespace
import pytest
from klinekraft.battery import read_battery


def swapped(value):
    return ((value & 255) << 8) | (value >> 8)


def install_bus(monkeypatch, voltage=3.8, charge=75, error=None):
    reads = []
    class Bus:
        def __init__(self, bus):
            assert bus == 1
            if error: raise error
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read_word_data(self, address, register):
            assert address == 0x36
            reads.append(register)
            return swapped(round(voltage * 12800) if register == 2 else round(charge * 256))
    monkeypatch.setenv('KLINEKRAFT_BATTERY', 'x1202')
    monkeypatch.setitem(sys.modules, 'smbus2', SimpleNamespace(SMBus=Bus))
    return reads


def test_opt_in_only(monkeypatch):
    monkeypatch.delenv('KLINEKRAFT_BATTERY', raising=False)
    assert read_battery()['battery_status'] == 'Not configured'


def test_gauge_conversion_and_read_only(monkeypatch):
    reads = install_bus(monkeypatch)
    data = read_battery()
    assert reads == [2, 4]
    assert data['battery_percent'] == 75
    assert data['battery_voltage'] == 3.8
    assert data['battery_status'] == 'Estimated charge'


@pytest.mark.parametrize('error', [PermissionError(), OSError()])
def test_unavailable_clears_readings(monkeypatch, error):
    install_bus(monkeypatch, error=error)
    data = read_battery()
    assert data['battery_percent'] is None
    assert data['battery_voltage'] is None


def test_out_of_range_is_not_a_percentage(monkeypatch):
    install_bus(monkeypatch, charge=120)
    assert read_battery()['battery_status'] == 'Gauge reading out of range'
