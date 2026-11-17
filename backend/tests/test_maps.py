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

def test_address_search_cached_privately_and_handles_offline(monkeypatch, tmp_path):
    from klinekraft import maps
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR', str(tmp_path))
    point = {'name': 'TEST ADDRESS', 'latitude': 36.1, 'longitude': -96.0}
    calls = []
    def lookup(address):
        calls.append(address)
        return [point]
    monkeypatch.setattr(maps, 'census_lookup', lookup)
    with TestClient(app, base_url='http://127.0.0.1') as client:
        assert client.post('/api/maps/search', json={'address': 'Test address'}).status_code == 403
        first = client.post('/api/maps/search', headers=HEADERS, json={'address': 'Test address'}).json()
        assert first['results'] == [point] and not first['cached']
        def offline(address): raise OSError('upstream error with private address')
        monkeypatch.setattr(maps, 'census_lookup', offline)
        cached = client.post('/api/maps/search', headers=HEADERS, json={'address': ' TEST  ADDRESS '}).json()
        assert cached['cached'] and cached['results'] == [point]
        assert len(calls) == 1
        failure = client.post('/api/maps/search', headers=HEADERS, json={'address': 'New address'})
        assert failure.status_code == 503 and 'private address' not in failure.text
        assert client.post('/api/maps/search', headers=HEADERS, json={'address': 'x'*101}).status_code == 422


def test_offline_catalog_complete_and_public_only():
    from klinekraft.maps import catalog
    data = catalog()
    groups = {g['id'] for g in data['groups']}
    assert len({p['id'] for p in data['places']}) == len(data['places'])
    assert len([p for p in data['places'] if p['group'] == 'national-parks']) >= 61
    for p in data['places']:
        assert p['group'] in groups and p['url'].startswith('https://')
        assert -180 <= p['longitude'] <= 180 and -85 <= p['latitude'] <= 85
        assert p['name'] != 'Home'
