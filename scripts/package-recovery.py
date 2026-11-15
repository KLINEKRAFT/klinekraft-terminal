#!/usr/bin/env python3
"""Package a completed encrypted restic repository into checksummed upload parts."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def package(repository, destination, chunk_bytes=64*1024*1024):
    if chunk_bytes <= 0:
        raise ValueError('Part size must be positive.')
    repository, destination = Path(repository).resolve(), Path(destination).resolve()
    if destination.is_relative_to(repository):
        raise ValueError('Upload parts must be outside the encrypted repository.')
    if not (repository/'config').is_file() or not any((repository/'snapshots').iterdir()):
        raise ValueError('A completed restic repository is required.')
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    if list(destination.glob('repository.tar.part-*')):
        raise ValueError('Upload parts already exist; use a new destination.')
    command=['tar', '--exclude='+repository.name+'/locks', '--exclude='+repository.name+'/tmp',
             '-C', str(repository.parent), '-cf', '-', repository.name]
    process=subprocess.Popen(command, stdout=subprocess.PIPE)
    manifest=[]
    try:
        done=False
        while not done:
            name=f'repository.tar.part-{len(manifest):04d}'
            size=0; sha=hashlib.sha256(); md5=hashlib.md5()
            path=destination/name
            with path.open('xb') as output:
                path.chmod(0o600)
                while size<chunk_bytes:
                    data=process.stdout.read(min(4*1024*1024,chunk_bytes-size))
                    if not data: done=True;break
                    output.write(data);sha.update(data);md5.update(data);size+=len(data)
            if not size:
                path.unlink();break
            manifest.append({'name':name,'bytes':size,'sha256':sha.hexdigest(),'md5':md5.hexdigest()})
            with (destination/'completed-parts.jsonl').open('a') as progress:
                progress.write(json.dumps(manifest[-1])+'\n')
            print(f'Packaged {name}: {size} bytes',flush=True)
        if process.wait()!=0:raise RuntimeError('tar failed; incomplete parts must not be marked complete.')
    finally:
        process.stdout.close()
        if process.poll() is None:process.terminate();process.wait()
    (destination/'parts.json').write_text(json.dumps(manifest,indent=2))
    (destination/'SHA256SUMS').write_text(''.join(f"{p['sha256']}  {p['name']}\n" for p in manifest))
    (destination/'MD5SUMS').write_text(''.join(f"{p['md5']}  {p['name']}\n" for p in manifest))
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repository',type=Path);parser.add_argument('destination',type=Path)
    args=parser.parse_args();package(args.repository,args.destination)
