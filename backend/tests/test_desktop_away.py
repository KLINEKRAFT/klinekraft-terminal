import importlib.util
from pathlib import Path
import subprocess
import pytest
from fastapi import HTTPException, Response
from pydantic import ValidationError
from klinekraft import desktop_away as away

@pytest.fixture
def configured(tmp_path, monkeypatch):
    monkeypatch.setattr(away, 'CONFIG', tmp_path/'desktop-away.json')
    monkeypatch.setattr(away, 'UNIT', tmp_path/'klinekraft-idle.service')
    away.UNIT.touch()
    return tmp_path

def test_invalid_palette_and_timer_rejected():
    for data in ({'idleMinutes':-1}, {'idleMinutes':3}, {'colors':['red']*3}, {'background':'shell'}, {'message':'x'*161}):
        with pytest.raises(ValidationError): away.Preferences(**data)

def test_persisted_look_and_timer(configured, monkeypatch):
    calls=[]
    monkeypatch.setattr(away.subprocess,'run', lambda args,**kwargs: calls.append(args))
    result=away.update(away.Preferences(background='contour', idleMinutes=5, message=''))
    assert result['displayBlankMinutes']==8
    assert away.read().background=='contour'
    assert calls==[['systemctl','--user','restart','klinekraft-idle.service']]
    assert away.CONFIG.stat().st_mode & 0o777 == 0o600
    assert away.update(away.Preferences(idleMinutes=0))['displayBlankMinutes']==0

def test_restart_failure_restores_previous_preferences(configured, monkeypatch):
    away.write(away.Preferences(background='contour'))
    def fail(*args,**kwargs): raise subprocess.CalledProcessError(1,args[0])
    monkeypatch.setattr(away.subprocess,'run',fail)
    with pytest.raises(HTTPException) as error: away.update(away.Preferences(idleMinutes=0))
    assert error.value.status_code==503
    assert away.read().background=='contour'
    assert away.read().idleMinutes==2

def test_missing_installation_and_corrupt_config(configured):
    away.CONFIG.write_text('[]')
    assert away.read().idleMinutes==2
    away.UNIT.unlink()
    assert not away.status(Response())['installed']
    with pytest.raises(HTTPException): away.update(away.Preferences())

def test_idle_command_is_bounded_and_separates_browser():
    path=Path(__file__).resolve().parents[2]/'scripts/desktop-idle.py'
    spec=importlib.util.spec_from_file_location('desktop_idle',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    args=module.command(2)
    assert '120' in args and '300' in args
    assert '"$HOME/.local/bin/klinekraft-away-control" resume' in args
    assert not any('wlopm' in arg for arg in args)
    assert module.command(0)==['/usr/bin/sleep','infinity']
    assert module.command('2; bad')==args
