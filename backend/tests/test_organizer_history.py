from uuid import uuid4
from fastapi.testclient import TestClient
from klinekraft.main import app


def test_overwrite_history_restore_and_conflict(tmp_path, monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR', str(tmp_path))
    with TestClient(app, base_url='http://127.0.0.1', headers={'X-Klinekraft-Client':'local-ui'}) as client:
        item = dict(id=str(uuid4()), kind='note', title='Field notes', body='Long irreplaceable notes', revision=0)
        path = '/api/organizer/' + item['id']
        saved = client.put(path, json=item).json()
        cleared = client.put(path, json={**saved, 'body':''}).json()
        assert cleared['revision'] == 2
        history = client.get(path + '/history').json()
        assert history[0]['item']['body'] == item['body']
        assert history[0]['saved_at'].endswith('Z')
        assert client.put(path, json=saved).status_code == 409
        assert len(client.get(path + '/history').json()) == 1
        restored = client.put(path, json={**cleared, 'body':history[0]['item']['body']}).json()
        assert restored['revision'] == 3
        archived = client.put(path, json={**restored, 'archived':True}).json()
        assert archived['archived'] is True
        assert client.get('/api/organizer?kind=note').json()[0]['body'] == item['body']
        assert len(client.get(path + '/history').json()) == 3
        assert client.get(path + '/history', headers={'X-Klinekraft-Client':''}).status_code == 403
