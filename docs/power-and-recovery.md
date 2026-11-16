# Field mode, battery protection and recovery

Field mode is available above every Terminal page. It stops the offline AI service and AirPlay receiver. A separate Dim toggle controls the visual dimming overlay independently and saves its setting on the Pi. Existing Field mode dimming is preserved until the Dim toggle is changed. This HDMI panel exposes no backlight device: visual dimming is for comfort and is not claimed to reduce panel power. Maps, references, Wi-Fi and backups remain available. The AI service wakes for a local generated answer and stops after 2–3 idle minutes; direct-reference answers do not wake it. AirPlay starts explicitly from Network. Turning Field mode off restarts AI, but does not start AirPlay. The preference persists across Terminal restart.

Battery alerts appear at 25% and 15%. The runtime display estimates time to a 15% reserve from 10–30 minutes of declining gauge readings, resets on charging increases or sampling gaps, and never represents a measured guarantee or time to electrical cutoff.

## Shutdown guard

Install with `bash scripts/setup-power.sh`. The independent root-owned system unit `klinekraft-battery-guard.service` reads the X1202 gauge every ten seconds. Code and policy are copied into /usr/local/lib/klinekraft-power; the browser cannot supply executable commands. It shuts down only after valid readings remain critical for 30 seconds, followed by a 60-second countdown and a final gauge check. Critical means <=8% AND <=3.60V, OR <=3.35V regardless of percentage. External power detected on GPIO6, recovered readings, and sensor errors cancel the countdown. It does not change charging GPIO16 or cut battery power directly. Current status is /run/klinekraft-battery-guard.json.

Policy tests cover invalid data, brief dips, recovery, full countdown and independent voltage protection. A simulated policy test does not establish hardware reliability. A controlled physical shutdown, battery-output cutoff and reboot test has NOT been performed. EEPROM POWER_OFF_ON_HALT is not explicitly configured on this device; no reboot or EEPROM change is made automatically. Treat protection as configured software until the complete hardware sequence has been verified.

Manufacturer references: https://wiki.geekworm.com/X1202_Hardware and https://wiki.geekworm.com/X120X_Software. GPIO6 was observed low while unplugged and high after the user confirmed reconnection on November 14, 2026. It now cancels shutdown while external power is present, and hides discharge estimates while plugged in. A failed GPIO read is reported as unknown; valid low-voltage protection remains available.

## Backup checks

The existing encrypted restic repository uses Google Drive. Previous full-system upload failed because of Google's shared-project request quota, not account storage capacity. Retry only while connected to charging power. The daily Terminal backup stages a SQLite-consistent database and research files. Full-system backup is a live filesystem backup, not a bootable card image or an atomic snapshot of every application.

Restore verification writes into ~/.local/state/klinekraft-backup/restore-verification, never over active files. An integrity-checked restored database and restic repository check validate those specific artifacts; they do not prove a replacement SD card boots. Keep the recovery password separately available from this Pi.

### Local encrypted fallback and multipart upload

When the shared rclone API project is rate-limited, `sudo python3 scripts/backup-system.py --local-repository /home/klinekraft/.local/share/klinekraft-recovery-local` creates a separate encrypted repository using the existing backup password. The repository must be inside the account home directory; its contents and recovery logs are excluded from the backup. Status explicitly distinguishes local storage from Google Drive.

After the backup completes, run `scripts/package-recovery.py REPOSITORY NEW_OUTPUT_DIRECTORY`. It produces 64 MiB parts, below the Drive connector's 100 MB limit, plus SHA256SUMS, MD5SUMS and parts.json. Completed parts are recorded only after their files close. Never upload an actively written part or treat a partial output directory as a complete backup. The encrypted repository, archive parts and password must remain separate from the public Git repository.

For recovery, download every part and SHA256SUMS into an empty working directory. Run `sha256sum -c SHA256SUMS` before concatenating `repository.tar.part-*` in filename order into repository.tar. Extract into a separate empty directory and use restic with the separately saved password to check and restore the repository. Never restore directly over a running operating system. A cloud completion record must state the verification performed; matching cloud file sizes and a sampled download do not establish full read-back verification of every byte.

The November 14 local fallback contains 214,412 files and approximately 32.5 GB of source data (24.1 GB encrypted). The restic structure check passed, and the isolated restored SQLite database passed integrity checks with 868 research records. Boot configuration files were also restored successfully. This does not establish bootability. Automated daily cloud uploads still depend on the separately rate-limited rclone transport.

## Validation on November 14, 2026

93 backend tests and six browser tests passed, including all pages at 1024×600 and 1024×560. Live Field mode stopped AI and AirPlay; a local generated answer woke the model, answered in 62 seconds, then the model stopped after its idle interval. The root guard is enabled at boot and reports valid gauge readings plus external power after reconnection. No real poweroff was executed.

## Restart and offline verification

A subsequent controlled shutdown and manual restart produced a new boot ID. Terminal relaunched in Chromium app mode; the AI, routing, Wikipedia and battery-guard services returned. The database passed a quick integrity check with 868 research records. The previous boot's final shutdown journal was unavailable, so electrical cutoff and the real low-battery trigger remain unverified.

Install bounded persistent boot logging with `bash scripts/setup-journal.sh`. The journald drop-in retains logs across boots with a 100 MB usage target, seven-day retention and 1 GB free-space reserve. The installer flushes the current journal to disk; it cannot recover previously discarded boots.

On November 15, an isolated audit process with `IPAddressDeny=any` and `IPAddressAllow=localhost` verified that an external TCP connection failed while local resources remained usable. Library search, map archive ranges and label fonts, Wikipedia search/articles, a short Tulsa route, notes/calendar/drawing storage, the game catalog, Shackleton reference answers and local generated text all passed. Tests used a temporary database copy. Field mode was temporarily disabled for the separate audit process's model request and restored afterward, avoiding interference from the live backend's independent idle timer.

The separate phone library served search results and a document, and returned 404 for personal notes, chats, power and hotspot API paths. The hotspot profile is WPA-protected, has autoconnect disabled and serves at http://10.42.0.1:8090 when activated. This verifies software behavior, not a physical phone association, radio-off test, emulator play session or a full browser interaction test. The Pi's internet connection remained available for the chat throughout the isolated audit.
