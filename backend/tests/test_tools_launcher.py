import subprocess
from unittest.mock import Mock
from fastapi.testclient import TestClient
from klinekraft.main import app
from klinekraft import tools_launcher as launcher

HEADERS = {'X-Klinekraft-Client': 'local-ui'}


def test_guard_and_unavailable(monkeypatch):
    monkeypatch.delenv('KLINEKRAFT_TOOLS', raising=False)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        assert client.get('/api/tools').status_code == 403
        result = client.get('/api/tools', headers=HEADERS)
        assert result.status_code == 200
        assert all(tool['unavailable'] for tool in result.json()['tools'])
        assert client.post('/api/tools/launch', headers=HEADERS, json={'tool_id': 'files'}).status_code == 503
        assert client.post('/api/tools/launch', headers=HEADERS, json={'tool_id': 'bash'}).status_code == 404
        assert client.post('/api/tools/launch', headers=HEADERS, json={'tool_id': 'files', 'command': 'bash'}).status_code == 422


def test_launch_fixed_argv_and_duplicate(monkeypatch):
    monkeypatch.setattr(launcher, 'readiness', lambda _: None)
    monkeypatch.setattr(launcher, 'terminal', lambda: '/usr/bin/lxterminal')
    monkeypatch.setattr(launcher, 'processes', {})
    process = Mock()
    process.wait.side_effect = subprocess.TimeoutExpired('terminal', .4)
    process.poll.return_value = None
    popen = Mock(return_value=process)
    monkeypatch.setattr(launcher.subprocess, 'Popen', popen)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        result = client.post('/api/tools/launch', headers=HEADERS, json={'tool_id': 'files'})
        assert result.status_code == 200
        assert popen.call_args.args[0] == ['/usr/bin/lxterminal', '-e', '/usr/bin/nnn']
        assert not popen.call_args.kwargs.get('shell', False)
        assert client.post('/api/tools/launch', headers=HEADERS, json={'tool_id': 'files'}).status_code == 409


def test_terminal_failure_is_visible(monkeypatch):
    monkeypatch.setattr(launcher, 'readiness', lambda _: None)
    monkeypatch.setattr(launcher, 'terminal', lambda: '/usr/bin/lxterminal')
    monkeypatch.setattr(launcher, 'processes', {})
    process = Mock()
    process.wait.return_value = 1
    monkeypatch.setattr(launcher.subprocess, 'Popen', Mock(return_value=process))
    with TestClient(app, base_url="http://127.0.0.1") as client:
        assert client.post('/api/tools/launch', headers=HEADERS, json={'tool_id': 'music'}).status_code == 503
