# Hardware integration assessment

Target: Raspberry Pi 5, Raspberry Pi OS 64-bit Desktop, ELECROW 1024×600 touch display, Geekworm X1202 with compatible 21700 cells, USB GPS, 128GB microSD. No hardware was attached during this iteration. The 8GB RAM and 119.2GB storage dashboard values are fixtures, not a discovery of the user's board.

## Geekworm X1202 findings

The vendor repository is [geekworm-com/x120x](https://github.com/geekworm-com/x120x), not `geekworm-com/x1202`. Inspected `bat.py` at commit `f58209896a642ec613920e02992c2761b4a4e9d6`, which explicitly names X1200, X1201 and X1202 support.

[Vendor battery sample](https://github.com/geekworm-com/x120x/blob/f58209896a642ec613920e02992c2761b4a4e9d6/bat.py) reads SMBus bus 1, address 0x36, register 2 for voltage and register 4 for state-of-charge. The sample byte-swaps the returned words; voltage conversion is `raw × 1.25 / 1000 / 16`, charge estimate is `raw / 256`. This documents an available vendor interface, not a verified calibration on this device. No current measurement, time remaining, cycle count or battery health API was established. Do not infer those values from Pi PMIC readings.

The vendor sample also contains automatic shutdown. It was inspected only, never executed or copied. There is no clear root license in the inspected repository. Use it as a hardware reference pending licensing clarification, not reusable source. The actual board revision, bus availability, gauge calibration and any power-loss GPIO behavior require confirmation against vendor documentation and bench measurements. Links in the vendor code reference [X1202 v1.1 documentation](http://suptronics.com/Raspberrypi/Power_mgmt/x1202-v1.1.html); that external page has not been verified here.

The optional read-only adapter now exposes validated voltage and estimated charge, with sample age and explicit estimated wording. See [X1202 setup](BATTERY_SETUP.md). Without setup or a working gauge the UI reports battery unavailable. If percentage proves unreliable, omit it and display voltage only. Handle I2C errors, no device and implausible readings without changing the machine's power state.

## Deployment validation

1. Confirm board revision, RAM, display connection/rotation and actual usable storage.
2. Confirm compatible cells and power supply using vendor specifications; do not treat UI thresholds as battery protection.
3. Verify read-only CPU/memory/storage via psutil; temperature via available Linux sensors. Record unavailable sensors explicitly.
4. Check GPIO/I2C permissions using least privilege. Never run the whole web application as root.
5. Discover GPS with stable `/dev/serial/by-id` names, then test fix acquisition, signal loss and unplug/replug.
6. Measure idle/active temperature and throttling inside the case; avoid assuming enclosed thermal performance.
7. Test power interruption and graceful shutdown only after vendor guidance is validated. Shutdown policy belongs in a separate, deliberately configured component.
