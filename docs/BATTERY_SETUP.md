# Geekworm X1202 battery readings

This adapter is for the confirmed X1202 board. It reads SMBus bus 1, address 0x36, voltage register 0x02 and estimated state-of-charge register 0x04. It independently implements the register conversions documented in [Geekworm's sample](https://github.com/geekworm-com/x120x/blob/f58209896a642ec613920e02992c2761b4a4e9d6/bat.py). The vendor sample itself is not installed or run.

On your Pi, after updating the project:

```bash
cd ~/klinekraft-terminal
bash scripts/setup-battery.sh
sudo reboot
```

The script enables I2C using raspi-config if needed and available, installs i2c-tools and the optional smbus2 dependency, adds your user to the i2c group, and sets `KLINEKRAFT_BATTERY=x1202` in a user-service drop-in. The web service continues to run as your normal user. Reboot activates new group membership and any boot configuration changes. If raspi-config is unavailable, setup stops with instructions instead of guessing a boot configuration.

Choose **Settings → Dashboard data → Live computer**. Home shows percentage and voltage, with an estimated label; System gives the same readings and failure status. The gauge is polled with the regular three-second sampler. Failure clears the battery values on the next sample. A failed whole-service poll retains the existing stale-readings indication.

No automatic shutdown, charging control, cell balancing, runtime estimate, charging/discharging detection or battery-health claim is implemented. Percentage is a gauge estimate, not a calibrated capacity measurement. Out-of-range readings are shown as unavailable; no synthetic battery values are substituted. This is telemetry, not a replacement for board protection.

After reboot, if readings are missing:

```bash
id
ls -l /dev/i2c-1
cd ~/klinekraft-terminal
KLINEKRAFT_BATTERY=x1202 .venv/bin/python -c 'from klinekraft.battery import read_battery; print(read_battery())'
```

Do not run the web service as root. Diagnose wiring/board revision and gauge availability if bus access is correct but the gauge is unavailable. The adapter has unit coverage with mocked bus data; physical readings must be verified on the user's Pi.
