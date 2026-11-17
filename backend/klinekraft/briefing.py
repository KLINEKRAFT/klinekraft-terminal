"""Bounded public science feeds, persisted snapshots, and explicit research search."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import math
import os
import re
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from .local_content import local_request
from .conversations import db_path, database
from . import research

router = APIRouter(prefix='/api/briefing', dependencies=[Depends(local_request)])
lock = threading.Lock()
ack_lock = threading.Lock()
UA = 'KlinekraftTerminal/1.0 (https://github.com/KLINEKRAFT/klinekraft-terminal)'

class Settings(BaseModel):
    enabled: bool = True
    ticker: bool = True
    location: str = Field(default='Tulsa, Oklahoma', max_length=80)
    latitude: float = Field(default=36.154, ge=-90, le=90)
    longitude: float = Field(default=-95.993, ge=-180, le=180)
    radiusMiles: int = Field(default=300, ge=10, le=3000)
    magnitude: float = Field(default=2.5, ge=2.5, le=9)
    globalMagnitude: float = Field(default=6, ge=4.5, le=9)

def root():
    path = db_path().parent/'briefing'
    path.mkdir(parents=True, exist_ok=True)
    return path

def read(name, default=None):
    try: return json.loads((root()/name).read_text())
    except (OSError, ValueError): return default

def write(name, value):
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', dir=root(), delete=False) as out:
        json.dump(value, out)
    Path(out.name).replace(root()/name)

def settings():
    try: return Settings(**read('settings.json', {}))
    except ValueError: return Settings()

@router.put('/settings')
def save_settings(body: Settings):
    write('settings.json', body.model_dump())
    return body.model_dump()

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=12) as response:
        raw = response.read(4_000_001)
    if len(raw)>4_000_000: raise ValueError('Response too large')
    return json.loads(raw)

def cached(name, url, ttl, transform=lambda v:v):
    old = read(name+'.json', {})
    now = time.time()
    retry_delay = min(ttl,3600) if old.get('error') else min(ttl,120)
    if now-old.get('attempt',0)<retry_delay: return old
    needs_upgrade = name.startswith('forecast-') and bool(old.get('data')) and 'weather_code' not in (old['data'].get('current') or {})
    if now-old.get('updated',0)<ttl and not old.get('error') and not needs_upgrade: return old
    result = {**old, 'attempt':now}
    try: result = {'data': transform(fetch(url)), 'updated':now, 'attempt':now, 'error':None}
    except Exception as error: result['error'] = f'{type(error).__name__}: source unavailable'
    write(name+'.json', result)
    return result

def miles(lat, lon, lat2, lon2):
    a,b=map(math.radians,(lat,lat2));d=math.radians(lon2-lon)
    h=math.sin((b-a)/2)**2+math.cos(a)*math.cos(b)*math.sin(d/2)**2
    return 3958.8*2*math.asin(min(1,math.sqrt(h)))

def stamp(value):
    try: return datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()
    except (ValueError,TypeError,AttributeError): return 0

def nws(data):
    rows=[]
    for item in data.get('features',[]):
        p=item['properties']
        if p.get('status')!='Actual' or p.get('messageType')=='Cancel': continue
        rows.append({'id':item.get('id'), 'kind':'Weather', 'title':p.get('headline') or p.get('event'), 'severity':p.get('severity','Unknown'), 'text':(p.get('description') or '')+'\n'+(p.get('instruction') or ''), 'issued':stamp(p.get('sent')), 'expires':stamp(p.get('expires')), 'url':p.get('@id') or item.get('id'), 'source':'National Weather Service'})
    return rows

def quakes(data):
    return [{'id':v['id'],'kind':'Earthquake','title':re.sub(r'(\d+(?:\.\d+)?) km',lambda m:f'{round(float(m[1])*0.621371)} mi',v['properties']['title']),'severity':'Info','text':f"Magnitude {v['properties']['mag']}. Depth {round(v['geometry']['coordinates'][2]*0.621371,1)} miles.",'issued':v['properties']['time']/1000,'expires':v['properties']['time']/1000+86400,'url':v['properties']['url'],'source':'USGS','magnitude':v['properties']['mag'],'longitude':v['geometry']['coordinates'][0],'latitude':v['geometry']['coordinates'][1]} for v in data.get('features',[]) if isinstance(v['properties'].get('mag'),(int,float))]

def space(data):
    rows=[]
    for v in data[:30]:
        message=v.get('message','');issued=stamp(v.get('issue_datetime','')+'+00:00')
        title=next((line.strip() for line in message.splitlines() if re.search(r'(WATCH|WARNING|ALERT):',line)), 'Space weather bulletin')
        rows.append({'id':v['product_id']+str(issued),'kind':'Space weather','title':title,'severity':'Info','text':message,'issued':issued,'expires':issued+86400,'url':'https://www.spaceweather.gov/','source':'NOAA SWPC'})
    return rows

def loc_key(s): return hashlib.sha256(f'{s.latitude},{s.longitude}'.encode()).hexdigest()[:12]

def refresh():
    s=settings()
    if not s.enabled or not lock.acquire(False): return
    try:
        coord=urllib.parse.urlencode({'latitude':s.latitude,'longitude':s.longitude,'current':'temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m','daily':'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset,precipitation_sum,wind_speed_10m_max','hourly':'temperature_2m,precipitation_probability,wind_speed_10m,weather_code','temperature_unit':'fahrenheit','wind_speed_unit':'mph','precipitation_unit':'inch','timezone':'auto','forecast_days':7})
        key=loc_key(s)
        jobs=[('nws-'+key,f'https://api.weather.gov/alerts/active?point={s.latitude},{s.longitude}',120,nws),('earthquakes','https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',120,quakes),('space','https://services.swpc.noaa.gov/products/alerts.json',300,space),('forecast-'+key,'https://api.open-meteo.com/v1/forecast?'+coord,1800,lambda v:v),('earth-events','https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7&limit=20',3600,lambda v:v.get('events',[])),('astronomy','https://api.nasa.gov/planetary/apod?api_key='+urllib.parse.quote(os.environ.get('NASA_API_KEY','DEMO_KEY')),21600,lambda v:v)]
        today=datetime.now(timezone.utc).date().isoformat()
        jobs.append(('asteroids','https://api.nasa.gov/neo/rest/v1/feed?'+urllib.parse.urlencode({'start_date':today,'end_date':today,'api_key':os.environ.get('NASA_API_KEY','DEMO_KEY')}),21600,lambda v:v.get('near_earth_objects',{})))
        with ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(lambda j:cached(*j), jobs))
    finally: lock.release()

async def monitor():
    while True:
        try: await asyncio.to_thread(refresh)
        except Exception: pass
        await asyncio.sleep(120)

def snapshot():
    s=settings();key=loc_key(s);now=time.time()
    feeds={}
    for label,name,ttl in [('weather','nws-'+key,300),('earthquakes','earthquakes',300),('space','space',900),('forecast','forecast-'+key,3600),('earthEvents','earth-events',7200),('astronomy','astronomy',86400),('asteroids','asteroids',86400)]:
        v=read(name+'.json',{});feeds[label]={**v,'stale':not v.get('updated') or now-v['updated']>ttl or bool(v.get('error'))}
    events=[]
    for name in ('weather','earthquakes','space'):
        feed=feeds[name]
        for original in feed.get('data',[]):
            event=dict(original)
            if event['expires'] and event['expires']<now: continue
            if name=='earthquakes':
                distance=miles(s.latitude,s.longitude,event['latitude'],event['longitude'])
                if not ((event['magnitude']>=s.magnitude and distance<=s.radiusMiles) or event['magnitude']>=s.globalMagnitude): continue
                event['distanceMiles']=round(distance);event['text']+=f' {round(distance)} miles from {s.location}.'
            event['stale']=feed['stale'];event['checkedAt']=feed.get('updated');events.append(event)
    priority={'Extreme':0,'Severe':1,'Moderate':2,'Minor':3,'Unknown':4,'Info':5}
    events.sort(key=lambda e:(e['stale'],priority.get(e['severity'],5),-e['issued']))
    return {'settings':s.model_dump(),'feeds':feeds,'events':events[:80],'acknowledged':read('acknowledged.json',[]),'checkedAt':now}

@router.get('')
def status(): return snapshot()

# Scientific metadata is cached per query. Arbitrary remote URLs are never fetched.
def abstract(index):
    if not isinstance(index,dict): return ''
    positions=[(p,w) for w,ps in index.items() for p in ps if isinstance(p,int) and p<2000]
    return ' '.join(w for _,w in sorted(positions))[:6000]

def openalex(data):
    return [{'id':w['id'].rsplit('/',1)[-1],'provider':'OpenAlex','title':w.get('display_name','Untitled'),'year':w.get('publication_year'),'url':w.get('doi') or w['id'],'abstract':abstract(w.get('abstract_inverted_index')),'openAccess':(w.get('open_access') or {}).get('is_oa',False)} for w in data.get('results',[])]

def epmc(data):
    return [{'id':w.get('id'),'provider':'Europe PMC','title':w.get('title','Untitled'),'year':w.get('pubYear'),'url':'https://europepmc.org/article/'+w.get('source','MED')+'/'+w['id'],'abstract':w.get('abstractText',''),'pmcid':w.get('pmcid'),'openAccess':w.get('isOpenAccess')=='Y'} for w in data.get('resultList',{}).get('result',[])]

@router.get('/research')
def search(q: str = Query(min_length=2,max_length=200)):
    digest=hashlib.sha256(q.strip().lower().encode()).hexdigest()
    params=urllib.parse.urlencode({'search':q,'per_page':8,**({'api_key':os.environ['OPENALEX_API_KEY']} if os.environ.get('OPENALEX_API_KEY') else {})})
    jobs=[('papers-oa-'+digest,'https://api.openalex.org/works?'+params,86400,openalex),('papers-pmc-'+digest,'https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':q,'format':'json','pageSize':8,'resultType':'core'}),86400,epmc)]
    with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda j:cached(*j),jobs))
    return {'results':[{**row,'stale':bool(result.get('error')),'retrievedAt':result.get('updated')} for result in results for row in result.get('data',[])], 'sources':[{'name':name,'error':v.get('error'),'updated':v.get('updated')} for name,v in zip(('OpenAlex','Europe PMC'),results)]}

class SavePaper(BaseModel):
    fullText: bool = False
    query: str = Field(min_length=2,max_length=200)
    provider: str
    id: str = Field(max_length=100)

@router.post('/research/save')
def save_paper(body: SavePaper):
    # Retrieve only a previously cached result, never user-supplied URL or HTML.
    digest=hashlib.sha256(body.query.strip().lower().encode()).hexdigest()
    prefix={'OpenAlex':'oa','Europe PMC':'pmc'}.get(body.provider)
    if not prefix: raise HTTPException(400,'Unknown research source')
    results=read(f'papers-{prefix}-{digest}.json',{}).get('data',[])
    item=next((v for v in results if v['id']==body.id),None)
    if not item: raise HTTPException(404,'Search again before saving this result')
    text=f"{item['title']}\n{item['provider']} · {item.get('year','')}\n{item['url']}\n\nResearch metadata and abstract — not a full paper.\n\n{item.get('abstract') or 'Abstract unavailable.'}"
    if body.fullText:
        pmcid=item.get('pmcid','')
        if body.provider!='Europe PMC' or not item.get('openAccess') or not re.fullmatch(r'PMC[0-9]+',pmcid):
            raise HTTPException(400,'Full text is not available from this source')
        from defusedxml import ElementTree
        from defusedxml.common import DefusedXmlException
        try:
            req=urllib.request.Request('https://www.ebi.ac.uk/europepmc/webservices/rest/'+pmcid+'/fullTextXML',headers={'User-Agent':UA})
            with urllib.request.urlopen(req,timeout=15) as response: raw=response.read(8_000_001)
            if len(raw)>8_000_000: raise ValueError('Full text exceeds download limit')
            doc=ElementTree.fromstring(raw)
            text=f"{item['title']}\n{item['url']}\nFull-text article from Europe PMC; retain the article's license and publication date.\n\n"+' '.join(doc.itertext())
            if len(text)>250000: text=text[:250000]+'\n[Full-text extract truncated at 250,000 characters.]'
        except (OSError,ValueError,ElementTree.ParseError,DefusedXmlException):
            raise HTTPException(502,'Full text unavailable. You can still save the abstract.')
    data=text.encode();sha=hashlib.sha256(data).hexdigest();research.files_root().mkdir(parents=True,exist_ok=True);(research.files_root()/sha).write_bytes(data)
    with database() as con:
        research.init(con)
        con.execute('INSERT OR IGNORE INTO research_files(collection,name,mime,digest,extracted) VALUES(?,?,?,?,?)',('Science research',item['title'][:180]+(' — full text.txt' if body.fullText else ' — abstract.txt'),'text/plain',sha,text[:32000]))
        row=con.execute('SELECT id FROM research_files WHERE collection=? AND digest=?',('Science research',sha)).fetchone()
    return {'id':row['id'],'saved':True,'fullText':body.fullText}

class Acknowledgement(BaseModel):
    id: str = Field(min_length=1,max_length=500)

@router.post('/acknowledge')
def acknowledge(body: Acknowledgement):
    with ack_lock:
        values=read('acknowledged.json',[])
        write('acknowledged.json',list(dict.fromkeys(values+[body.id]))[-500:])
    return {'saved':True}

@router.get('/earthquakes')
def earthquake_map():
    feed=snapshot()['feeds']['earthquakes']
    return {'updated':feed.get('updated'),'stale':feed['stale'],'geojson':{'type':'FeatureCollection','features':[{'type':'Feature','geometry':{'type':'Point','coordinates':[e['longitude'],e['latitude']]},'properties':{'title':e['title'],'magnitude':e['magnitude'],'issued':e['issued']}} for e in feed.get('data',[]) if e['expires']>time.time()]}}

def time_label(value):
    return datetime.fromtimestamp(value,timezone.utc).strftime('%Y-%m-%d %H:%M UTC') if value else 'unavailable'

def assistant_context(question):
    """Readable cached facts for either direct excerpts or a bounded model prompt."""
    q=question.lower();data=snapshot();rows=[]
    if re.search(r'weather|forecast|temperature|rain',q):
        f=data['feeds']['forecast'];v=f.get('data',{});current=v.get('current',{});daily=v.get('daily',{})
        text=f"Location: {data['settings']['location']}. {'LAST KNOWN / UNAVAILABLE' if f['stale'] else 'Cached forecast'}. Saved {time_label(f.get('updated'))}.\nCurrent temperature: {current.get('temperature_2m','unavailable')}°F; wind: {current.get('wind_speed_10m','unavailable')} mph.\n"
        for i,date in enumerate(daily.get('time',[])[:7]):
            text+=f"{date}: {daily['temperature_2m_min'][i]}–{daily['temperature_2m_max'][i]}°F; precipitation probability {daily['precipitation_probability_max'][i]}%.\n"
        rows.append(('Saved weather forecast','https://open-meteo.com/',text))
    kinds=[]
    if re.search(r'weather|storm|alert',q): kinds.append('Weather')
    if re.search(r'quake|alert',q): kinds.append('Earthquake')
    if re.search(r'solar|geomagnetic|aurora|space|alert',q): kinds.append('Space weather')
    for kind in kinds:
        events=[e for e in data['events'] if e['kind']==kind]
        for e in events[:2]:
            rows.append((e['title'],e['url'],f"{e['source']}. {'LAST KNOWN' if e['stale'] else 'Saved report'}. Issued {time_label(e['issued'])}; checked {time_label(e.get('checkedAt'))}.\n{e['text']}"))
        if not events:
            name={'Weather':'weather','Earthquake':'earthquakes','Space weather':'space'}[kind];f=data['feeds'][name]
            rows.append((kind+' feed status','https://www.weather.gov/' if kind=='Weather' else 'https://earthquake.usgs.gov/' if kind=='Earthquake' else 'https://www.spaceweather.gov/',f"{'Feed unavailable or stale; event status unknown.' if f['stale'] else 'No matching reports in the last saved feed; this is not a live all-clear.'} Checked {time_label(f.get('updated'))}. Location: {data['settings']['location']}."))
    if re.search(r'astronomy|space picture',q):
        f=data['feeds']['astronomy'];v=f.get('data',{})
        rows.append((v.get('title','Astronomy feed'),'https://apod.nasa.gov/',f"Saved {time_label(f.get('updated'))}; stale/unavailable: {f['stale']}. {v.get('explanation','No saved astronomy report.')}"))
    if 'asteroid' in q:
        f=data['feeds']['asteroids'];values=[item for group in f.get('data',{}).values() for item in group]
        text=f"Saved {time_label(f.get('updated'))}; stale/unavailable: {f['stale']}. These are approach observations, not impact warnings.\n"
        for v in values[:5]:
            approach=(v.get('close_approach_data') or [{}])[0]
            text+=f"{v['name']}: {approach.get('close_approach_date')}, miss distance {approach.get('miss_distance',{}).get('miles','unavailable')} miles.\n"
        rows.append(('NASA asteroid approaches','https://cneos.jpl.nasa.gov/',text))
    return rows[:4]


def radar_manifest(value):
    if value.get('host') != 'https://tilecache.rainviewer.com':
        raise ValueError('Unexpected radar host')
    frames = value.get('radar', {}).get('past', [])
    valid = [f for f in frames if isinstance(f, dict) and isinstance(f.get('time'), (int, float))
             and not isinstance(f['time'], bool) and math.isfinite(f['time']) and 0 < f['time'] <= time.time()+300
             and re.fullmatch(r'/v2/radar/[A-Za-z0-9_-]{1,64}', str(f.get('path', '')))]
    if not valid: raise ValueError('No radar frames')
    return {'host':value['host'], 'frames': sorted(valid, key=lambda f:f['time'])[-13:]}

radar_lock = threading.Lock()
@router.get('/radar')
def radar():
    # On-demand only. No background tile downloading or future-radar claims.
    with radar_lock:
        result = cached('radar', 'https://api.rainviewer.com/public/weather-maps.json', 300, radar_manifest) if settings().enabled else read('radar.json', {})
    data = result.get('data') or {}
    latest = max((f['time'] for f in data.get('frames', [])), default=0)
    return {**result, 'stale': bool(result.get('error')) or time.time()-latest > 1800}
