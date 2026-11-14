"""Control only the dedicated, preconfigured NetworkManager hotspot profile."""
import json
from pathlib import Path
import subprocess
import threading
from fastapi import APIRouter, Depends, HTTPException, Response
from .local_content import local_request

router=APIRouter(prefix='/api/hotspot',dependencies=[Depends(local_request)])
operation=threading.Lock()
CONFIG=Path.home()/'.config/klinekraft/hotspot.json'

def run(args,timeout=25):
    try:return subprocess.run(args,capture_output=True,text=True,timeout=timeout,check=True).stdout.strip()
    except (OSError,subprocess.SubprocessError):raise HTTPException(503,'Hotspot command failed. Check NetworkManager and the configured profile.')

def config():
    try:return json.loads(CONFIG.read_text())
    except (OSError,ValueError):raise HTTPException(503,'Run hotspot setup on this Pi first.')

@router.get('')
def status(response: Response):
    response.headers["Cache-Control"]="no-store"
    if not CONFIG.is_file():return {'configured':False,'active':False}
    settings=config()
    active=settings['uuid'] in run(['nmcli','-t','-f','UUID','connection','show','--active']).splitlines()
    return {'configured':True,'active':active,'ssid':'Klinekraft Field Library','password':settings['password'],
            'url':'http://10.42.0.1:8090','notice':'Starting switches this Pi away from its current Wi-Fi. Phone access shares only Emergency library collections.'}

@router.post('/start')
def start():
    if not operation.acquire(blocking=False): raise HTTPException(409,'A Wi-Fi change is already in progress.')
    try:
        settings=config()
        previous=run(['nmcli','-g','GENERAL.CON-UUID','device','show','wlan0'])
        try:
            run(['nmcli','connection','up','uuid',settings['uuid']],timeout=40)
            run(['systemctl','--user','start','klinekraft-field-library.service'])
        except HTTPException:
            if previous and previous not in ('--',settings['uuid']):
                try:run(['nmcli','connection','up','uuid',previous],timeout=40)
                except HTTPException:pass
            raise
        return status(Response())
    finally:operation.release()

@router.post('/stop')
def stop():
    settings=config()
    run(['systemctl','--user','stop','klinekraft-field-library.service'])
    active=settings['uuid'] in run(['nmcli','-t','-f','UUID','connection','show','--active']).splitlines()
    if active:run(['nmcli','connection','down','uuid',settings['uuid']])
    return status(Response())
