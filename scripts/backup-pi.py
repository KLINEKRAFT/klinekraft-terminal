#!/usr/bin/env python3
"""Stage consistent Pi data and create an encrypted restic snapshot."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
from datetime import datetime, timezone


def copy_tree(source, destination, excluded=()):
    if not source.exists() or source.is_symlink():
        return
    if source.is_file():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        return
    def ignore(directory, names):
        return [name for name in names if name in excluded or (Path(directory) / name).is_symlink()]
    shutil.copytree(source, destination, ignore=ignore)


def stage(home, target):
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True, mode=0o700)
    data = home / '.local/share/klinekraft'
    copy_tree(data / 'research-files', target / 'terminal/research-files')
    database = data / 'conversations.sqlite3'
    if not database.is_file() or database.is_symlink():
        raise RuntimeError('Terminal database is missing or linked. Backup stopped.')
    if database.exists() and not database.is_symlink():
        destination = target / 'terminal/conversations.sqlite3'
        destination.parent.mkdir(exist_ok=True)
        with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as source:
            with sqlite3.connect(destination) as output:
                source.backup(output)
                if output.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('Database snapshot failed its integrity check.')
    copy_tree(home / 'Games/Klinekraft/saves', target / 'games/saves')
    copy_tree(home / 'Games/Klinekraft/catalog.json', target / 'games/catalog.json')
    copy_tree(home / '.config/retroarch', target / 'retroarch', ('cores', 'shaders', 'logs'))
    copy_tree(home / 'Downloads/Received', target / 'received')
    (target / 'RESTORE.txt').write_text(
        'Stop klinekraft.service before restoring terminal/ to ~/.local/share/klinekraft/.\n'
        'Restore games/saves to ~/Games/Klinekraft/saves, retroarch to ~/.config/retroarch,\n'
        'and received to ~/Downloads/Received. Review existing files before replacing them.\n'
        'Catalog requires separately restored ROMs. ROMs, OS, browser-only preferences,\n'
        'API keys, OAuth credentials and the backup recovery password are not included.\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage-only', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    home = Path.home()
    state = home / '.local/state/klinekraft-backup'
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state / 'job.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        target = home / '.cache/klinekraft-backup/payload'
        try:
            stage(home, target)
            if args.stage_only:
                print('Prepared consistent backup payload:', target)
                return
            subprocess.run(['restic', 'backup', '--host', 'klinekraft-cyberdeck', '--tag', 'terminal', '.'], cwd=target, check=True)
            (state / 'status.json').write_text(json.dumps({'last_success': datetime.now(timezone.utc).isoformat(), 'state': 'saved'}))
        except Exception:
            status = state / 'status.json'
            try:
                previous = json.loads(status.read_text())
            except (OSError, ValueError):
                previous = {}
            previous.update(last_attempt=datetime.now(timezone.utc).isoformat(), state='failed')
            status.write_text(json.dumps(previous))
            raise


if __name__ == '__main__':
    main()
