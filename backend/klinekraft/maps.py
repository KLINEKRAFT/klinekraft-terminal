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
