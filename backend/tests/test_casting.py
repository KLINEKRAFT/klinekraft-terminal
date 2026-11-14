from fastapi import FastAPI
from fastapi.testclient import TestClient
from klinekraft import casting


def test_cast_controls_are_local_and_use_fixed_commands(tmp_path, monkeypatch):
    config = tmp_path / 'uxplayrc'
    config.write_text('# setup\n')
    monkeypatch.setattr(casting, 'CONFIG', config)
    monkeypatch.setattr(casting.shutil, 'which', lambda _: '/usr/bin/uxplay')
    current = ['inactive']
    calls = []
    def control(action):
        calls.append(action)
        current[0] = 'active' if action == 'start' else 'inactive'
    monkeypatch.setattr(casting, 'control', control)
    monkeypatch.setattr(casting, 'state', lambda: current[0])
    app = FastAPI(); app.include_router(casting.router)
    client = TestClient(app)
    assert client.post('/api/casting/start', json={'fullscreen': True}).status_code == 403
    headers = {'X-Klinekraft-Client': 'local-ui'}
    result = client.post('/api/casting/start', json={'fullscreen': True}, headers=headers)
    assert result.status_code == 200
    assert result.json()['active'] and result.json()['pin'].isdigit()
    assert calls == ['stop', 'start']
    assert 'fs' in config.read_text().splitlines()
    assert config.stat().st_mode & 0o777 == 0o600
    assert result.headers['cache-control'] == 'no-store'
    result = client.post('/api/casting/stop', headers=headers)
    assert not result.json()['active'] and not result.json()['pin']
    client.post('/api/casting/start', json={'fullscreen': False}, headers=headers)
    assert 'fs' not in config.read_text().splitlines()
