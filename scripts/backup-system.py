#!/usr/bin/env python3
"""Manual, encrypted live-system file backup. This is not a block-device image."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import pwd
import shlex
import sqlite3
import subprocess
from datetime import datetime, timezone

EXCLUDES = ['/dev', '/proc', '/sys', '/run', '/tmp', '/mnt', '/media', '/lost+found',
            '/var/tmp', '/var/cache', '/var/log', '/var/swap', '/swapfile', '/swap.img',
            '/root/.cache', '/home/*/.cache', '/home/*/.local/share/Trash',
            '/var/lib/klinekraft-recovery/status.json', '/var/lib/klinekraft-recovery/upload.log']


def configuration(home):
    env = os.environ.copy()
    allowed = {'RESTIC_REPOSITORY', 'RESTIC_PASSWORD_FILE', 'RCLONE_TPSLIMIT', 'RCLONE_TPSLIMIT_BURST'}
    for line in (home/'.config/klinekraft-backup/environment').read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        key, value = line.split('=', 1)
        if key in allowed:
            values = shlex.split(value)
            if len(values) != 1:
                raise ValueError('Invalid backup configuration')
            env[key] = values[0]
    if not env.get('RESTIC_REPOSITORY') or not env.get('RESTIC_PASSWORD_FILE'):
        raise ValueError('Backup repository and password file must already be configured')
    env['RCLONE_CONFIG'] = str(home/'.config/rclone/rclone.conf')
    env['RCLONE_DISABLE_HTTP2'] = 'true'
    env['RCLONE_LOG_LEVEL'] = 'INFO'
    env['KLINEKRAFT_BACKUP_USER'] = pwd.getpwuid(home.stat().st_uid).pw_name
    env['RESTIC_CACHE_DIR'] = '/root/.cache/klinekraft-restic'
    env['GOMAXPROCS'] = '2'
    env['RESTIC_PROGRESS_FPS'] = '0.1'
    return env


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--user', default='klinekraft')
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error('Run with sudo to include system files and preserve ownership.')
    os.umask(0o077)
    account = pwd.getpwnam(args.user)
    home = Path(account.pw_dir)
    env = configuration(home)
    shared_lock = home/'.local/state/klinekraft-backup/job.lock'
    with shared_lock.open('a') as lock:
        # Share the daily application's lock; never interrupt an existing backup.
        fcntl.flock(lock, fcntl.LOCK_EX)
        root = Path('/var/lib/klinekraft-recovery')
        root.mkdir(exist_ok=True, mode=0o700)
        payload = root/'payload'
        payload.mkdir(exist_ok=True, mode=0o700)
        commands = {
            'partitions.txt':['sfdisk','--dump','/dev/mmcblk0'],
            'block-devices.json':['lsblk','--json','-o','NAME,SIZE,FSTYPE,UUID,PARTUUID,MOUNTPOINTS'],
            'installed-packages.txt':['dpkg-query','-W','-f=${binary:Package}\t${Version}\n'],
            'enabled-services.txt':['systemctl','list-unit-files','--state=enabled','--no-pager'],
        }
        for filename, command in commands.items():
            result = subprocess.run(command, check=True, capture_output=True, text=True)
            (payload/filename).write_text(result.stdout)
        source = home/'.local/share/klinekraft/conversations.sqlite3'
        with sqlite3.connect(source.as_uri()+'?mode=ro', uri=True) as db:
            with sqlite3.connect(payload/'terminal-consistent.sqlite3') as output:
                db.backup(output)
                if output.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('Terminal database integrity check failed')
        (payload/'RESTORE.txt').write_text(
            'Live filesystem backup, not an SD-card image or atomic OS snapshot.\n'
            'Boot a separate rescue OS or reinstall compatible 64-bit Raspberry Pi OS.\n'
            'Use the separate recovery password and rclone authorization to access restic.\n'
            'Restore into an empty directory first, never directly over a running system.\n'
            'Root and /boot/firmware were explicitly included; recreate/mount boot and root\n'
            'partitions separately on the replacement card. Preserve ownership/xattrs.\n'
            'Review /etc/fstab and boot cmdline PARTUUIDs against the replacement partitions.\n'
            'Use terminal-consistent.sqlite3 for the Terminal database with its service stopped;\n'
            'remove stale WAL/SHM sidecars from the restored copy before first startup.\n'
            'Caches, logs, temporary files, mounted external/network drives and swap excluded.\n'
            'Other live applications can change while read; their databases are not guaranteed\n'
            'transaction-consistent. No boot-restore test has been performed.\n')
        if args.prepare_only:
            print('Recovery metadata and consistent Terminal database prepared.')
            return
        status = root/'status.json'
        started = datetime.now(timezone.utc).isoformat()
        status.write_text(json.dumps({'state':'running','started':started}))
        command = ['restic', '-o', 'rclone.program=/usr/local/lib/klinekraft/rclone-user.sh', 'backup','--json','--host','klinekraft-cyberdeck','--tag','full-system',
                   '--one-file-system','--exclude-caches','--retry-lock','10m']
        for excluded in EXCLUDES:
            command += ['--exclude', excluded]
        command += ['/', '/boot/firmware']
        try:
            subprocess.run(command, env=env, check=True)
        except Exception:
            status.write_text(json.dumps({'state':'failed','started':started,'finished':datetime.now(timezone.utc).isoformat()}))
            raise
        status.write_text(json.dumps({'state':'saved','started':started,'finished':datetime.now(timezone.utc).isoformat(),
                                    'scope':'live-system files; not a boot-tested disk image'}))


if __name__ == '__main__':
    main()
