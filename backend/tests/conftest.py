import pytest

@pytest.fixture(autouse=True)
def isolate_power_preferences(tmp_path, monkeypatch):
    # Tests must not consult or modify the owner's Field mode preference.
    from klinekraft import power
    monkeypatch.setattr(power, 'ROOT', tmp_path/'power')
    monkeypatch.setattr(power, 'read_external_power', lambda: None)
