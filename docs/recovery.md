# Full-system encrypted recovery backup

Run manually while plugged in and with games closed:

```sh
sudo python3 scripts/backup-system.py --user klinekraft
```

Uses the existing encrypted restic repository on Google Drive and shares the daily
backup job lock. It waits for an active daily backup rather than interrupting it.
It includes root filesystem files and the separately mounted `/boot/firmware`, maps,
installed games, user files, OS configuration and credentials. Everything uploaded
is encrypted by restic. The existing daily **app-data** backup keeps its smaller scope.
No full-system recurring timer is installed.

Excluded: pseudo-filesystems, other mounted disks/network drives, caches, trash,
logs, temporary files and swap. File ownership, permissions, symlinks and extended
attributes are handled by restic. Metadata under `/var/lib/klinekraft-recovery/payload`
includes partition layout, UUIDs, installed package versions, enabled services,
restore notes and a transaction-consistent copy of the Terminal SQLite database.
Status is `/var/lib/klinekraft-recovery/status.json`; a nonzero restic exit is failure,
including partial backups with unreadable files.

**This is a live filesystem backup, not a bootable SD image or an atomic system
snapshot.** Other running apps may change while read. Terminal's separate SQLite
snapshot is consistent; unrelated application databases have no such guarantee.
A spare card is required to prove boot recovery. No spare-card boot test is claimed.

## Recovery outline

Keep the recovery password on a separate trusted device; the encrypted backup cannot
recover its own decryption password. Reauthorize rclone on the recovery machine if
needed. Start from compatible 64-bit Raspberry Pi OS or a separate rescue installation.
List snapshots with the `full-system` tag and restore into an empty staging directory
first. Inspect `var/lib/klinekraft-recovery/payload/RESTORE.txt` before applying files.

Recreate boot/root partitions on the replacement card and mount both before copying
restored files with ownership and xattrs preserved. Review `/etc/fstab` and the boot
`cmdline.txt` PARTUUID values against the replacement card; don't blindly apply the
old partition dump. Restore the consistent Terminal database with its service stopped
and remove stale restored WAL/SHM sidecars before starting it. Never restore over a
running root filesystem. Boot and verify the spare card before retiring the original.

Repository metadata checks and selected-file restore comparisons check cloud data;
they do not substitute for a spare-card boot test or a full read-back of every pack.

## Installed background job

The manual system service `klinekraft-recovery.service` runs independently of a
terminal/chat window. It is not enabled at boot and has no recurring timer. Start
with `sudo systemctl start --no-block klinekraft-recovery.service`; inspect with
`sudo systemctl status klinekraft-recovery.service` and the private upload log at
`/var/lib/klinekraft-recovery/upload.log`. Do not power off during the first upload.

Installed copies of `backup-system.py` and `rclone-user.sh` under
`/usr/local/lib/klinekraft` are root-owned. The rclone subprocess runs as the desktop
user so token refresh cannot make the user's OAuth configuration root-owned. The
service limits CPU use and gives the backup low CPU/I/O priority. Google shared-client
quota delays may make the initial large upload slow; status `saved` alone still needs
repository checks and a restore verification before calling the backup verified.
