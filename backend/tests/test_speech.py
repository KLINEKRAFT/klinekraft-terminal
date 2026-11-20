import json,stat
import pytest
from fastapi import HTTPException
from klinekraft import speech

def test_private_setup_does_not_return_key(tmp_path,monkeypatch):
    target=tmp_path/'speech.json'
    monkeypatch.setattr(speech,'path',lambda:target)
    calls=[]
    monkeypatch.setattr(speech,'request',lambda url,key,**kwargs:calls.append((url,key)) or b'{}')
    result=speech.settings(speech.Settings(apiKey='test-private-key',provider='elevenlabs'))
    assert result['configured'] and 'key' not in result
    assert stat.S_IMODE(target.stat().st_mode)==0o600
    assert json.loads(target.read_text())['key']=='test-private-key'
    assert calls[0][0]=='https://api.elevenlabs.io/v1/voices'

def test_offline_does_not_call_cloud(monkeypatch):
    monkeypatch.setattr(speech.shutil,'which',lambda x:'/usr/bin/espeak-ng')
    class Result:stdout=b'RIFFfake'
    def run(args,**kwargs):
        assert args[0]=='espeak-ng' and '--stdin' in args
        assert kwargs['input']==b'Hello world'
        return Result()
    monkeypatch.setattr(speech.subprocess,'run',run)
    monkeypatch.setattr(speech,'request',lambda *a,**k:pytest.fail('Cloud called'))
    result=speech.synthesize(speech.Speech(text='**Hello world** [1]',provider='local'))
    assert result.media_type=='audio/wav'

def test_elevenlabs_uses_fixed_endpoint_and_never_falls_back(monkeypatch):
    monkeypatch.setattr(speech,'config',lambda:{'key':'private','voice':speech.DEFAULT_VOICE})
    def request(url,key,data):
        assert url.startswith('https://api.elevenlabs.io/v1/text-to-speech/'+speech.DEFAULT_VOICE)
        assert key=='private' and data['text']=='Hello'
        raise HTTPException(503,'Offline')
    monkeypatch.setattr(speech,'request',request)
    monkeypatch.setattr(speech.subprocess,'run',lambda *a,**kw:pytest.fail('Unexpected fallback'))
    with pytest.raises(HTTPException):speech.synthesize(speech.Speech(text='Hello',provider='elevenlabs'))
    assert not speech.lock.locked()

def test_markdown_is_not_read_as_markup():
    assert speech.spoken('# Heading\n[Example](https://example.com) [2]\n```sh\nsudo command\n```')=='Heading\nExample \n Code block omitted.'

def test_saved_audio_replays_without_cloud_and_can_be_deleted(tmp_path,monkeypatch):
    monkeypatch.setattr(speech,'audio_dir',lambda:tmp_path)
    monkeypatch.setattr(speech,'config',lambda:{'key':'private','voice':speech.DEFAULT_VOICE})
    monkeypatch.setattr(speech,'request',lambda *a,**k:b'audio-test')
    speech.synthesize(speech.Speech(text='Briefing',provider='elevenlabs',save=True,title='My brief'))
    row=speech.saved_list()['recordings'][0]
    assert row['title']=='My brief' and row['voice']==speech.DEFAULT_VOICE
    assert 'key' not in row
    assert all(stat.S_IMODE(p.stat().st_mode)==0o600 for p in tmp_path.iterdir() if p.is_file())
    monkeypatch.setattr(speech,'request',lambda *a,**k:pytest.fail('Offline replay called cloud'))
    assert speech.saved_audio(row['id']).body==b'audio-test'
    speech.delete_audio(row['id'])
    assert speech.saved_list()=={'recordings':[]}
    with pytest.raises(HTTPException):speech.saved_audio('../speech')

def test_full_audio_storage_does_not_spend_credits(monkeypatch):
    monkeypatch.setattr(speech,'recordings',lambda:[{'bytes':250_000_000}])
    monkeypatch.setattr(speech,'request',lambda *a,**k:pytest.fail('Cloud called with full storage'))
    with pytest.raises(HTTPException) as error:
        speech.synthesize(speech.Speech(text='Hello',provider='elevenlabs',save=True))
    assert error.value.status_code==409
    assert not speech.lock.locked()
