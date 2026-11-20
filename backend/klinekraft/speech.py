"""On-demand read-aloud. Keys remain on the Pi; no automatic cloud fallback."""
import uuid, time
import json, os, re, shutil, subprocess, tempfile, threading, urllib.request, urllib.error
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from .local_content import local_request
router=APIRouter(prefix='/api/speech',dependencies=[Depends(local_request)])
lock=threading.Lock()
DEFAULT_VOICE='JBFqnCBsd6RMkjVDRZzb'

def path():
    return Path.home()/'.config/klinekraft/speech.json'

def config():
    try:return json.loads(path().read_text())
    except (OSError,ValueError):return {}

@router.get('')
def status():
    c=config()
    return {'configured':bool(c.get('key')),'provider':c.get('provider','local'),
            'voice':c.get('voice',DEFAULT_VOICE),'offline':bool(shutil.which('espeak-ng'))}

class Settings(BaseModel):
    model_config=ConfigDict(extra='forbid')
    apiKey:SecretStr|None=None
    voice:str=Field(default=DEFAULT_VOICE,pattern=r'^[A-Za-z0-9_-]{1,80}$')
    provider:Literal['local','elevenlabs']='local'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def request(url,key,data=None,limit=25000000):
    req=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,
        headers={'xi-api-key':key,'Content-Type':'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=60) as response:
            value=response.read(limit+1)
        if len(value)>limit:raise HTTPException(502,'Voice response was too large.')
        return value
    except urllib.error.HTTPError as e:
        raise HTTPException(503,'ElevenLabs rejected the request. Check the API key, voice access and available credits.') from None
    except (OSError,urllib.error.URLError):
        raise HTTPException(503,'ElevenLabs is unreachable. Select Offline voice to listen without internet.') from None

@router.put('')
def settings(body:Settings):
    with lock:
        c=config()
        key=body.apiKey.get_secret_value().strip() if body.apiKey else c.get('key','')
        if len(key)>256 or any(ord(ch)<33 or ord(ch)>126 for ch in key):
            raise HTTPException(400,'Invalid API key format.')
        if body.provider=='elevenlabs' and not key:raise HTTPException(400,'Enter your ElevenLabs API key first.')
        # Verify new credentials without spending speech credits.
        if body.apiKey and key:
            request('https://api.elevenlabs.io/v1/voices',key,limit=3000000)
        value={'key':key,'voice':body.voice,'provider':body.provider}
        target=path();target.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        with tempfile.NamedTemporaryFile(mode='w',dir=target.parent,delete=False) as f:
            os.fchmod(f.fileno(),0o600);json.dump(value,f);temporary=f.name
        os.replace(temporary,target)
    return status()

class Speech(BaseModel):
    model_config=ConfigDict(extra='forbid')
    text:str=Field(min_length=1,max_length=16000)
    provider:Literal['local','elevenlabs']='local'
    save:bool=False
    title:str=Field(default='Recording',min_length=1,max_length=200)

def audio_dir():
    return Path.home()/'.local/share/klinekraft/saved-audio'

def recordings():
    root=audio_dir()
    rows=[]
    if root.exists():
        for file in root.glob('*.json'):
            try:
                row=json.loads(file.read_text())
                if (root/(file.stem+'.audio')).is_file(): rows.append(row)
            except (OSError,ValueError): pass
    return sorted(rows,key=lambda row:row['created'],reverse=True)

@router.get('/saved')
def saved_list():
    return {'recordings':recordings()}

def saved_path(identifier):
    if not re.fullmatch(r'[a-f0-9]{32}',identifier):raise HTTPException(404,'Recording not found.')
    root=audio_dir()
    if not (root/(identifier+'.json')).is_file():raise HTTPException(404,'Recording not found.')
    return root/(identifier+'.audio')

@router.get('/saved/{identifier}')
def saved_audio(identifier:str):
    target=saved_path(identifier)
    try:
        row=json.loads(target.with_suffix('.json').read_text())
        return Response(target.read_bytes(),media_type=row['mime'],headers={'Cache-Control':'no-store'})
    except OSError:raise HTTPException(404,'Recording not found.') from None

@router.delete('/saved/{identifier}')
def delete_audio(identifier:str):
    with lock:
        target=saved_path(identifier)
        target.with_suffix('.json').unlink(missing_ok=True)
        target.unlink(missing_ok=True)
    return {'deleted':True}

def spoken(text):
    text=re.sub(r'```[\s\S]*?```',' Code block omitted. ',text)
    text=re.sub(r'!?\[([^\]]*)\]\([^)]*\)',r'\1',text)
    text=re.sub(r'\[\d+\]','',text)
    text=re.sub(r'(?m)^\s{0,3}(?:#{1,6}|>|[-*+])\s+','',text)
    text=text.replace('**','').replace('__','').replace('`','')
    return text.strip()

@router.post('')
def synthesize(body:Speech):
    if not lock.acquire(blocking=False):raise HTTPException(429,'Speech is already being prepared.')
    try:
        if body.save:
            rows=recordings()
            if len(rows)>=100 or sum(row.get('bytes',0) for row in rows)>=250_000_000:
                raise HTTPException(409,'Saved audio is full. Delete a recording first.')
        text=spoken(body.text)
        if not text:raise HTTPException(400,'No readable text in this answer.')
        if body.provider=='elevenlabs':
            c=config()
            if not c.get('key'):raise HTTPException(503,'Connect ElevenLabs in Voice settings first.')
            voice=c.get('voice',DEFAULT_VOICE)
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',voice):raise HTTPException(503,'Choose a valid voice.')
            audio=request('https://api.elevenlabs.io/v1/text-to-speech/'+voice+'?output_format=mp3_44100_128',c['key'],
                          {'text':text,'model_id':'eleven_flash_v2_5'})
            mime='audio/mpeg'
        else:
            if not shutil.which('espeak-ng'):raise HTTPException(503,'Offline speech is not installed.')
            try:
                audio=subprocess.run(['espeak-ng','--stdout','--stdin','-v','en-us','-s','155'],input=text.encode(),capture_output=True,check=True,timeout=40).stdout
            except (OSError,subprocess.SubprocessError):
                raise HTTPException(503,'Offline speech could not be prepared.') from None
            mime='audio/wav'
        if body.save:
            root=audio_dir();root.mkdir(mode=0o700,parents=True,exist_ok=True)
            identifier=uuid.uuid4().hex
            target=root/(identifier+'.audio')
            metadata=root/(identifier+'.json')
            try:
                with target.open('xb') as f:
                    os.fchmod(f.fileno(),0o600);f.write(audio)
                with metadata.open('x') as f:
                    os.fchmod(f.fileno(),0o600)
                    json.dump({'id':identifier,'title':body.title,'created':time.time(),
                               'provider':body.provider,'voice':c.get('voice',DEFAULT_VOICE) if body.provider=='elevenlabs' else 'en-us',
                               'mime':mime,'bytes':len(audio)},f)
            except OSError:
                target.unlink(missing_ok=True);metadata.unlink(missing_ok=True)
                raise HTTPException(507,'Could not save audio. Check available storage.') from None
        return Response(audio,media_type=mime,headers={'Cache-Control':'no-store'})
    finally:lock.release()
