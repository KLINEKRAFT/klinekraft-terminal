import importlib.util
import io
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location('wiki_download', Path(__file__).resolve().parents[2] / 'scripts/download-wikipedia.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Response(io.BytesIO):
    def __init__(self, body, length=None):
        super().__init__(body)
        self.headers = {'Content-Length': str(len(body) if length is None else length)}


def test_download_selects_latest_small_archive(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, 'home', classmethod(lambda cls: tmp_path))
    monkeypatch.setattr(module.shutil, 'disk_usage', lambda p: type('Disk', (), {'free': 10**10})())
    calls = []
    def fetch(url, **kwargs):
        calls.append(url)
        if url == module.BASE:
            return Response(b'wikipedia_en_100_mini_2026-01.zim wikipedia_en_100_mini_2026-02.zim')
        return Response(b'ZIM\x04test')
    monkeypatch.setattr(module.urllib.request, 'urlopen', fetch)
    module.main()
    archive = tmp_path / 'Documents/Wikipedia/wikipedia_en_100_mini_2026-02.zim'
    assert archive.read_bytes() == b'ZIM\x04test'
    assert len(calls) == 2
    module.main()  # Existing archive must not trigger another download.
    assert len(calls) == 2


@pytest.mark.parametrize('body,length', [(b'not a zim', None), (b'ZIM\x04short', 100), (b'ZIM\x04', module.LIMIT + 1)])
def test_failed_download_does_not_leave_archive(tmp_path, monkeypatch, body, length):
    monkeypatch.setattr(Path, 'home', classmethod(lambda cls: tmp_path))
    monkeypatch.setattr(module.shutil, 'disk_usage', lambda p: type('Disk', (), {'free': 10**10})())
    def fetch(url, **kwargs):
        return Response(b'wikipedia_en_100_maxi_2026-01.zim') if url == module.BASE else Response(body, length)
    monkeypatch.setattr(module.urllib.request, 'urlopen', fetch)
    with pytest.raises(RuntimeError): module.main()
    assert list((tmp_path / 'Documents/Wikipedia').iterdir()) == []
