# Field mode, battery protection and recovery

Field mode is available above every Terminal page. It stops the offline AI service and AirPlay receiver and applies a visual dimming overlay. This HDMI panel exposes no backlight device: visual dimming is for comfort and is not claimed to reduce panel power. Maps, references, Wi-Fi and backups remain available. The AI service wakes for a local generated answer and stops after 2–3 idle minutes; direct-reference answers do not wake it. AirPlay starts explicitly from Network. Turning Field mode off restarts AI, but does not start AirPlay. The preference persists across Terminal restart.

Battery alerts appear at 25% and 15%. The runtime display estimates time to a 15% reserve from 10–30 minutes of declining gauge readings, resets on charging increases or sampling gaps, and never represents a measured guarantee or time to electrical cutoff.

## Shutdown guard

Install with `bash scripts/setup-power.sh`. The independent root-owned system unit `klinekraft-battery-guard.service` reads the X1202 gauge every ten seconds. Code and policy are copied into /usr/local/lib/klinekraft-power; the browser cannot supply executable commands. It shuts down only after valid readings remain critical for 30 seconds, followed by a 60-second countdown and a final gauge check. Critical means <=8% AND <=3.60V, OR <=3.35V regardless of percentage. External power detected on GPIO6, recovered readings, and sensor errors cancel the countdown. It does not change charging GPIO16 or cut battery power directly. Current status is /run/klinekraft-battery-guard.json.

Policy tests cover invalid data, brief dips, recovery, full countdown and independent voltage protection. A simulated policy test does not establish hardware reliability. A controlled physical shutdown, battery-output cutoff and reboot test has NOT been performed. EEPROM POWER_OFF_ON_HALT is not explicitly configured on this device; no reboot or EEPROM change is made automatically. Treat protection as configured software until the complete hardware sequence has been verified.

Manufacturer references: https://wiki.geekworm.com/X1202_Hardware and https://wiki.geekworm.com/X120X_Software. GPIO6 was observed low while unplugged and high after the user confirmed reconnection on November 14, 2026. It now cancels shutdown while external power is present, and hides discharge estimates while plugged in. A failed GPIO read is reported as unknown; valid low-voltage protection remains available.

## Backup checks

The existing encrypted restic repository uses Google Drive. Previous full-system upload failed because of Google's shared-project request quota, not account storage capacity. Retry only while connected to charging power. The daily Terminal backup stages a SQLite-consistent database and research files. Full-system backup is a live filesystem backup, not a bootable card image or an atomic snapshot of every application.

Restore verification writes into ~/.local/state/klinekraft-backup/restore-verification, never over active files. An integrity-checked restored database and restic repository check validate those specific artifacts; they do not prove a replacement SD card boots. Keep the recovery password separately available from this Pi.

## Validation on November 14, 2026

93 backend tests and six browser tests passed, including all pages at 1024×600 and 1024×560. Live Field mode stopped AI and AirPlay; a local generated answer woke the model, answered in 62 seconds, then the model stopped after its idle interval. The root guard is enabled at boot and reports valid gauge readings plus external power after reconnection. No real poweroff was executed.
