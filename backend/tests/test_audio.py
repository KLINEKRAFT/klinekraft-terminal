import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from klinekraft import audio

def test_default_output_commands_and_muted_readback(monkeypatch):
    calls=[]
    def run(*args):
        calls.append(args)
        return 'Volume: 0.37 [MUTED]' if args[0]=='get-volume' else ''
    monkeypatch.setattr(audio,'run',run)
    assert audio.change(audio.AudioChange(volume=37,muted=True))=={'volume':37,'muted':True}
    assert calls==[('set-volume',audio.SINK,'37%'),('set-mute',audio.SINK,'1'),('get-volume',audio.SINK)]

def test_audio_rejects_bad_inputs_and_missing_output(monkeypatch):
    for data in [{'volume':101},{'volume':-1},{'volume':True},{'volume':12.5},{'muted':'false'},{'device':'anything'}]:
        with pytest.raises(ValidationError):audio.AudioChange(**data)
    monkeypatch.setattr(audio,'run',lambda *a:'')
    with pytest.raises(HTTPException) as e:audio.status()
    assert e.value.status_code==503
