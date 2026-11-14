"""Explicit USB Meshtastic connection and local message log. No automatic radio sends."""
import threading
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from .local_content import local_request
from .conversations import database

router=APIRouter(prefix='/api/mesh',dependencies=[Depends(local_request)])
lock=threading.RLock()
radio=None
connected=False
subscribed=False

def ports():
    return sorted(str(p) for p in Path('/dev/serial/by-id').glob('*') if p.resolve().name.startswith(('ttyUSB','ttyACM')))

def init(c):
    c.execute('CREATE TABLE IF NOT EXISTS mesh_messages (id INTEGER PRIMARY KEY, stamp TEXT NOT NULL, direction TEXT NOT NULL, peer TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL)')

def record(direction,peer,text,status):
    with database() as c:
        init(c)
        c.execute('INSERT INTO mesh_messages(stamp,direction,peer,text,status) VALUES(?,?,?,?,?)',(datetime.now(timezone.utc).isoformat(),direction,str(peer)[:80],str(text)[:1000],status))
        c.execute('DELETE FROM mesh_messages WHERE id NOT IN (SELECT id FROM mesh_messages ORDER BY id DESC LIMIT 500)')

def receive(packet,interface):
    if interface is not radio: return
    text=packet.get('decoded',{}).get('text')
    if isinstance(text,str):record('received',packet.get('fromId',packet.get('from','unknown')),text,'Received')

def lost(interface):
    global connected
    if interface is radio:connected=False

@router.get('')
def status():
    with database() as c:
        init(c);messages=[dict(r) for r in c.execute('SELECT * FROM mesh_messages ORDER BY id DESC LIMIT 100')]
    with lock:
        nodes=[]
        if connected and radio:
            nodes=[{'id':str(k),'name':str(v.get('user',{}).get('longName',k))[:80]} for k,v in list((radio.nodes or {}).items())[:100]]
        return {'connected':connected,'ports':ports(),'nodes':nodes,'messages':messages,
                'notice':'Requires a configured Meshtastic LoRa radio and reachable peers. Queued means handed to the radio, not delivered.'}

class Connect(BaseModel):
    model_config=ConfigDict(extra='forbid')
    port:str=Field(max_length=512)

@router.post('/connect')
def connect(body:Connect):
    global radio,connected,subscribed
    if body.port not in ports():raise HTTPException(400,'Choose an attached USB serial device from the list.')
    with lock:
        if radio:
            radio.close();radio=None;connected=False
        try:
            from meshtastic.serial_interface import SerialInterface
            from pubsub import pub
            if not subscribed:
                pub.subscribe(receive,'meshtastic.receive.text');pub.subscribe(lost,'meshtastic.connection.lost');subscribed=True
            radio=SerialInterface(devPath=body.port,connectNow=False)
            radio.connect()
            connected=bool(radio.myInfo)
            if not connected:raise RuntimeError()
        except Exception:
            if radio:
                try:radio.close()
                except Exception:pass
            radio=None;connected=False
            raise HTTPException(503,'Could not connect to a configured Meshtastic radio. Check its firmware and USB permissions.')
    return status()

@router.post('/disconnect')
def disconnect():
    global radio,connected
    with lock:
        if radio:radio.close()
        radio=None;connected=False
    return status()

class Message(BaseModel):
    model_config=ConfigDict(extra='forbid')
    text:str=Field(min_length=1,max_length=200)
    destination:str=Field(default='^all',pattern=r'^(\^all|![0-9a-fA-F]{8})$')

@router.post('/send')
def send(body:Message):
    if not body.text.strip() or len(body.text.encode('utf-8'))>200:raise HTTPException(400,'Messages must contain 1–200 UTF-8 bytes.')
    with lock:
        if not connected or radio is None:raise HTTPException(503,'No Meshtastic radio connected. Nothing was sent.')
        try:radio.sendText(body.text,destinationId=body.destination,wantAck=True)
        except Exception:raise HTTPException(503,'The radio did not accept this message.')
        record('sent',body.destination,body.text,'Queued to radio; delivery unconfirmed')
    return status()
