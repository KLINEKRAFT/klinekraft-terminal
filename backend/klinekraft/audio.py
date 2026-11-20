"""Bounded controls for the current PipeWire default output."""
import re
import subprocess
import threading
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from .local_content import local_request

router=APIRouter(prefix='/api/audio',dependencies=[Depends(local_request)])
lock=threading.RLock()
SINK='@DEFAULT_AUDIO_SINK@'

def run(*args):
    try:
        return subprocess.run(['wpctl',*args],capture_output=True,text=True,timeout=3,check=True).stdout
    except (OSError,subprocess.SubprocessError):
        raise HTTPException(503,'Audio output unavailable. Check that the speaker is connected.') from None

@router.get('')
def status():
    with lock:
        value=run('get-volume',SINK)
        match=re.search(r'Volume:\s+([0-9]+(?:\.[0-9]+)?)',value)
        if not match: raise HTTPException(503,'No default audio output is available.')
        return {'volume':round(float(match[1])*100),'muted':'[MUTED]' in value}

class AudioChange(BaseModel):
    model_config=ConfigDict(extra='forbid')
    volume: int | None=Field(default=None,ge=0,le=100,strict=True)
    muted: bool | None=Field(default=None,strict=True)

@router.put('')
def change(body:AudioChange):
    with lock:
        if body.volume is not None: run('set-volume',SINK,f'{body.volume}%')
        if body.muted is not None: run('set-mute',SINK,'1' if body.muted else '0')
        return status()
