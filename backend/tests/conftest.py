import pytest

@pytest.fixture(autouse=True)
def isolate_power_preferences(tmp_path, monkeypatch):
    # Tests must not consult or modify the owner's Field mode preference.
    from klinekraft import power
    monkeypatch.setattr(power, 'ROOT', tmp_path/'power')
    monkeypatch.setattr(power, 'read_external_power', lambda: None)

@pytest.fixture(autouse=True)
def isolate_briefing_cache(tmp_path, monkeypatch):
    # API lifecycle tests must neither poll external services nor use owner alerts.
    from klinekraft import briefing
    cache = tmp_path/'briefing'
    cache.mkdir()
    monkeypatch.setattr(briefing, 'root', lambda: cache)
    monkeypatch.setattr(briefing, 'refresh', lambda: None)

@pytest.fixture(autouse=True)
def isolate_voice(monkeypatch):
    # API tests never open the owner's microphone or start companion threads.
    from klinekraft import voice
    monkeypatch.setattr(voice.companion, 'start', lambda: None)
    monkeypatch.setattr(voice.companion, 'close', lambda: None)
