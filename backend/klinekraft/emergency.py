"""Readiness based on installed resources and dated verification, without cloud calls."""
import json
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Response
from .local_content import local_request
from .conversations import database
from . import research, maps, assistant, routing

router = APIRouter(prefix='/api/emergency', dependencies=[Depends(local_request)])
STATE = Path.home()/'.local/state/klinekraft/verification'
BACKUP = Path.home()/'.local/state/klinekraft-backup'

def read(path):
    try:
        value=json.loads(path.read_text())
        return value if isinstance(value,dict) else {}
    except (OSError,ValueError): return {}

def age_hours(value):
    try:
        stamp=datetime.fromisoformat(value.replace('Z','+00:00'))
        if stamp.tzinfo is None: return None
        age=(datetime.now(timezone.utc)-stamp).total_seconds()/3600
        return age if age >= -0.1 else None
    except (ValueError,TypeError,AttributeError): return None

def verified(name, available, report, detail, max_hours=168):
    stamp=report.get('checkedAt') or report.get('at')
    age=age_hours(stamp)
    state=('Needs attention' if not available or report.get('passed') is False else
           'Not tested' if report.get('passed') is not True or age is None else
           'Needs retest' if age > max_hours else 'Ready')
    return {'name':name,'state':state,'checkedAt':stamp,'detail':detail}

@router.get('/status')
def status(response: Response):
    response.headers['Cache-Control']='no-store'
    with database() as connection:
        research.init(connection)
        total,searchable,historical=connection.execute("SELECT count(*),coalesce(sum(length(trim(extracted))>0),0),coalesce(sum(collection LIKE 'Historical%'),0) FROM research_files").fetchone()
    audit=read(STATE/'offline-audit.json')
    def check(key): return {**audit.get('checks',{}).get(key,{}),'checkedAt':audit.get('at')}
    local=read(STATE/'shackleton-local.json')
    cloud=read(STATE/'shackleton-cloud.json')
    ai=assistant.status()
    route=routing.status()
    backup=read(BACKUP/'status.json')
    restore_files=sorted((BACKUP/'restore-verification').glob('*/verification.json'))
    restore=read(restore_files[-1]) if restore_files else {}
    saved=backup.get('last_success'); saved_age=age_hours(saved)
    cards=[
        verified('Library',searchable>0,check('library_search'),f'{total} stored sections; {searchable} searchable; {historical} historical. Sections are not unique books.'),
        verified('Offline maps',maps.metadata().get('available',False),check('map_archive'),'Local map archive; lower 48 and Alaska. No live road or hazard updates.'),
        verified('Offline routing',route['installed'] and route['coverageReady'],check('route_planning'),f"{route['segments']} installed routing segments. Last test covers a sample route, not every road."),
        verified('Offline Shackleton',ai['local']['configured'],local,'Actual local-model response test with external network access blocked. Model may sleep between questions.'),
        verified('Online Shackleton',ai['cloud']['configured'],cloud,'Cloud response test. Requires internet and API availability.'),
        {'name':'Encrypted backup','state':'Ready' if backup.get('state')=='saved' and saved_age is not None and saved_age<36 else 'Needs attention',
         'checkedAt':saved,'detail':'Last successful backup. Files added afterward may not be included yet.'},
        verified('Backup restore',bool(restore),{'checkedAt':restore.get('checkedAt'),'passed':restore.get('restoredDatabaseIntegrity')=='ok' and restore.get('repositoryMetadataCheck')=='passed'} if restore else {},'Database restore and repository metadata checked. A replacement-card boot is not tested.',max_hours=720),
    ]
    return {'checkedAt':datetime.now(timezone.utc).isoformat(),'library':{'documents':total,'searchable':searchable,'historical':historical},'checks':cards}
