#!/usr/bin/env python3
"""Install BRouter segments covering lower 48 + Alaska (no Hawaii), with border overlap."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = 'https://brouter.de/brouter/segments4/'
ROOT = Path.home()/'.local/share/klinekraft/routing'

def main():
    index = urllib.request.urlopen(BASE, timeout=30).read().decode()
    selected = []
    for name, size in re.findall(r'href="([WE]\d+_[NS]\d+\.rd5)"[^\n]*?\s(\d+)\s*\n',index):
        m=re.match(r'([WE])(\d+)_([NS])(\d+)',name)
        lon=int(m[2])*(-1 if m[1]=='W' else 1);lat=int(m[4])*(-1 if m[3]=='S' else 1)
        if (-125<=lon<=-65 and 20<=lat<=45) or ((-180<=lon<=-130 or 170<=lon<=175) and 50<=lat<=70):
            selected.append((name,int(size)))
    if not selected: raise RuntimeError('No segments found; publisher index may have changed')
    dest=ROOT/'segments4';dest.mkdir(parents=True,exist_ok=True)
    print('Downloading',len(selected),'segments;',round(sum(s for _,s in selected)/1024**3,2),'GiB',flush=True)
    def download(item):
        name,size=item;path=dest/name
        if not path.exists() or path.stat().st_size != size:
            partial=path.with_suffix('.rd5.partial')
            subprocess.run(['curl','-fLsS','--retry','2','--max-time','300','-o',str(partial),BASE+name],check=True)
            # Index can change mid-download; a mismatch needs a fresh run, never publish partial data.
            if partial.stat().st_size != size: raise RuntimeError('Publisher size changed: '+name)
            partial.replace(path)
        with path.open('rb') as f: digest=hashlib.file_digest(f,'sha256').hexdigest()
        print('Ready',name,flush=True)
        return {'name':name,'bytes':size,'sha256':digest}
    with ThreadPoolExecutor(max_workers=2) as pool: records=list(pool.map(download,selected))
    staging=ROOT/'coverage.json.tmp';staging.write_text(json.dumps({'region':'Lower 48 and Alaska; no Hawaii. Border areas included.','source':BASE,'segments':records},indent=2));staging.replace(ROOT/'coverage.json')

if __name__=='__main__': main()
