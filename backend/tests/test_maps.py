import json
from uuid import uuid4
from fastapi.testclient import TestClient
from klinekraft.main import app

HEADERS = {'X-Klinekraft-Client': 'local-ui'}

def test_local_map_ranges_and_font_paths(monkeypatch, tmp_path):
    monkeypatch.setenv('KLINEKRAFT_MAPS_DIR', str(tmp_path))
    (tmp_path / 'region.pmtiles').write_bytes(b'PMTiles' + bytes(range(100)))
    (tmp_path / 'region.json').write_text(json.dumps({'title': 'Fixture'}))
    (tmp_path / 'fonts').mkdir()
    (tmp_path / 'fonts/0-255.pbf').write_bytes(b'font')
    with TestClient(app, base_url='http://127.0.0.1') as client:
        assert client.get('/api/maps').status_code == 403
        assert client.get('/api/maps', headers=HEADERS).json()['available']
        result = client.get('/api/maps/region.pmtiles', headers={**HEADERS, 'Range':'bytes=0-6'})
        assert result.status_code == 206 and result.content == b'PMTiles'
        assert result.headers['content-range'] == 'bytes 0-6/107'
        assert client.get('/api/maps/fonts/Noto%20Sans%20Regular/0-255.pbf', headers=HEADERS).content == b'font'
        assert client.get('/api/maps/fonts/Noto%20Sans%20Regular/1-256.pbf', headers=HEADERS).status_code == 404
        assert client.get('/api/maps/fonts/other/0-255.pbf', headers=HEADERS).status_code == 404

def test_places_persist_and_validate(monkeypatch, tmp_path):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR', str(tmp_path))
    place = {'id':str(uuid4()), 'name':'Test pin', 'latitude':36.15, 'longitude':-95.99}
    with TestClient(app, base_url='http://127.0.0.1') as client:
        assert client.post('/api/maps/places', headers=HEADERS, json=place).status_code == 200
        assert client.post('/api/maps/places', headers=HEADERS, json=place).status_code == 200
        assert client.post('/api/maps/places', headers=HEADERS, json={**place,'name':'Changed'}).status_code == 409
        assert client.post('/api/maps/places', headers=HEADERS, json={**place,'latitude':91}).status_code == 422
        assert client.post('/api/maps/places', headers=HEADERS, json={**place,'name':'   '}).status_code == 422
    with TestClient(app, base_url='http://127.0.0.1') as client:
        assert client.get('/api/maps/places', headers=HEADERS).json() == [place]
