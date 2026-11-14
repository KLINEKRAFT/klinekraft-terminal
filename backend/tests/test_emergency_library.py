import importlib.util
from pathlib import Path
import subprocess
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('emergency_loader', Path(__file__).parents[2] / 'scripts/load-emergency-library.py')
loader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loader)


def test_utf8_chunks_preserve_all_content_and_stay_bounded():
    text = ('Emergency water — café\n' * 3000)
    chunks = list(loader.pieces(text))
    assert ''.join(chunks) == text
    assert all(len(chunk.encode()) <= 24000 for chunk in chunks)


def test_failed_pdf_split_does_not_publish_partial_source(tmp_path, monkeypatch):
    source = dict(title='Test Manual', category='Test', url='https://example.org/manual.pdf')
    published = tmp_path / 'Searchable/Test'
    published.mkdir(parents=True)
    old = published / 'Test Manual (PDF pages 001-004).pdf'
    old.write_bytes(b'previous complete edition')

    def run(args, **kwargs):
        if args[0] == 'curl':
            Path(args[args.index('-o') + 1]).write_bytes(b'%PDF-test')
            return SimpleNamespace(stdout='application/pdf\nhttps://example.org/manual.pdf')
        target = next(arg.split('=', 1)[1] for arg in args if arg.startswith('-sOutputFile='))
        if '-dFirstPage=5' in args:
            raise subprocess.CalledProcessError(1, args, stderr=b'Invalid page')
        Path(target).write_bytes(b'%PDF-section')
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(loader.subprocess, 'run', run)
    monkeypatch.setattr(loader.subprocess, 'check_output', lambda args, **kw: 'Pages: 8\n' if args[0] == 'pdfinfo' else b'valid searchable text')
    result = loader.download(source, tmp_path, '2026-11-13')
    assert result['status'] == 'failed'
    assert old.read_bytes() == b'previous complete edition'
    assert list(published.iterdir()) == [old]
