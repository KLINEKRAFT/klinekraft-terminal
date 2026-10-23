"""Copy supported ROMs into an isolated library; preserve source files and saves."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import tempfile
import zipfile

MAX_ROM = 32 * 1024 * 1024
EXTENSIONS = {'.nes', '.sfc', '.smc', '.md', '.gen', '.bin'}


def library_root():
    return Path.home() / 'Games' / 'Klinekraft'


def classify(name, data):
    suffix = Path(name).suffix.lower()
    if data.startswith(b'NES\x1a') and suffix == '.nes':
        return 'nes'
    if suffix in {'.md', '.gen', '.bin'} and data[0x100:0x104] == b'SEGA':
        # 32X uses a different core. Never silently launch it as Genesis.
        if b'32X' not in data[0x100:0x110].upper():
            return 'megadrive'
    if suffix in {'.sfc', '.smc'} and len(data) >= 32768 and len(data) % 1024 in (0, 512):
        return 'snes'
    return None


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        json.dump(value, stream, indent=2)
    temporary.replace(path)


def import_games(source, destination=None):
    source = Path(source).resolve()
    destination = Path(destination or library_root()).resolve()
    if not source.is_dir():
        raise ValueError('Choose the roms folder on your USB drive or backup.')
    if source == destination or destination.is_relative_to(source):
        raise ValueError('The library destination must be outside the source folder.')
    destination.mkdir(parents=True, exist_ok=True)
    catalog = destination / 'catalog.json'
    existing = json.loads(catalog.read_text()) if catalog.exists() else {'games': []}
    games = {game['id']: game for game in existing['games']}
    matches, saves, warnings = {}, [], []
    duplicates = 0
    source_id = hashlib.sha256(str(source).encode()).hexdigest()[:12]
    for current, folders, names in os.walk(source, followlinks=False):
        folders[:] = sorted(name for name in folders if not name.startswith('.') and not (Path(current) / name).is_symlink())
        for name in sorted(names):
            path = Path(current) / name
            if name.startswith('.') or path.is_symlink() or not path.is_file():
                continue
            relative = str(path.relative_to(source))
            suffix = path.suffix.lower()
            if suffix in {'.srm', '.sav'} or suffix.startswith('.state'):
                if path.stat().st_size > MAX_ROM:
                    warnings.append(f'Large save skipped: {relative}')
                    continue
                data = path.read_bytes()
                digest = hashlib.sha256(data).hexdigest()
                backup = destination / 'save-backups' / source_id / path.relative_to(source).parent / f'{path.name}.{digest[:12]}.backup'
                backup.parent.mkdir(parents=True, exist_ok=True)
                if not backup.exists(): backup.write_bytes(data)
                saves.append((path, data))
                continue
            candidates = []
            try:
                if suffix == '.zip':
                    with zipfile.ZipFile(path) as archive:
                        entries = archive.infolist()
                        if len(entries) > 1000:
                            warnings.append(f'Archive has too many entries: {relative}')
                            continue
                        for entry in entries:
                            member = Path(entry.filename)
                            if entry.is_dir() or any(part.startswith('.') or part == '..' for part in member.parts) or member.is_absolute(): continue
                            if member.suffix.lower() not in EXTENSIONS: continue
                            if entry.file_size > MAX_ROM:
                                warnings.append(f'ROM too large: {relative} / {entry.filename}')
                                continue
                            candidates.append((member.name, archive.read(entry)))
                            if sum(len(item[1]) for item in candidates) > MAX_ROM:
                                raise ValueError('Archive contains too much ROM data')
                elif suffix in EXTENSIONS and path.stat().st_size <= MAX_ROM:
                    candidates.append((name, path.read_bytes()))
                elif suffix not in {'.txt', '.xml', '.png', '.jpg', '.cfg'}:
                    warnings.append(f'Unsupported file preserved on source: {relative}')
                if suffix == '.zip' and not candidates:
                    warnings.append(f'No supported ROM in archive: {relative}')
                for filename, data in candidates:
                    system = classify(filename, data)
                    if system is None:
                        warnings.append(f'Unrecognized ROM preserved on source: {relative} / {filename}')
                        continue
                    game_id = hashlib.sha256(data).hexdigest()
                    if game_id in games: duplicates += 1
                    else:
                        folder = destination / 'content' / game_id
                        folder.mkdir(parents=True, exist_ok=True)
                        extension = {'nes': '.nes', 'snes': '.sfc', 'megadrive': '.md'}[system]
                        rom = folder / ('game' + extension)
                        rom.write_bytes(data)
                        games[game_id] = {'id': game_id, 'title': Path(filename).stem, 'system': system, 'rom': str(rom.relative_to(destination))}
                    # Support same-folder and nested-unpacked RetroPie saves.
                    for stem in {Path(filename).stem, path.stem}:
                        for parent in {path.parent, path.parent.parent}:
                            matches.setdefault((str(parent), stem.casefold()), set()).add(game_id)
            except (OSError, zipfile.BadZipFile, RuntimeError, ValueError, NotImplementedError) as error:
                warnings.append(f'Could not import {relative}: {error}')
    per_game = {}
    for save, data in saves:
        if save.suffix.lower() != '.srm': continue  # Other formats are backed up, never guessed.
        ids = matches.get((str(save.parent), save.stem.casefold()), set())
        if len(ids) != 1:
            warnings.append(f'Save backed up; no unique game match: {save.name}')
            continue
        game_id = next(iter(ids))
        per_game.setdefault(game_id, {})[hashlib.sha256(data).hexdigest()] = data
    for game_id, versions in per_game.items():
        if len(versions) != 1:
            warnings.append(f'Conflicting saves backed up for {games[game_id]["title"]}; choose one manually.')
            continue
        target = destination / 'saves' / game_id / 'game.srm'
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists(): target.write_bytes(next(iter(versions.values())))
        elif target.read_bytes() != next(iter(versions.values())):
            warnings.append(f'Kept existing active save for {games[game_id]["title"]}; imported copy is backed up.')
    result = {'games': sorted(games.values(), key=lambda game: game['title'].casefold())}
    atomic_json(catalog, result)
    report = {'games': len(games), 'duplicates': duplicates, 'savesBackedUp': len(saves), 'warnings': warnings}
    atomic_json(destination / 'import-report.json', report)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', help='Source roms folder (unchanged by import)')
    args = parser.parse_args()
    result = import_games(args.source)
    print(f"Library: {result['games']} games; {result['duplicates']} duplicate copies merged; {result['savesBackedUp']} saves backed up.")
    for warning in result['warnings'][:20]: print(warning)
    print('Full report: ~/Games/Klinekraft/import-report.json')
