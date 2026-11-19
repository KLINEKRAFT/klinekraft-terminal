"""Local offline map archive, fonts and saved places. No remote tile proxy."""
import json
import os
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ConfigDict
from .local_content import local_request
from .conversations import database

router = APIRouter(prefix='/api/maps', dependencies=[Depends(local_request)])

def root():
    return Path(os.environ.get('KLINEKRAFT_MAPS_DIR', str(Path.home() / '.local/share/klinekraft/maps')))

@router.get('')
def metadata():
    try:
        manifest = json.loads((root() / 'region.json').read_text())
        archive = root() / 'region.pmtiles'
        if not archive.is_file() or archive.is_symlink(): raise ValueError()
        return {**manifest, 'available': True, 'bytes': archive.stat().st_size}
    except (OSError, ValueError):
        return {'available': False}

@router.get('/region.pmtiles')
def tiles():
    path = root() / 'region.pmtiles'
    if not path.is_file() or path.is_symlink(): raise HTTPException(404, 'Offline region is not installed.')
    return FileResponse(path, media_type='application/octet-stream', headers={'Cache-Control': 'no-cache'})

@router.get('/fonts/{fontstack}/{block}.pbf')
def font(fontstack: str, block: str):
    import re
    match = re.fullmatch(r'(\d{1,5})-(\d{1,5})', block)
    if fontstack != 'Noto Sans Regular' or not match: raise HTTPException(404)
    start, end = map(int, match.groups())
    if start % 256 or end != start + 255 or end > 65535: raise HTTPException(404)
    path = root() / 'fonts' / f'{start}-{end}.pbf'
    if not path.is_file() or path.is_symlink(): raise HTTPException(404)
    return FileResponse(path, media_type='application/x-protobuf', headers={'Cache-Control': 'public, max-age=86400'})

