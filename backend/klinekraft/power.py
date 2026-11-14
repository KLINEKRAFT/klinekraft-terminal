"""Field mode and measured discharge trend. No arbitrary OS commands."""
import asyncio
import json
from pathlib import Path
import subprocess
import threading
import time
import urllib.request
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from .battery import read_battery, read_external_power
from .local_content import local_request
from .power_policy import valid, runtime_minutes

router = APIRouter(prefix='/api/power', dependencies=[Depends(local_request)])
ROOT = Path.home()/'.local/state/klinekraft/power'
samples = []
lock = threading.Lock()
last_ai = 0.0
ai_users = 0

def settings():
    try: return json.loads((ROOT/'settings.json').read_text())
    except (OSError, ValueError): return {'field': False}

def service(action, name):
    try: subprocess.run(['systemctl','--user',action,'klinekraft-'+name+'.service'],check=True,capture_output=True,timeout=15)
    except (OSError, subprocess.SubprocessError): raise HTTPException(503, 'Could not change '+name+' service.')

def available():
    return (Path.home()/'.config/systemd/user/klinekraft-ai.service').is_file()

def wake_ai():
    global ai_users, last_ai
    with lock:
        ai_users += 1
        last_ai = time.monotonic()
    try:
        service('start','ai')
        for _ in range(60):
            try:
                with urllib.request.build_opener(urllib.request.ProxyHandler({})).open('http://127.0.0.1:8082/health',timeout=1) as r:
                    if r.status == 200: return
            except OSError: pass
            time.sleep(1)
        raise HTTPException(503,'Offline model is still warming up. Try again shortly.')
    except Exception:
        release_ai()
        raise

def release_ai():
    global ai_users, last_ai
    with lock:
        ai_users = max(0, ai_users-1)
        last_ai = time.monotonic()

class FieldMode(BaseModel):
    enabled: bool

@router.post('/field')
def field(body: FieldMode):
    with lock:
        if body.enabled:
            if ai_users: raise HTTPException(409,'Wait for the current AI answer before enabling Field mode.')
            service('stop','ai'); service('stop','cast')
        else:
            service('start','ai')
        ROOT.mkdir(parents=True,exist_ok=True)
        (ROOT/'settings.json').write_text(json.dumps({'field':body.enabled}))
    return status(Response())

@router.get('')
def status(response: Response):
    response.headers['Cache-Control']='no-store'
    reading=read_battery(); p=reading['battery_percent']
    try:
        guard=json.loads(Path('/run/klinekraft-battery-guard.json').read_text())
        if time.time()-guard['sampledAt']>30: guard=None
    except (OSError,ValueError,KeyError): guard=None
    return {**settings(), 'percent':p,'voltage':reading['battery_voltage'],
            'warning':None if guard and guard.get('externalPower') else 'critical' if p is not None and p<=15 else 'low' if p is not None and p<=25 else None,
            'reserveMinutes':None if guard and guard.get('externalPower') else runtime_minutes(samples),'sampleCount':len(samples), 'guard':guard,
            'dimming':'Terminal visual dimming only; hardware backlight control unavailable'}

def sample():
    global samples
    r=read_battery();p,v=r['battery_percent'],r['battery_voltage']
    if not valid(p,v) or read_external_power() is True:
        samples=[]
        with lock:
            if settings()['field'] and not ai_users and time.monotonic()-last_ai>120:
                service('stop','ai')
        return
    now=time.time()
    # Reset on a charge increase or a long gap. Keep a rolling 30-minute window.
    if samples and (p>samples[-1]['percent']+.3 or now-samples[-1]['time']>90): samples=[]
    samples=[s for s in samples if now-s['time']<=1800]
    samples.append({'time':now,'percent':p,'voltage':v})
    ROOT.mkdir(parents=True,exist_ok=True)
    (ROOT/'trend.json').write_text(json.dumps(samples))
    with lock:
        if settings()['field'] and not ai_users and time.monotonic()-last_ai>120:
            service('stop','ai')

async def monitor():
    while True:
        try: await asyncio.to_thread(sample)
        except Exception: pass
        await asyncio.sleep(60)
