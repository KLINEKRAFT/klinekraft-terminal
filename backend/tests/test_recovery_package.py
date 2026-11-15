import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import pytest

spec=importlib.util.spec_from_file_location('package_recovery',Path(__file__).parents[2]/'scripts/package-recovery.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def test_split_repository_reassembles_and_checksums_match(tmp_path):
    repo=tmp_path/'repository';repo.mkdir();(repo/'config').write_bytes(b'encrypted-config')
    (repo/'snapshots').mkdir();(repo/'snapshots'/'snapshot').write_bytes(b'encrypted-snapshot')
    (repo/'locks').mkdir();(repo/'locks'/'lock').write_bytes(b'transient')
    dest=tmp_path/'parts';manifest=module.package(repo,dest,1024)
    stream=b''
    for item in manifest:
        data=(dest/item['name']).read_bytes();assert hashlib.sha256(data).hexdigest()==item['sha256'];assert len(data)==item['bytes'];stream+=data
    with tarfile.open(fileobj=io.BytesIO(stream)) as archive:
        assert archive.extractfile('repository/config').read()==b'encrypted-config'
        assert not any('/locks' in name for name in archive.getnames())
    with pytest.raises(ValueError):module.package(repo,dest,1024)
    with pytest.raises(ValueError):module.package(repo,repo/'nested',1024)