class Place(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: UUID
    name: str = Field(min_length=1, max_length=120, pattern=r'.*\S.*')
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    latitude: float = Field(ge=-85, le=85, allow_inf_nan=False)

def init(connection):
    connection.execute('CREATE TABLE IF NOT EXISTS map_places (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')

@router.get('/places')
def places():
    with database() as connection:
        init(connection)
        return [json.loads(row[0]) for row in connection.execute('SELECT payload FROM map_places ORDER BY rowid DESC')]

@router.post('/places')
def save_place(place: Place):
    with database() as connection:
        init(connection)
        old = connection.execute('SELECT payload FROM map_places WHERE id=?', (str(place.id),)).fetchone()
        if old is not None and json.loads(old[0]) != json.loads(place.model_dump_json()):
            raise HTTPException(409, 'This place ID is already used.')
        connection.execute('INSERT OR IGNORE INTO map_places VALUES (?, ?)', (str(place.id), place.model_dump_json()))
    return place

class AddressQuery(BaseModel):
    model_config = ConfigDict(extra='forbid')
    address: str = Field(min_length=3, max_length=100, pattern=r'.*\S.*')


def census_lookup(address):
    """Fixed public endpoint; no caller-controlled URL."""
    import urllib.parse
    import urllib.request
    query = urllib.parse.urlencode({'address': address, 'benchmark': 'Public_AR_Current', 'format': 'json'})
    request = urllib.request.Request('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' + query,
                                    headers={'User-Agent': 'KlinekraftTerminal/1.0'})
    with urllib.request.urlopen(request, timeout=12) as response:
        raw = response.read(1_000_001)
    if len(raw) > 1_000_000:
        raise ValueError('Response too large')
    matches = json.loads(raw)['result']['addressMatches']
    results = []
    for match in matches[:8]:
        point = Place(id=UUID(int=0), name=match['matchedAddress'][:120],
                      longitude=match['coordinates']['x'], latitude=match['coordinates']['y'])
        results.append(point.model_dump(mode='json', exclude={'id'}))
    return results


@router.post('/search')
def search_address(query: AddressQuery):
    import time
    key = ' '.join(query.address.lower().split())
    with database() as connection:
        connection.execute('CREATE TABLE IF NOT EXISTS map_geocodes (query TEXT PRIMARY KEY, payload TEXT NOT NULL, updated REAL NOT NULL)')
        row = connection.execute('SELECT payload, updated FROM map_geocodes WHERE query=?', (key,)).fetchone()
    if row:
        return {'results': json.loads(row[0]), 'cached': True, 'updated': row[1]}
    try:
        results = census_lookup(query.address.strip())
    except Exception:
        # Do not expose the address or upstream request in errors/logs.
        raise HTTPException(503, 'Address service unavailable. Previously searched addresses and saved places still work offline.') from None
    updated = time.time()
    if results:
        with database() as connection:
            connection.execute('INSERT OR REPLACE INTO map_geocodes VALUES (?, ?, ?)', (key, json.dumps(results), updated))
    return {'results': results, 'cached': False, 'updated': updated}


@router.get('/catalog')
def catalog():
    path = Path(__file__).parent / 'data' / 'map-catalog.json'
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        raise HTTPException(503, 'Map collections are not installed.') from None

def gps_number(value, minimum=0, maximum=float('inf')):
    import math
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value if math.isfinite(value) and minimum <= value <= maximum else None


def gps_position(value, now):
    """Only a fresh position can supply navigation, speed or course."""
    import math
    from datetime import datetime
    try:
        mode = value.get('mode', 0)
        if mode not in (2, 3): return None
        at = datetime.fromisoformat(str(value.get('time', '')).replace('Z', '+00:00'))
        if at.tzinfo is None or not -5 <= (now-at).total_seconds() <= 30: return None
        lat = gps_number(value.get('lat'), -90, 90)
        lon = gps_number(value.get('lon'), -180, 180)
        if lat is None or lon is None: return None
        speed = gps_number(value.get('speed'))
        course = gps_number(value.get('track'), 0, 360)
        speed_error = gps_number(value.get('eps'))
        course_error = gps_number(value.get('epd'))
        # Course over ground is not the direction the stationary deck faces.
        moving = speed is not None and speed >= 1 and (speed_error is None or speed > speed_error)
        if not moving or (course_error is not None and course_error > 45): course = None
        accuracy = gps_number(value.get('eph'))
        x, y = gps_number(value.get('epx')), gps_number(value.get('epy'))
        if accuracy is None and x is not None and y is not None: accuracy = math.hypot(x, y)
        return {'latitude':lat, 'longitude':lon, 'fixAt':at.isoformat(), 'mode':mode,
                'speedMph':speed * 2.2369362921 if speed is not None else None,
                'courseDegrees':course % 360 if course is not None else None,
                'accuracyFeet':accuracy * 3.280839895 if accuracy is not None else None}
    except (ValueError, TypeError, OverflowError):
        return None


@router.get('/gps')
def gps_fix():
    """Bounded, read-only receiver snapshot. No location history is written."""
    import socket
    import time
    from datetime import datetime, timezone
    connected = service = False
    satellites = used = None
    position = None
    try:
        with socket.create_connection(('127.0.0.1', 2947), timeout=0.7) as sock:
            service = True
            sock.sendall(b'?WATCH={"enable":true,"json":true};\n')
            buffer = b''
            received = 0
            deadline = time.monotonic() + 1.5
            while time.monotonic() < deadline and received < 65536:
                sock.settimeout(max(0.05, deadline - time.monotonic()))
                try: chunk = sock.recv(8192)
                except socket.timeout: continue
                if not chunk: break
                received += len(chunk)
                buffer += chunk
                while b'\n' in buffer:
                    line, buffer = buffer.split(b'\n', 1)
                    try: value = json.loads(line)
                    except ValueError: continue
                    if not isinstance(value, dict): continue
                    kind = value.get('class')
                    if kind == 'DEVICES':
                        connected = bool(value.get('devices'))
                        if not connected: position = None
                    if kind == 'SKY':
                        connected = True
                        sky = value.get('satellites')
                        if isinstance(sky, list):
                            satellites = len(sky)
                            used = sum(1 for sat in sky if isinstance(sat, dict) and sat.get('used') is True)
                    if kind == 'TPV':
                        connected = True
                        # A later loss of fix invalidates an earlier valid report.
                        position = gps_position(value, datetime.now(timezone.utc))
    except OSError:
        position = None
    result = {'available':position is not None, 'connected':connected, 'service':service,
              'satellitesVisible':satellites, 'satellitesUsed':used,
              'sampledAt':datetime.now(timezone.utc).isoformat()}
    if position:
        return {**result, **position, 'message':'GPS fix · ' + ('3D' if position['mode'] == 3 else '2D')}
    if connected:
        detail = f' · {satellites} satellites visible' if satellites is not None else ''
        return {**result, 'message':'GPS connected · waiting for a fresh satellite fix' + detail}
    return {**result, 'message':'GPS receiver not connected' if service else 'GPS service unavailable'}
