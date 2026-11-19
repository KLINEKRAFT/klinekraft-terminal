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

def test_gps_requires_fresh_real_fix(monkeypatch):
    import socket
    from datetime import datetime, timezone, timedelta
    from klinekraft.maps import gps_fix
    class GPS:
        def __init__(self,when):self.when=when
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def settimeout(self,*args):pass
        def sendall(self,data):assert b'WATCH' in data
        def recv(self,n):
            if self.when is None:return b''
            value={'class':'TPV','mode':3,'lat':36.15,'lon':-96,'time':self.when.isoformat()};self.when=None
            return (json.dumps(value)+'\n').encode()
    monkeypatch.setattr(socket,'create_connection',lambda *args,**kwargs:GPS(datetime.now(timezone.utc)))
    result=gps_fix();assert result['available'] and result['latitude']==36.15
    monkeypatch.setattr(socket,'create_connection',lambda *args,**kwargs:GPS(datetime.now(timezone.utc)-timedelta(minutes=2)))
    assert not gps_fix()['available']
    def absent(*args,**kwargs):raise OSError('No receiver')
    monkeypatch.setattr(socket,'create_connection',absent)
    assert not gps_fix()['available']


def test_gps_waiting_receiver_and_service_states(monkeypatch):
    import socket
    from klinekraft.maps import gps_fix
    class GPS:
        def __init__(self, values):self.data = ('\n'.join(json.dumps(x) for x in values)+'\n').encode()
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def settimeout(self,*args):pass
        def sendall(self,data):pass
        def recv(self,n):data,self.data=self.data,b'';return data
    values=[{'class':'DEVICES','devices':[{'path':'/dev/ttyACM0'}]}, {'class':'TPV','mode':1}, {'class':'SKY','satellites':[{'used':False}]}]
    monkeypatch.setattr(socket,'create_connection',lambda *a,**kw:GPS(values))
    result=gps_fix()
    assert not result['available'] and 'GPS connected' in result['message']
    assert '1 satellites visible' in result['message']
    assert 'latitude' not in result
    monkeypatch.setattr(socket,'create_connection',lambda *a,**kw:GPS([{'class':'DEVICES','devices':[]}]))
    assert gps_fix()['message']=='GPS receiver not connected'
    def absent(*a,**kw):raise OSError('service unavailable')
    monkeypatch.setattr(socket,'create_connection',absent)
    assert gps_fix()['message']=='GPS service unavailable'


def test_gps_course_and_accuracy_units():
    from datetime import datetime, timezone, timedelta
    from klinekraft.maps import gps_position
    now = datetime.now(timezone.utc)
    value = dict(mode=3, lat=36.15, lon=-96, time=now.isoformat(),
                 speed=2, track=90, eph=3, eps=0.2, epd=10)
    result = gps_position(value, now)
    assert result['courseDegrees'] == 90
    assert abs(result['speedMph'] - 4.47387) < 0.001
    assert abs(result['accuracyFeet'] - 9.84252) < 0.001
    for changes in [dict(speed=0.1), dict(eps=3), dict(epd=60), dict(track=float('nan'))]:
        assert gps_position({**value, **changes}, now)['courseDegrees'] is None
    for changes in [dict(mode=1), dict(lat=float('nan')), dict(lon=181),
                    dict(time=(now-timedelta(seconds=31)).isoformat()),
                    dict(time=(now+timedelta(seconds=10)).isoformat())]:
        assert gps_position({**value, **changes}, now) is None


def test_gps_sky_after_position_and_lost_fix(monkeypatch):
    import socket
    from datetime import datetime, timezone
    from klinekraft.maps import gps_fix
    class GPS:
        def __init__(self, values): self.lines = iter(values)
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def settimeout(self, *args): pass
        def sendall(self, data): pass
        def recv(self, n):
            value = next(self.lines, None)
            return (json.dumps(value)+'\n').encode() if value else b''
    values = [
        dict(class_='TPV', mode=3, lat=36.15, lon=-96, time=datetime.now(timezone.utc).isoformat()),
        dict(class_='SKY', satellites=[dict(used=True), dict(used=False)])
    ]
    values = [{('class' if k == 'class_' else k): v for k, v in item.items()} for item in values]
    monkeypatch.setattr(socket, 'create_connection', lambda *a, **kw: GPS(values))
    result = gps_fix()
    assert result['available'] and result['satellitesVisible'] == 2 and result['satellitesUsed'] == 1
    values.append({'class':'TPV', 'mode':1})
    assert not gps_fix()['available']
