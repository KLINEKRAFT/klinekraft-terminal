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
