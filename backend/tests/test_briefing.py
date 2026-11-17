import time
import pytest
from fastapi import HTTPException
from klinekraft import briefing as b

@pytest.fixture(autouse=True)
def isolated(tmp_path,monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR',str(tmp_path))

def event(id='e',kind='Weather',expires=None,**extra):
    return dict(id=id,kind=kind,title='Test event',severity='Severe',text='Official report',issued=time.time()-20,expires=expires or time.time()+3600,url='https://weather.gov/',source='NWS',**extra)

def test_failed_refresh_preserves_data_and_marks_stale(monkeypatch):
    old={'updated':time.time()-600,'attempt':time.time()-600,'data':[event()]}
    name='nws-'+b.loc_key(b.settings());b.write(name+'.json',old)
    def offline(url): raise OSError('offline')
    monkeypatch.setattr(b,'fetch',offline)
    b.cached(name,'https://api.weather.gov/',120)
    result=b.snapshot()
    assert result['feeds']['weather']['data']==old['data']
    assert result['events'][0]['stale'] is True
    assert result['feeds']['weather']['updated']==old['updated']

def test_expiry_local_and_global_thresholds_and_location_isolation():
    s=b.settings();now=time.time()
    b.write('nws-'+b.loc_key(s)+'.json',{'updated':now,'data':[event('expired',expires=now-1),event('active')]})
    b.write('earthquakes.json',{'updated':now,'data':[event('near','Earthquake',latitude=s.latitude,longitude=s.longitude,magnitude=3),event('far-small','Earthquake',latitude=0,longitude=0,magnitude=3),event('far-major','Earthquake',latitude=0,longitude=0,magnitude=7)]})
    ids={e['id'] for e in b.snapshot()['events']}
    assert ids=={'active','near','far-major'}
    b.save_settings(b.Settings(latitude=40,longitude=-74,location='New York'))
    assert b.snapshot()['feeds']['weather']['stale']
    assert not b.snapshot()['feeds']['weather'].get('data')

def test_acknowledgement_persists_and_disabled_settings():
    b.acknowledge(b.Acknowledgement(id='e'))
    b.acknowledge(b.Acknowledgement(id='e'))
    assert b.snapshot()['acknowledged']==['e']
    b.save_settings(b.Settings(enabled=False,ticker=False))
    assert b.settings().enabled is False

def test_nws_timestamp_offsets_and_test_alerts_excluded():
    assert b.stamp('2026-11-16T12:00:00-06:00')==b.stamp('2026-11-16T18:00:00Z')
    assert b.nws({'features':[{'properties':{'status':'Test'}}]})==[]

def test_saved_research_uses_cached_data_and_indexes_it(monkeypatch):
    def source(url):
        if 'openalex' in url:return {'results':[{'id':'https://openalex.org/W123','display_name':'Solar research','publication_year':2024,'abstract_inverted_index':{'Energy':[0],'storage':[1]},'open_access':{'is_oa':True}}]}
        return {'resultList':{'result':[]}}
    monkeypatch.setattr(b,'fetch',source)
    result=b.search('solar')
    assert result['results'][0]['abstract']=='Energy storage'
    saved=b.save_paper(b.SavePaper(query='solar',provider='OpenAlex',id='W123'))
    assert saved['saved']
    with b.database() as con:
        row=con.execute('SELECT extracted FROM research_files WHERE id=?',(saved['id'],)).fetchone()
    assert 'not a full paper' in row['extracted']
    with pytest.raises(HTTPException): b.save_paper(b.SavePaper(query='solar',provider='OpenAlex',id='http://localhost/secret'))

def test_full_text_is_only_downloaded_for_cached_open_access_pmc(monkeypatch):
    import hashlib,io
    digest=hashlib.sha256(b'water').hexdigest()
    b.write('papers-pmc-'+digest+'.json',{'data':[{'id':'1','title':'Water','provider':'Europe PMC','url':'https://europepmc.org/article/MED/1','pmcid':'PMC123','openAccess':True}]})
    def download(req,timeout):
        assert req.full_url=='https://www.ebi.ac.uk/europepmc/webservices/rest/PMC123/fullTextXML'
        return io.BytesIO(b'<article><front><license>CC BY</license></front><body><p>Full article text.</p></body></article>')
    monkeypatch.setattr(b.urllib.request,'urlopen',download)
    result=b.save_paper(b.SavePaper(query='water',provider='Europe PMC',id='1',fullText=True))
    with b.database() as con: text=con.execute('SELECT extracted FROM research_files WHERE id=?',(result['id'],)).fetchone()['extracted']
    assert 'Full article text.' in text and 'CC BY' in text

def test_cached_context_is_readable_and_unavailable_is_not_all_clear():
    rows=b.assistant_context('Any earthquakes?')
    assert 'unknown' in rows[0][2]
    assert not rows[0][2].startswith('{')

def test_radar_manifest_rejects_unknown_hosts_and_empty_frames():
    now=int(time.time())
    result=b.radar_manifest({'host':'https://tilecache.rainviewer.com','radar':{'past':[{'time':now,'path':'/v2/radar/e69136dec8d8'},{'time':now,'path':'https://example.com/tiles'}]}})
    assert len(result['frames'])==1
    with pytest.raises(ValueError):b.radar_manifest({'host':'https://example.com','radar':{'past':[]}})
    with pytest.raises(ValueError):b.radar_manifest({'host':'https://tilecache.rainviewer.com','radar':{'past':[]}})


def test_radar_failure_keeps_timestamp_and_marks_snapshot_unavailable(monkeypatch):
    now=int(time.time()); old={'updated':now-400,'attempt':now-400,'data':{'host':'https://tilecache.rainviewer.com','frames':[{'time':now-600,'path':f'/v2/radar/{now-600}'}]}}
    b.write('radar.json',old)
    def offline(url):raise OSError('offline')
    monkeypatch.setattr(b,'fetch',offline)
    result=b.radar()
    assert result['stale'] and result['data']==old['data'] and result['updated']==old['updated']


def test_tulsa_default_and_paused_radar_does_not_fetch(monkeypatch):
    assert b.settings().location=='Tulsa, Oklahoma'
    assert b.settings().latitude==36.154
    b.save_settings(b.Settings(enabled=False))
    monkeypatch.setattr(b,'fetch',lambda url:pytest.fail('Paused feeds must not fetch'))
    assert b.radar()['stale']
