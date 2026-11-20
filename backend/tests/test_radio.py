import pytest
from pydantic import ValidationError
from klinekraft import radio

def test_station_storage_survives_reads_and_deduplicates(tmp_path,monkeypatch):
    monkeypatch.setenv('KLINEKRAFT_DATA_DIR',str(tmp_path))
    assert radio.stations()[0]['url']==radio.KEXP
    station=radio.Station(name=' Test ',url='https://example.org/live.mp3')
    saved=radio.add(station)
    assert radio.add(station)['id']==saved['id']
    assert len(radio.stations())==2
    radio.remove(saved['id'])
    assert len(radio.stations())==1

def test_stream_input_cannot_be_command_or_local_file():
    for url in ['file:///etc/passwd','javascript:alert(1)','http://example.org/a','https://user:pass@example.org/a','https://example.org/a#x']:
        with pytest.raises(ValidationError):radio.Station(name='Test',url=url)
    with pytest.raises(ValidationError):radio.Station(name='  ',url='https://example.org/live')
