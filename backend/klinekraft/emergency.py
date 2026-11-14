"""Offline readiness; checks local resources without contacting cloud services."""
from fastapi import APIRouter, Depends
from .local_content import local_request
from .conversations import database
from . import research, maps, assistant

router = APIRouter(prefix='/api/emergency', dependencies=[Depends(local_request)])

@router.get('/status')
def status():
    with database() as connection:
        research.init(connection)
        total, searchable = connection.execute("SELECT count(*),coalesce(sum(length(trim(extracted))>0),0) FROM research_files").fetchone()
    ai = assistant.status()
    return {'library':{'documents':total,'searchable':searchable}, 'maps':maps.metadata()['available'],
            'localAI':ai['local']['configured'], 'model':ai['local']['model']}
