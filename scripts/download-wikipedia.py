"""Download the newest small English 100-article collection from Kiwix."""
from pathlib import Path
import re
import shutil
import urllib.request

BASE = 'https://download.kiwix.org/zim/wikipedia/'
LIMIT = 1024 * 1024 * 1024  # The starter download must stay below 1 GiB.


def main():
    destination = Path.home() / 'Documents' / 'Wikipedia'
    destination.mkdir(parents=True, exist_ok=True)
    if any(destination.glob('*.zim')):
        print('An archive already exists; keeping your collection.')
        return
    with urllib.request.urlopen(BASE, timeout=60) as response:
        catalog = response.read(4 * 1024 * 1024).decode('utf-8')
    names = sorted(set(re.findall(r'wikipedia_en_100_(?:(?:mini|maxi)_)?\d{4}-\d{2}\.zim', catalog)))
    mini = [name for name in names if '_mini_' in name]
    if not names:
        raise SystemExit('No small English starter archive found. Choose a ZIM at https://library.kiwix.org and save it in ~/Documents/Wikipedia, then rerun setup.')
    name = (mini or names)[-1]
    target = destination / name
    partial = destination / (name + '.part')
    print(f'Downloading {name} (a selection, not the full Wikipedia).', flush=True)
    try:
        with urllib.request.urlopen(BASE + name, timeout=120) as response:
            size = int(response.headers.get('Content-Length', '0'))
            if size > LIMIT:
                raise RuntimeError('Starter archive exceeds the 1 GiB download limit.')
            if shutil.disk_usage(destination).free < (size or LIMIT) + 512 * 1024 * 1024:
                raise RuntimeError('Not enough free storage for this archive plus 512 MB headroom.')
            total = 0
            with partial.open('wb') as output:
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > LIMIT:
                        raise RuntimeError('Download exceeded the 1 GiB starter limit.')
                    output.write(chunk)
                    if total % (10 * 1024 * 1024) == 0:
                        print(f'{total // (1024 * 1024)} MB downloaded…', flush=True)
            if size and total != size:
                raise RuntimeError('Incomplete download. Rerun setup to try again.')
        with partial.open('rb') as check:
            if check.read(4) != b'ZIM\x04':
                raise RuntimeError('The download is not a ZIM archive.')
        partial.replace(target)
        print(f'Archive saved: {target.name}', flush=True)
    finally:
        partial.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
