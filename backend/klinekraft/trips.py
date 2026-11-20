"""Opt-in, local GPS trip recording independent of browser page lifetime."""
import asyncio
import math
import threading
from datetime import datetime, timezone
from uuid import uuid4, UUID
from xml.etree import ElementTree as ET
from fastapi import APIRouter, Depends, HTTPException, Response
from .conversations import database
from .local_content import local_request
from .maps import gps_fix, gps_position

router = APIRouter(prefix='/api/trips', dependencies=[Depends(local_request)])
lock = threading.RLock()

def now():
    return datetime.now(timezone.utc).isoformat()

def init(c):
    c.execute("CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, started TEXT NOT NULL, ended TEXT, state TEXT NOT NULL, meters REAL NOT NULL DEFAULT 0)")
    c.execute("CREATE UNIQUE INDEX IF NOT EXISTS one_recording_trip ON trips(state) WHERE state='recording'")
    c.execute("CREATE TABLE IF NOT EXISTS trip_points (trip TEXT NOT NULL, time TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, segment INTEGER NOT NULL, PRIMARY KEY(trip,time))")

def summary(row, c):
    count = c.execute('SELECT count(*) FROM trip_points WHERE trip=?', (row['id'],)).fetchone()[0]
    seconds = max(0, (datetime.fromisoformat(row['ended'] or now())-datetime.fromisoformat(row['started'])).total_seconds())
    return {**dict(row), 'miles': row['meters']/1609.344, 'seconds':round(seconds), 'points':count}

def interrupt():
    with lock, database() as c:
        init(c)
        c.execute("UPDATE trips SET state='interrupted', ended=coalesce((SELECT max(time) FROM trip_points WHERE trip=trips.id),started) WHERE state='recording'")

@router.get('')
def listing():
    with database() as c:
        init(c)
        return [summary(r,c) for r in c.execute('SELECT * FROM trips ORDER BY started DESC LIMIT 100').fetchall()]

@router.post('/start')
def start():
    with lock, database() as c:
        init(c)
        active = c.execute("SELECT * FROM trips WHERE state='recording'").fetchone()
        if active: return summary(active,c)
        ident = str(uuid4())
        c.execute("INSERT INTO trips(id,started,state) VALUES(?,?,'recording')",(ident,now()))
        return summary(c.execute('SELECT * FROM trips WHERE id=?',(ident,)).fetchone(),c)

@router.post('/{ident}/stop')
def stop(ident: UUID):
    with lock, database() as c:
        init(c)
        c.execute("UPDATE trips SET ended=?,state='saved' WHERE id=? AND state='recording'",(now(),str(ident)))
        row = c.execute('SELECT * FROM trips WHERE id=?',(str(ident),)).fetchone()
        if not row: raise HTTPException(404,'Trip not found.')
        return summary(row,c)

def distance(a, b):
    lat1,lon1,lat2,lon2=map(math.radians,(a[0],a[1],b[0],b[1]))
    h=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371000*2*math.asin(min(1,math.sqrt(h)))

def record(ident, fix):
    # Revalidate time/coordinates even if the GPS endpoint already checked them.
    if not fix.get('available'): return
    point=gps_position({'mode':fix.get('mode'),'time':fix.get('fixAt'),
                        'lat':fix.get('latitude'),'lon':fix.get('longitude')},datetime.now(timezone.utc))
    if not point or (fix.get('accuracyFeet') or 0)>300: return
    with lock, database() as c:
        init(c)
        active=c.execute("SELECT * FROM trips WHERE id=? AND state='recording'",(ident,)).fetchone()
        if not active or point['fixAt'] < active['started']: return
        count=c.execute('SELECT count(*) FROM trip_points WHERE trip=?',(ident,)).fetchone()[0]
        if count>=100000:
            c.execute("UPDATE trips SET state='limit reached',ended=? WHERE id=?",(now(),ident))
            return
        previous=c.execute('SELECT * FROM trip_points WHERE trip=? ORDER BY time DESC LIMIT 1',(ident,)).fetchone()
        segment,meters=0,0
        if previous:
            elapsed=(datetime.fromisoformat(point['fixAt'])-datetime.fromisoformat(previous['time'])).total_seconds()
            if elapsed<=0: return
            segment=previous['segment']
            meters=distance((previous['lat'],previous['lon']),(point['latitude'],point['longitude']))
            if elapsed>30:
                segment+=1
                meters=0
            elif meters/elapsed>100: return  # Reject implausible road-travel jumps.
            elif meters<5 or (fix.get('speedMph') is not None and fix['speedMph']<0.7 and meters<25):
                return
        c.execute('INSERT INTO trip_points VALUES(?,?,?,?,?)',(ident,point['fixAt'],point['latitude'],point['longitude'],segment))
        c.execute('UPDATE trips SET meters=meters+? WHERE id=?',(meters,ident))

def active_trip():
    with database() as c:
        init(c)
        row=c.execute("SELECT id FROM trips WHERE state='recording'").fetchone()
        return dict(row) if row else None

async def monitor():
    while True:
        try:
            active=await asyncio.to_thread(active_trip)
            if active:
                fix=await asyncio.to_thread(gps_fix)
                await asyncio.to_thread(record,active['id'],fix)
        except HTTPException:
            pass  # Storage failure does not crash the recorder; UI requests report it.
        await asyncio.sleep(5)

@router.get('/{ident}')
def detail(ident: UUID):
    with database() as c:
        init(c)
        row=c.execute('SELECT * FROM trips WHERE id=?',(str(ident),)).fetchone()
        if not row: raise HTTPException(404,'Trip not found.')
        segments=[]
        for p in c.execute('SELECT * FROM trip_points WHERE trip=? ORDER BY time',(str(ident),)):
            if p['segment']>=len(segments): segments.append([])
            segments[-1].append({'latitude':p['lat'],'longitude':p['lon'],'time':p['time']})
        return {**summary(row,c),'segments':segments}

@router.get('/{ident}/gpx')
def export(ident: UUID):
    trip=detail(ident)
    root=ET.Element('gpx',{'version':'1.1','creator':'Klinekraft Terminal','xmlns':'http://www.topografix.com/GPX/1/1'})
    track=ET.SubElement(root,'trk')
    ET.SubElement(track,'name').text='Klinekraft trip '+trip['started']
    for segment in trip['segments']:
        seg=ET.SubElement(track,'trkseg')
        for p in segment:
            pt=ET.SubElement(seg,'trkpt',{'lat':str(p['latitude']),'lon':str(p['longitude'])})
            ET.SubElement(pt,'time').text=p['time']
    return Response(ET.tostring(root,encoding='utf-8',xml_declaration=True),media_type='application/gpx+xml',
                    headers={'Content-Disposition':f'attachment; filename="klinekraft-trip-{ident}.gpx"','Cache-Control':'no-store'})
