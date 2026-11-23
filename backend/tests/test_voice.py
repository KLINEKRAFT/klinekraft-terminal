import threading
import time
from uuid import uuid4
from fastapi.testclient import TestClient
import pytest
from klinekraft import voice, organizer, maps, conversations
from klinekraft.main import app

@pytest.fixture
def companion(tmp_path,monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR',str(tmp_path/'data'))
    monkeypatch.setattr(voice,'CONFIG',tmp_path/'voice.json')
    c=voice.Companion()
    monkeypatch.setattr(voice,'companion',c)
    monkeypatch.setattr(c,'speak',lambda *a:None)
    return c

def test_local_commands_save_only_text(companion):
    companion.answer('create a note remember the spare batteries',b'',0)
    assert companion.state['answer']=='Note saved.'
    notes=organizer.items('note')
    assert notes[0]['body']=='remember the spare batteries'
    with conversations.database() as db:
        rows=db.execute('SELECT payload FROM chats').fetchall()
    assert len(rows)==1 and 'remember the spare batteries' in rows[0][0]
    assert companion.state['phase']=='muted'

def test_cancelled_request_cannot_save_or_speak(companion,monkeypatch):
    def answer(_):
        companion.stop(mute=True)
        return {'answer':'late answer','sources':[],'images':[],'notice':''}
    monkeypatch.setattr(voice.assistant,'ask',answer)
    companion.answer('Explain a compass',b'',0)
    assert not companion.turns
    assert companion.state['phase']=='muted'

def test_action_ack_does_not_deadlock(companion):
    companion.ui_seen=time.monotonic()
    result=[]
    t=threading.Thread(target=lambda:result.append(companion.dispatch('navigate','Notes',0)))
    t.start()
    for _ in range(100):
        if companion.ui_event:break
        time.sleep(.005)
    voice.ack(voice.Ack(id=companion.ui_event['id'],result='Opened Notes.'))
    t.join(1)
    assert not t.is_alive() and result==['Opened Notes.']

def test_gps_requires_current_fix(companion,monkeypatch):
    monkeypatch.setattr(maps,'gps_fix',lambda:{'available':False})
    assert 'current GPS' in companion.command('mark location as camp',0)
    monkeypatch.setattr(maps,'gps_fix',lambda:{'available':True,'latitude':36.1,'longitude':-95.9})
    assert companion.command('mark location as camp',0)=='Location saved.'
    assert maps.places()[0]['name']=='camp'

def test_guard_and_mute_settings(companion,monkeypatch):
    monkeypatch.setattr(voice,'MODEL',voice.CONFIG.parent)
    client=TestClient(app,base_url='http://127.0.0.1')
    assert client.get('/api/voice').status_code==403
    head={'X-Klinekraft-Client':'local-ui'}
    assert client.get('/api/voice',headers=head).status_code==200
    assert client.post('/api/voice/control',headers=head,json={'action':'listen'}).status_code==409
    response=client.put('/api/voice/settings',headers=head,json={'enabled':False,'style':'liquid','followup':7,'online':False})
    assert response.json()['preferences']['style']=='liquid'
    assert voice.CONFIG.stat().st_mode & 0o777 == 0o600
    assert client.post('/api/voice/control',headers=head,json={'action':'shell'}).status_code==422

def test_timer_and_volume_bounds(companion,monkeypatch):
    assert 'one second' in companion.command('set a 0 second timer',0)
    assert 'one hundred' in companion.command('volume 200 percent',0)
    assert companion.command('set a 5 minute timer',0).startswith('Timer started')
    assert len(companion.timers)==1
    assert companion.command('cancel all timers',0)=='Timers cancelled.'
    assert not companion.timers

def test_cloud_transcription_never_relaxes_retention(monkeypatch):
    import requests
    monkeypatch.setattr(voice.speech,'config',lambda:{'key':'test-private-key'})
    monkeypatch.setattr(voice,'_scribe_unavailable_until',0.)
    calls=[]
    class Rejected:
        status_code=403
        def __enter__(self):return self
        def __exit__(self,*a):pass
    def post(url,**kwargs):calls.append((url,kwargs));return Rejected()
    monkeypatch.setattr(requests,'post',post)
    text,engine=voice.transcribe(b'\0'*6400,'local words')
    assert text=='local words' and 'Local' in engine
    assert len(calls)==1 and 'enable_logging=false' in calls[0][0]
    assert calls[0][1]['allow_redirects'] is False

def test_weather_marks_old_data(companion,monkeypatch):
    monkeypatch.setattr(voice.briefing,'snapshot',lambda:{'settings':{'location':'Tulsa'},'feeds':{'forecast':{'stale':True,'data':{'current':{'weather_code':45,'temperature_2m':51},'daily':{}}}}})
    assert voice.weather_text().startswith('Last saved weather for Tulsa. Fog.')

def test_spoken_numbers_and_timer_survives_service_restart(companion):
    assert voice.spoken_numbers('volume sixty five percent')=='volume 65 percent'
    assert voice.spoken_numbers('one hundred')=='100'
    companion.command('set a timer for five minutes',0)
    restarted=voice.Companion()
    assert len(restarted.timers)==1
    assert 295 < restarted.timers[0]['end']-time.time() <= 300
    companion.command('cancel timers',0)
    assert not voice.Companion().timers

def test_stopped_generation_cannot_execute_note(companion):
    companion.stop(mute=True)
    assert companion.command('create a note do not save',0)==''
    assert not organizer.items('note')

def test_no_thanks_ends_followups_without_model_or_speech(companion,monkeypatch):
    def forbidden(*args):raise AssertionError('Dismissal must not query or speak')
    monkeypatch.setattr(voice.assistant,'ask',forbidden)
    monkeypatch.setattr(companion,'speak',forbidden)
    companion.prefs.enabled=True
    companion.answer('no thank you',b'',0)
    assert companion.state['phase']=='idle'
    assert not companion.turns
