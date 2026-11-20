"""Saved internet-radio stations; media goes directly to the browser."""
from uuid import uuid4
from urllib.parse import urlsplit
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from .conversations import database
from .local_content import local_request
router=APIRouter(prefix='/api/radio/stations',dependencies=[Depends(local_request)])
KEXP='https://kexp.streamguys1.com/kexp160.aac'

def init(c):
    c.execute('CREATE TABLE IF NOT EXISTS radio_stations (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE)')
    c.execute("INSERT OR IGNORE INTO radio_stations VALUES('kexp','KEXP',?)",(KEXP,))

class Station(BaseModel):
    model_config=ConfigDict(extra='forbid')
    name:str=Field(min_length=1,max_length=60)
    url:str=Field(min_length=1,max_length=2048)
    @field_validator('name','url')
    @classmethod
    def trim(cls,value):
        value=value.strip()
        if not value or any(ord(ch)<32 for ch in value):raise ValueError('Enter a station name and HTTPS stream URL.')
        return value
    @field_validator('url')
    @classmethod
    def validate_url(cls,value):
        try:
            parsed=urlsplit(value)
            if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
                raise ValueError()
            parsed.port
        except ValueError:raise ValueError('Use a direct HTTPS audio stream URL without login details.')
        return value

@router.get('')
def stations():
    with database() as c:
        init(c)
        return [dict(r) for r in c.execute("SELECT * FROM radio_stations ORDER BY CASE WHEN id='kexp' THEN 0 ELSE 1 END,name")]

@router.post('')
def add(body:Station):
    with database() as c:
        init(c)
        old=c.execute('SELECT * FROM radio_stations WHERE url=?',(body.url,)).fetchone()
        if old:return dict(old)
        if c.execute('SELECT count(*) FROM radio_stations').fetchone()[0]>=100:raise HTTPException(409,'Station limit reached.')
        value={'id':str(uuid4()),'name':body.name,'url':body.url}
        c.execute('INSERT INTO radio_stations VALUES(:id,:name,:url)',value)
        return value

@router.delete('/{ident}')
def remove(ident:str):
    if ident=='kexp':raise HTTPException(409,'KEXP is the built-in station.')
    with database() as c:
        init(c)
        c.execute('DELETE FROM radio_stations WHERE id=?',(ident,))
    return {'removed':True}
