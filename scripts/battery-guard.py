#!/usr/bin/python3
"""Root-owned gauge watchdog; never changes charge-control GPIOs."""
import json
import os
from pathlib import Path
import subprocess
import time
from battery import read_battery, read_external_power
from power_policy import ShutdownPolicy, valid

os.environ['KLINEKRAFT_BATTERY'] = 'x1202'
policy = ShutdownPolicy()
status = Path('/run/klinekraft-battery-guard.json')
while True:
    reading = read_battery()
    p, v = reading['battery_percent'], reading['battery_voltage']
    external = read_external_power()
    countdown = policy.update(p, v, time.monotonic(), external)
    data = {'sampledAt': time.time(), 'valid': valid(p, v), 'percent': p,
            'voltage': v, 'externalPower': external, 'shutdownSeconds': countdown,
            'policy': '8% with voltage <=3.60V, or voltage <=3.35V; sustained 30s plus 60s countdown'}
    temporary = status.with_suffix('.tmp')
    temporary.write_text(json.dumps(data)); temporary.chmod(0o644); temporary.replace(status)
    if countdown == 0:
        # Final independent reading; failures and recovery cancel shutdown.
        check = read_battery()
        if policy.update(check['battery_percent'], check['battery_voltage'], time.monotonic(), read_external_power()) == 0:
            subprocess.run(['/usr/bin/systemctl', 'poweroff'], check=True)
            break
    time.sleep(10)
