from datetime import datetime, timezone, timedelta
from uuid import UUID
from xml.etree import ElementTree as ET
from klinekraft import trips
from klinekraft.conversations import database

def setup(monkeypatch,tmp_path):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR',str(tmp_path))
    trip=trips.start()
    with database() as c:
        c.execute('UPDATE trips SET started=?',( (datetime.now(timezone.utc)-timedelta(minutes=5)).isoformat(),))
    return trip['id']

def fix(age=0,lat=36,lon=-96,**kw):
    return dict(available=True,mode=3,fixAt=(datetime.now(timezone.utc)-timedelta(seconds=age)).isoformat(),
                latitude=lat,longitude=lon,speedMph=30,accuracyFeet=20,**kw)

def test_trip_lifecycle_and_export(monkeypatch,tmp_path):
    ident=setup(monkeypatch,tmp_path)
    assert trips.start()['id']==ident
    trips.record(ident,fix(age=10))
    trips.record(ident,fix(lon=-95.999))
    result=trips.detail(UUID(ident))
    assert result['points']==2 and 0.05<result['miles']<0.06
    trips.stop(UUID(ident))
    trips.record(ident,fix(lon=-95.998))
    assert trips.detail(UUID(ident))['points']==2
    root=ET.fromstring(trips.export(UUID(ident)).body)
    assert len(root.findall('.//{*}trkpt'))==2
    assert root.find('.//{*}time').text
    assert trips.start()['id']!=ident

def test_trip_rejects_bad_fixes_and_splits_gaps(monkeypatch,tmp_path):
    ident=setup(monkeypatch,tmp_path)
    trips.record(ident,fix(age=90))
    trips.record(ident,fix(lat=float('nan')))
    poor=fix();poor['accuracyFeet']=500
    trips.record(ident,poor)
    assert trips.detail(UUID(ident))['points']==0
    trips.record(ident,fix(age=20))
    with database() as c:
        c.execute('UPDATE trip_points SET time=?',((datetime.now(timezone.utc)-timedelta(seconds=60)).isoformat(),))
    trips.record(ident,fix(lon=-95.9))
    result=trips.detail(UUID(ident))
    assert len(result['segments'])==2 and result['miles']==0
    trips.interrupt()
    assert trips.detail(UUID(ident))['state']=='interrupted'
    assert trips.active_trip() is None

def test_jitter_duplicates_and_jump_do_not_add_distance(monkeypatch,tmp_path):
    ident=setup(monkeypatch,tmp_path)
    point=fix(age=5)
    trips.record(ident,point)
    trips.record(ident,point)
    trips.record(ident,fix(lon=-95.999999))
    trips.record(ident,fix(lon=-90))
    assert trips.detail(UUID(ident))['points']==1


def test_background_monitor_records_without_browser(monkeypatch,tmp_path):
    import asyncio
    import pytest
    ident=setup(monkeypatch,tmp_path)
    monkeypatch.setattr(trips,'gps_fix',lambda:fix())
    async def finish(_):
        raise asyncio.CancelledError()
    monkeypatch.setattr(trips.asyncio,'sleep',finish)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(trips.monitor())
    assert trips.detail(UUID(ident))['points']==1
