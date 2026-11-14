# Encrypted Google Drive backups

Backup preparation uses restic and rclone. The destination is
`rclone:klinekraft-drive:Klinekraft-Backups/restic`. The Google Drive remote uses
`drive.file` scope, limiting access to files created/authorized for this app.
Google authorization must complete on the Pi. If Google's shared rclone OAuth
client is unavailable, configure a dedicated Google desktop OAuth client per
https://rclone.org/drive/#making-your-own-client-id .

The backup payload includes a SQLite online backup of the Terminal database
(notes, drawings, conversations, notebook, calendar, game favorites), saved research
files, game saves/catalog, RetroArch settings/saves, and Downloads/Received.
It excludes ROMs, emulator cores, offline encyclopedias, the OS, API keys,
rclone tokens, LocalSend private keys, and browser-only preferences/bookmarks.
The source data is not deleted or moved. Symlinks are excluded from copied trees.
Stage failures stop the backup rather than uploading a partial success.

Run `python3 scripts/backup-pi.py --stage-only` to prepare the payload in
`~/.cache/klinekraft-backup/payload`. SQLite is snapshotted with its online backup
API and integrity checked. The payload directory is private to the current user.
Quit games before a manual backup to include the latest emulator saves.

Private configuration, never committed:

- `~/.config/klinekraft-backup/password`: randomly generated recovery password
- `~/.config/klinekraft-backup/environment`: restic destination and password path
- `~/.config/rclone/rclone.conf`: Google OAuth connection
- `~/Documents/Klinekraft Backup Recovery.txt`: copy to a separate trusted device

Use `set -a; . ~/.config/klinekraft-backup/environment; set +a` in a private
terminal to load restic's configuration. After connecting Google Drive, run
`restic init` once, then `systemctl --user start klinekraft-backup.service`.
Run `restic check` and restore the latest snapshot to an empty temporary folder;
compare files before enabling the timer.

Install the service/timer from deploy/ into ~/.config/systemd/user and reload
systemd. Enable `klinekraft-backup.timer` only after the first cloud backup and
restore verification pass. The prepared schedule is daily at 20:00 local time,
with up to 15 minutes jitter and a catch-up when the user service starts again.
It does not wake a powered-off Pi. A failed run retries at the next scheduled run.

Snapshots are versioned; automatic deletion/pruning is deliberately not enabled.
Review storage use later before choosing a retention policy. Job result metadata
is stored at `~/.local/state/klinekraft-backup/status.json`; check the service
exit status/logs for errors. The timer alone does not mean a backup succeeded.

Restore into a separate directory first, inspect RESTORE.txt, then stop Terminal
and close RetroArch before placing restored files into their original locations.
Never overwrite live data during a restore test.

Initial preparation validation: an encrypted local repository, backup, restic
check, and byte-for-byte restore of all 46 staged files passed. This local test
was followed by cloud activation on November 13, 2026. Snapshot `63750f3c`
passed `restic check --read-data` and a cloud restore matched all 46 files
byte-for-byte. The daily timer is enabled. Local rclone requests are limited to
one per second to reduce bursts; Google shared-client quota delays were observed
during setup. The dedicated OAuth client recommendation above still applies.

For the separately requested encrypted OS/configuration/maps/games backup, see
[full-system recovery](recovery.md). Its manual `full-system` snapshot has a broader
scope than this daily app-data job and includes private configuration under encryption.
