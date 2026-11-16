import pytest
from klinekraft.power_policy import ShutdownPolicy, runtime_minutes, critical

def test_shutdown_requires_sustained_low_and_countdown():
    p=ShutdownPolicy()
    assert p.update(7,3.5,0) is None
    assert p.update(7,3.5,29) is None
    assert p.update(7,3.5,30)==60
    assert p.update(7,3.5,89)==1
    assert p.update(7,3.5,90)==0

@pytest.mark.parametrize('percent,voltage',[(None,None),(0,0),(float('nan'),3.2),(101,3.2),(7,4.1),(60,3.9)])
def test_invalid_and_recovered_readings_cancel_shutdown(percent,voltage):
    p=ShutdownPolicy();p.update(7,3.5,0)
    assert p.update(percent,voltage,90) is None
    assert p.low_since is None

def test_voltage_protection_is_independent_of_inaccurate_percent():
    assert critical(60,3.3)
    assert not critical(60,3.8)

def test_runtime_uses_discharge_window_and_reserve():
    samples=[{'time':i*60,'percent':90-i*.4} for i in range(16)]
    assert runtime_minutes(samples)==172
    assert runtime_minutes(samples[:5]) is None
    samples[-1]['percent']=samples[-2]['percent']+1
    assert runtime_minutes(samples) is None

def test_field_mode_keeps_busy_model_running_then_sleeps(monkeypatch):
    from klinekraft import power
    calls=[]
    monkeypatch.setattr(power,'settings',lambda:{'field':True})
    monkeypatch.setattr(power,'read_battery',lambda:{'battery_percent':80,'battery_voltage':3.9})
    monkeypatch.setattr(power,'service',lambda action,name:calls.append((action,name)))
    monkeypatch.setattr(power,'last_ai',0)
    monkeypatch.setattr(power,'samples',[])
    monkeypatch.setattr(power,'ai_users',1)
    power.sample();assert not calls
    monkeypatch.setattr(power,'ai_users',0)
    power.sample();assert calls==[('stop','ai')]

def test_charging_resets_runtime_history(monkeypatch):
    from klinekraft import power
    import time
    monkeypatch.setattr(power,'settings',lambda:{'field':False})
    monkeypatch.setattr(power,'samples',[{'time':time.time()-60,'percent':60,'voltage':3.8}])
    monkeypatch.setattr(power,'read_battery',lambda:{'battery_percent':61,'battery_voltage':4.1})
    power.sample();assert len(power.samples)==1

def test_local_model_release_on_provider_error(monkeypatch):
    from klinekraft import power,assistant
    calls=[]
    monkeypatch.setattr(power,'settings',lambda:{'field':True})
    monkeypatch.setattr(power,'available',lambda:True)
    monkeypatch.setattr(power,'wake_ai',lambda:calls.append('wake'))
    monkeypatch.setattr(power,'release_ai',lambda:calls.append('release'))
    def fail(*args):raise ValueError('provider failed')
    monkeypatch.setattr(assistant,'_ask_provider',fail)
    with pytest.raises(ValueError):assistant.ask_provider([], '',local=True)
    assert calls==['wake','release']

def test_external_power_cancels_critical_countdown():
    p=ShutdownPolicy();p.update(5,3.3,0)
    assert p.update(5,3.3,90,external_power=True) is None
    assert p.low_since is None


def test_dim_persists_independently_without_service_changes(tmp_path, monkeypatch):
    from klinekraft import power
    monkeypatch.setattr(power, 'ROOT', tmp_path)
    calls=[]
    monkeypatch.setattr(power,'service',lambda *args:calls.append(args))
    monkeypatch.setattr(power,'read_battery',lambda:{'battery_percent':80,'battery_voltage':4.0})
    power.save_settings({'field': True})
    assert power.settings()['dim'] is True
    power.dim(power.FieldMode(enabled=False))
    assert power.settings()=={'field': True, 'dim': False}
    assert calls==[]
    power.field(power.FieldMode(enabled=False))
    power.dim(power.FieldMode(enabled=True))
    assert power.settings()=={'field': False, 'dim': True}
    power.field(power.FieldMode(enabled=True))
    assert power.settings()=={'field': True, 'dim': True}
