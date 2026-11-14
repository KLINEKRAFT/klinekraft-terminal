"""Bounded loopback client for BRouter; never proxies arbitrary URLs."""
import json
import threading
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4
from .conversations import database
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from .local_content import local_request

router = APIRouter(prefix='/api/routing', dependencies=[Depends(local_request)])
ROOT = Path.home()/'.local/share/klinekraft/routing'
busy = threading.Lock()

class Point(BaseModel):
    model_config = ConfigDict(extra='forbid')
    longitude: float = Field(ge=-180,le=180,allow_inf_nan=False)
    latitude: float = Field(ge=-85,le=85,allow_inf_nan=False)

class Route(BaseModel):
    model_config = ConfigDict(extra='forbid')
    start: Point
    end: Point
    profile: Literal['car-fast','trekking','shortest'] = 'car-fast'

@router.get('/status')
def status():
    return {'installed':(ROOT/'brouter-1.7.10/brouter-1.7.10-all.jar').is_file(),
            'coverageReady':(ROOT/'coverage.json').is_file(),
            'segments':len(list((ROOT/'segments4').glob('*.rd5'))),
            'region':'Lower 48 and Alaska; no Hawaii. Border areas included.'}

@router.post('/route')
def route(body: Route):
    if not busy.acquire(blocking=False): raise HTTPException(429,'A route is already being calculated.')
    try:
        params = urllib.parse.urlencode({'lonlats':f'{body.start.longitude},{body.start.latitude}|{body.end.longitude},{body.end.latitude}',
            'profile':body.profile,'alternativeidx':0,'format':'geojson'})
        request = urllib.request.Request('http://127.0.0.1:17777/brouter?'+params)
        from .assistant import NoRedirect
        try:
            with urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()).open(request,timeout=50) as response:
                raw=response.read(4_000_001)
                if len(raw)>4_000_000: raise HTTPException(413,'Route is too detailed. Plan a shorter leg.')
                result=json.loads(raw)
            if result.get('type')!='FeatureCollection' or not result.get('features'): raise ValueError()
            with database() as c:
                init(c)
                c.execute('INSERT INTO saved_routes(id,created,profile,payload) VALUES(?,?,?,?)', (str(uuid4()),datetime.now(timezone.utc).isoformat(),body.profile,json.dumps(result)))
            return result
        except urllib.error.HTTPError:
            raise HTTPException(422,'No route found. Choose points on roads or trails within installed coverage, or plan a shorter leg.')
        except (OSError,urllib.error.URLError):
            raise HTTPException(503,'Offline routing is unavailable or timed out. Check the routing service or try a shorter leg.')
        except (ValueError,KeyError,TypeError):
            raise HTTPException(502,'The routing engine returned an unreadable route.')
    finally: busy.release()


def init(c):
    c.execute('CREATE TABLE IF NOT EXISTS saved_routes (id TEXT PRIMARY KEY, created TEXT NOT NULL, profile TEXT NOT NULL, payload TEXT NOT NULL)')

@router.get('/saved')
def saved():
    with database() as c:
        init(c)
        return [dict(r) for r in c.execute('SELECT id,created,profile FROM saved_routes ORDER BY created DESC LIMIT 50')]

@router.get('/saved/{route_id}')
def saved_route(route_id: str):
    with database() as c:
        init(c)
        row=c.execute('SELECT payload FROM saved_routes WHERE id=?',(route_id,)).fetchone()
    if row is None:raise HTTPException(404,'Saved route not found.')
    return json.loads(row[0])
