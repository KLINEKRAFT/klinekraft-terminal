"""Validated settings for the optional desktop idle service. No arbitrary commands."""
import json
import os
import subprocess
import threading
from pathlib import Path
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from .local_content import local_request

router = APIRouter(prefix='/api/desktop-away', dependencies=[Depends(local_request)])
CONFIG = Path.home()/'.config/klinekraft/desktop-away.json'
BLANK = Path(os.environ.get('XDG_RUNTIME_DIR', f'/run/user/{os.getuid()}'))/'klinekraft-away-blank'
UNIT = Path.home()/'.config/systemd/user/klinekraft-idle.service'
lock = threading.Lock()
Color = Annotated[str, Field(pattern=r'^#[0-9a-fA-F]{6}$')]

class Preferences(BaseModel):
    background: Literal['gradient', 'contour', 'chrome'] = 'gradient'
    colors: tuple[Color, Color, Color] = ('#080b10', '#28303b', '#10131b')
    ink: Color = '#f2f0ea'
    message: str = Field(default='', max_length=160)
    ticker: bool = False
    font: Literal['sans', 'mono'] = 'sans'
    paused: bool = False
    logo: bool = True
    idleMinutes: Literal[0, 1, 2, 5, 10] = 2

def read():
    try: return Preferences.model_validate_json(CONFIG.read_text())
    except (OSError, ValueError): return Preferences()

def write(preferences):
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    temporary = CONFIG.with_suffix('.tmp')
    temporary.write_text(preferences.model_dump_json())
    temporary.chmod(0o600)
    temporary.replace(CONFIG)

@router.get('')
def status(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    preferences = read()
    return {'installed': UNIT.is_file(), 'preferences': preferences.model_dump(),
            'displayBlankMinutes': max(5, preferences.idleMinutes + 3) if preferences.idleMinutes else 0,
            'hardwareDisplayOff': False, 'blank': BLANK.is_file()}

@router.post('')
def update(preferences: Preferences):
    if not UNIT.is_file(): raise HTTPException(409, 'Desktop Away is not installed.')
    with lock:
        previous = read()
        write(preferences)
        try:
            subprocess.run(['systemctl', '--user', 'restart', 'klinekraft-idle.service'],
                           check=True, capture_output=True, timeout=15)
        except (OSError, subprocess.SubprocessError):
            write(previous)
            raise HTTPException(503, 'Desktop Away could not restart. Previous settings restored.')
    return status(Response())
