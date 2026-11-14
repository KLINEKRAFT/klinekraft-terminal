"""Local controls for a fixed, opt-in AirPlay receiver."""
from pathlib import Path
import secrets
import shutil
import subprocess
import threading
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from .local_content import local_request

router = APIRouter(prefix='/api/casting', dependencies=[Depends(local_request)])
CONFIG = Path.home() / '.config/klinekraft/uxplayrc'
UNIT = 'klinekraft-cast.service'
operation = threading.Lock()

class Options(BaseModel):
    fullscreen: bool = True

def control(action):
    try:
        subprocess.run(['systemctl', '--user', action, UNIT], check=True,
                       capture_output=True, timeout=15)
    except (OSError, subprocess.SubprocessError):
        raise HTTPException(503, 'Screen Cast could not change state. Check klinekraft-cast.service.')

def state():
    try:
        result = subprocess.run(['systemctl', '--user', 'show', UNIT,
                                 '--property=ActiveState', '--value'], capture_output=True, text=True, timeout=3)
        return result.stdout.strip() or 'unavailable'
    except (OSError, subprocess.SubprocessError):
        return 'unavailable'

@router.get('')
def status(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    lines = CONFIG.read_text().splitlines() if CONFIG.is_file() else []
    active = state()
    return {'installed': bool(shutil.which('uxplay') and lines),
            'active': active == 'active', 'state': active, 'name': 'Klinekraft Deck',
            'fullscreen': 'fs' in lines,
            'pin': next((line[4:] for line in lines if line.startswith('pin ')), '') if active == 'active' else ''}

@router.post('/start')
def start(options: Options, response: Response):
    if not operation.acquire(blocking=False):
        raise HTTPException(409, 'Screen Cast is already changing state.')
    try:
        if not shutil.which('uxplay') or not CONFIG.is_file():
            raise HTTPException(503, 'Run scripts/setup-casting.sh first.')
        # Stop before replacing configuration. Each start gets a new pairing PIN.
        control('stop')
        lines = ['n "Klinekraft Deck"', 'nh', 's 1024x600@30', 'fps 30',
                 'avdec', 'vs waylandsink', 'as pulsesink', 'nofreeze',
                 'pin ' + str(secrets.randbelow(9000) + 1000)]
        if options.fullscreen:
            lines.append('fs')
        CONFIG.write_text('\n'.join(lines) + '\n')
        CONFIG.chmod(0o600)
        control('start')
        return status(response)
    finally:
        operation.release()

@router.post('/stop')
def stop(response: Response):
    if not operation.acquire(blocking=False):
        raise HTTPException(409, 'Screen Cast is already changing state.')
    try:
        control('stop')
        return status(response)
    finally:
        operation.release()
