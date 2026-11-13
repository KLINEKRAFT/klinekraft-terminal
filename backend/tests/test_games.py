from pathlib import Path
import hashlib
import json
import subprocess
import zipfile
from fastapi.testclient import TestClient
import pytest
from klinekraft.main import app
from klinekraft import games
from klinekraft.game_import import import_games, classify

HEADERS = {'X-Klinekraft-Client': 'local-ui'}


def genesis():
    data = bytearray(32768)
    data[0x100:0x110] = b'SEGA MEGA DRIVE '
    return bytes(data)


def test_import_misplaced_roms_duplicates_and_saves(tmp_path):
    source, dest = tmp_path / 'roms', tmp_path / 'library'
    (source / 'sega32x').mkdir(parents=True)
    (source / 'snes').mkdir()
    (source / 'nes').mkdir()
    data = genesis()
    with zipfile.ZipFile(source / 'sega32x/Zero.zip', 'w') as z:
        z.writestr('Zero.md', data)
        z.writestr('../escape.md', data)
    (source / 'sega32x/Zero.md').write_bytes(data)
    (source / 'sega32x/Zero.srm').write_bytes(b'save data')
    (source / 'nes/Mario.smc').write_bytes(bytes(32768))
    (source / 'snes/also-Mario.sfc').write_bytes(bytes(32768))
    (source / 'nes/Test.nes').write_bytes(b'NES\x1a' + bytes(16384))
    (source / 'nes/link.nes').symlink_to(source / 'nes/Test.nes')
    result = import_games(source, dest)
    assert result['games'] == 3
    assert result['duplicates'] == 2
    catalog = json.loads((dest / 'catalog.json').read_text())['games']
    assert {g['system'] for g in catalog} == {'nes', 'snes', 'megadrive'}
    game_id = hashlib.sha256(data).hexdigest()
    active = dest / 'saves' / game_id / 'game.srm'
    assert active.read_bytes() == b'save data'
    assert len(list((dest / 'save-backups').rglob('*.backup'))) == 1
    active.write_bytes(b'new progress')
    import_games(source, dest)
    assert active.read_bytes() == b'new progress'
    assert (source / 'sega32x/Zero.srm').read_bytes() == b'save data'
    assert not (tmp_path / 'escape.md').exists()


def test_32x_and_invalid_rom_not_guessed():
    data = bytearray(genesis())
    data[0x100:0x110] = b'SEGA 32X        '
    assert classify('fake.md', bytes(data)) is None
    assert classify('random.bin', bytes(32768)) is None
    assert classify('fake.nes', b'not a rom') is None


def test_import_save_conflict_is_backed_up_not_activated(tmp_path):
    source, dest = tmp_path / 'roms', tmp_path / 'library'
    for name in ['a', 'b']:
        (source / name).mkdir(parents=True)
        (source / name / 'Zero.md').write_bytes(genesis())
        (source / name / 'Zero.srm').write_bytes(name.encode())
    report = import_games(source, dest)
    assert any('Conflicting saves' in warning for warning in report['warnings'])
    assert not list((dest / 'saves').glob('*/game.srm'))
    assert len(list((dest / 'save-backups').rglob('*.backup'))) == 2


@pytest.fixture
def library(tmp_path, monkeypatch):
    source, dest = tmp_path / 'source', tmp_path / 'library'
    source.mkdir()
    (source / 'Zero.md').write_bytes(genesis())
    import_games(source, dest)
    monkeypatch.setattr(games, 'library_root', lambda: dest)
    monkeypatch.setattr(games, 'process', None)
    monkeypatch.setattr(games, 'process_game', None)
    monkeypatch.delenv('KLINEKRAFT_GAMES', raising=False)
    with TestClient(app, base_url='http://localhost') as client:
        yield client, dest, hashlib.sha256(genesis()).hexdigest()


def test_api_guards_and_disabled_launcher(library):
    client, _, game_id = library
    assert client.get('/api/games').status_code == 403
    response = client.get('/api/games', headers=HEADERS)
    assert response.status_code == 200
    assert response.json()['systems']['megadrive'] is not None
    assert 'rom' not in response.json()['games'][0]
    assert client.post('/api/games/launch', headers=HEADERS, json={'game_id': game_id}).status_code == 503
    assert client.post('/api/games/launch', headers=HEADERS, json={'game_id': ';touch /tmp/pwned'}).status_code == 422
    assert client.post('/api/games/launch', headers=HEADERS, json={'game_id': 'f'*64}).status_code == 404


def test_launch_uses_fixed_argv_and_ignores_catalog_path(library, monkeypatch):
    client, dest, game_id = library
    data = json.loads((dest / 'catalog.json').read_text())
    data['games'][0]['rom'] = '/etc/passwd'
    (dest / 'catalog.json').write_text(json.dumps(data))
    monkeypatch.setattr(games, 'readiness', lambda system: None)
    monkeypatch.setattr(games, 'core_path', lambda system: Path('/fixed/genesis_plus_gx_libretro.so'))
    calls = []
    class Process:
        returncode = None
        def __init__(self, argv, **kwargs): calls.append((argv, kwargs))
        def wait(self, timeout): raise subprocess.TimeoutExpired('retroarch', timeout)
        def poll(self): return None
    monkeypatch.setattr(games.subprocess, 'Popen', Process)
    response = client.post('/api/games/launch', headers=HEADERS, json={'game_id': game_id})
    assert response.status_code == 200
    argv, kwargs = calls[0]
    assert argv[0] == '/usr/bin/retroarch'
    assert argv[-1] == str(dest / 'content' / game_id / 'game.md')
    assert '/etc/passwd' not in argv
    assert not kwargs.get('shell', False)
    assert kwargs['pass_fds']
    assert client.get('/api/games', headers=HEADERS).json()['running'] == game_id


def test_missing_and_outside_rom_are_not_launched(library, monkeypatch):
    client, dest, game_id = library
    monkeypatch.setattr(games, 'readiness', lambda system: None)
    rom = dest / 'content' / game_id / 'game.md'
    rom.unlink()
    assert client.post('/api/games/launch', headers=HEADERS, json={'game_id': game_id}).status_code == 404
    rom.symlink_to('/etc/passwd')
    assert client.post('/api/games/launch', headers=HEADERS, json={'game_id': game_id}).status_code == 404
