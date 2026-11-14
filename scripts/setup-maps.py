#!/usr/bin/env python3
"""Install a local Protomaps extract: lower 48 + Alaska, excluding Hawaii."""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSETS = 'https://raw.githubusercontent.com/protomaps/basemaps-assets/028c18f713baecad011301ff7a69acc39bcc2ae7'

def download(url, path):
    temporary = path.with_suffix(path.suffix + '.download')
    subprocess.run(['curl', '-fL', '--retry', '3', '-o', str(temporary), url], check=True)
    temporary.replace(path)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='Dated official Protomaps PMTiles URL')
    parser.add_argument('--pmtiles', default='pmtiles', help='Path to official go-pmtiles executable')
    parser.add_argument('--directory', type=Path, default=Path.home()/'.local/share/klinekraft/maps')
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(args.directory).free < 15 * 1024**3:
        parser.error('At least 15 GiB free is required for a new extract (existing maps remain until verified).')
    partial = args.directory/'united-states.pmtiles.partial'
    if partial.exists():
        parser.error(f'{partial} already exists; inspect the previous download before retrying.')
    subprocess.run([args.pmtiles, 'extract', args.source, str(partial), '--region='+str(ROOT/'assets/maps/us-without-hawaii.geojson'), '--maxzoom=14', '--download-threads=4'], check=True)
    subprocess.run([args.pmtiles, 'verify', str(partial)], check=True)
    fonts = args.directory/'fonts'
    fonts.mkdir(exist_ok=True)
    for start in range(0,65536,256):
        block = f'{start}-{start+255}.pbf'
        if not (fonts/block).exists():
            download(f'{ASSETS}/fonts/Noto%20Sans%20Regular/{block}', fonts/block)
    shutil.copyfile(ROOT/'assets/maps/Noto-Sans-OFL.txt', fonts/'OFL.txt')
    manifest = {'title':'United States — lower 48 + Alaska (no Hawaii)', 'bounds':[-180,24,180,72], 'center':[-98.5,39.8], 'maxzoom':14, 'downloaded':datetime.date.today().isoformat(), 'source':args.source, 'views':[{'name':'Lower 48','center':[-98.5,39.8],'zoom':3.5},{'name':'Alaska','center':[-152,64],'zoom':3.5}], 'attribution':'© OpenStreetMap contributors · Protomaps'}
    temporary = args.directory/'region.json.download'
    temporary.write_text(json.dumps(manifest, indent=2)+'\n')
    os.replace(partial, args.directory/'region.pmtiles')
    temporary.replace(args.directory/'region.json')
    print('Offline maps installed. Reopen GPS / Maps to load the new region.')

if __name__ == '__main__':
    main()
