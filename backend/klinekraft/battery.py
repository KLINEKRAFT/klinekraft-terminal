"""Opt-in, read-only X1202 gauge readings. Never controls power or charging.

Register units documented by Geekworm x120x/bat.py at
f58209896a642ec613920e02992c2761b4a4e9d6; independently implemented.
"""
import os


def read_battery() -> dict:
    result = {'battery_percent': None, 'battery_voltage': None,
              'battery_status': 'Not configured'}
    if os.environ.get('KLINEKRAFT_BATTERY') != 'x1202':
        return result
    try:
        from smbus2 import SMBus
        with SMBus(1) as bus:
            # The gauge stores big-endian words; SMBus returns little-endian.
            voltage_word = bus.read_word_data(0x36, 0x02)
            charge_word = bus.read_word_data(0x36, 0x04)
        voltage = ((voltage_word & 255) * 256 + (voltage_word >> 8)) / 12800
        charge = ((charge_word & 255) * 256 + (charge_word >> 8)) / 256
        if not (2.5 <= voltage <= 4.5 and 0 <= charge <= 100):
            result['battery_status'] = 'Gauge reading out of range'
            return result
        result.update(battery_percent=round(charge, 1), battery_voltage=round(voltage, 3),
                      battery_status='Estimated charge')
    except ImportError:
        result['battery_status'] = 'Battery driver not installed'
    except PermissionError:
        result['battery_status'] = 'I2C permission required; log in again after setup'
    except (OSError, ValueError):
        result['battery_status'] = 'X1202 gauge unavailable on I2C bus 1'
    return result
