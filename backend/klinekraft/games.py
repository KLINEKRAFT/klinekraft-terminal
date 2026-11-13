"""Allowlisted local RetroArch launcher. Never accepts paths or shell commands."""
from pathlib import Path
import json
import os
import re
import subprocess
import threading
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from .game_import import ROM_EXTENSIONS, library_root
from .local_content import local_request

router = APIRouter(prefix='/api/games', dependencies=[Depends(local_request)])
CORES = {'nes': 'nestopia_libretro.so', 'snes': 'snes9x_libretro.so', 'megadrive': 'genesis_plus_gx_libretro.so', 'n64': 'mupen64plus_next_libretro.so'}
CORE_DIRS = [Path('/usr/lib/aarch64-linux-gnu/libretro'), Path('/usr/lib/arm-linux-gnueabihf/libretro'), Path('/usr/lib/x86_64-linux-gnu/libretro'), Path('/usr/lib/libretro')]
process = None
process_game = None
launch_lock = threading.Lock()


def core_path(system):
    directories = CORE_DIRS + [Path.home() / '.config/retroarch/cores'] if system == 'n64' else CORE_DIRS
    for directory in directories:
        candidate = directory / CORES[system]
        if candidate.is_file(): return candidate
    return None


def catalog():
    try:
        data = json.loads((library_root() / 'catalog.json').read_text())
        if not isinstance(data.get('games'), list): raise ValueError()
        return [game for game in data['games'] if isinstance(game, dict) and re.fullmatch('[a-f0-9]{64}', str(game.get('id', ''))) and game.get('system') in CORES and isinstance(game.get('title'), str)]
    except FileNotFoundError:
        return []
    except (ValueError, TypeError, OSError):
        raise HTTPException(503, 'Game catalog could not be read. Rerun the importer.')


def readiness(system):
    if os.environ.get('KLINEKRAFT_GAMES') != '1': return 'Run Games setup on the Pi.'
    if not Path('/usr/bin/retroarch').is_file(): return 'RetroArch is not installed.'
    if core_path(system) is None: return f'{system} emulator core is not installed.'
    if not (os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY')): return 'Log into the Pi desktop and run the Games desktop-session helper.'
    return None


@router.get('')
def list_games(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    games = catalog()
    states = {system: readiness(system) for system in CORES}
    return {'games': [{k: game[k] for k in ('id', 'title', 'system')} for game in games],
            'systems': states, 'running': process_game if process is not None and process.poll() is None else None,
            'lastExitCode': process.returncode if process is not None else None}


class LaunchRequest(BaseModel):
    game_id: str = Field(pattern='^[a-f0-9]{64}$')


@router.post('/launch')
def launch_game(body: LaunchRequest):
    global process, process_game
    with launch_lock:
        game = next((game for game in catalog() if game['id'] == body.game_id), None)
        if game is None: raise HTTPException(404, 'Game not found. Refresh the library.')
        if process is not None and process.poll() is None:
            raise HTTPException(409, 'A game is already running. Quit it in RetroArch first.')
        error = readiness(game['system'])
        if error: raise HTTPException(503, error)
        # Reconstruct every path from the validated digest and system, not catalog-provided paths.
        root = library_root().resolve()
        extension = ROM_EXTENSIONS[game['system']]
        rom = root / 'content' / game['id'] / ('game' + extension)
        if not rom.is_file() or not rom.resolve().is_relative_to(root / 'content'):
            raise HTTPException(404, 'Game file is missing or linked outside the library.')
        import fcntl  # Launcher setup is Linux-only.
        lock_file = (root / '.launch.lock').open('a')
        try:
            try: fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError: raise HTTPException(409, 'A game is already running. Quit it in RetroArch first.')
            saves = root / 'saves' / game['id']
            saves.mkdir(parents=True, exist_ok=True)
            settings = saves / 'session.cfg'
            quoted = json.dumps(str(saves))
            session_config = f'savefile_directory = {quoted}\nsavestate_directory = {quoted}\nsort_savefiles_enable = "false"\nsort_savestates_enable = "false"\nconfig_save_on_exit = "false"\nmicrophone_enable = "false"\n'
            if game['system'] == 'n64':
                # RetroArch INPUT_COMBO_START_SELECT.
                session_config += 'input_menu_toggle_gamepad_combo = "4"\n'
            settings.write_text(session_config)
            with (root / 'last-game.log').open('wb') as log:
                process = subprocess.Popen(['/usr/bin/retroarch', '--verbose', '--fullscreen', '--appendconfig', str(settings), '-L', str(core_path(game['system'])), str(rom)], stdin=subprocess.DEVNULL, stdout=log, stderr=log, cwd=root, start_new_session=True, pass_fds=(lock_file.fileno(),))
            process_game = game['id']
            try:
                code = process.wait(timeout=0.5)
                raise HTTPException(503, f'RetroArch exited immediately (code {code}). See ~/Games/Klinekraft/last-game.log.')
            except subprocess.TimeoutExpired:
                return {'started': True, 'title': game['title']}
        except OSError:
            raise HTTPException(503, 'Unable to start RetroArch. Check the Pi desktop session and Games setup.')
        finally:
            lock_file.close()


class Favorite(BaseModel):
    selected: bool


@router.get('/favorites')
def favorites():
    from .conversations import database
    with database() as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS game_favorites (id TEXT PRIMARY KEY)")
        return [row[0] for row in connection.execute("SELECT id FROM game_favorites")]


@router.put('/favorites/{game_id}')
def set_favorite(game_id: str, body: Favorite):
    from .conversations import database
    if not re.fullmatch('[a-f0-9]{64}', game_id):
        raise HTTPException(400, 'Invalid game ID.')
    with database() as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS game_favorites (id TEXT PRIMARY KEY)")
        if body.selected:
            connection.execute("INSERT OR IGNORE INTO game_favorites VALUES (?)", (game_id,))
        else:
            connection.execute("DELETE FROM game_favorites WHERE id=?", (game_id,))
    return {'saved': True}
