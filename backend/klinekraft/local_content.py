"""Read-only access to two local folders and the loopback Kiwix reader."""
from pathlib import Path
import http.client
import os
import stat
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse


def local_request(request: Request):
    # A custom header prevents unrelated websites from reading private local data.
    # Do not enable permissive CORS on these routes.
    if request.headers.get('x-klinekraft-client') != 'local-ui':
        raise HTTPException(403, 'Open this from the local Klinekraft dashboard.')


router = APIRouter(prefix='/api', dependencies=[Depends(local_request)])
ROOT_NAMES = {'documents': 'Documents', 'downloads': 'Downloads'}
MAX_DOWNLOAD = 100 * 1024 * 1024


def folder_root(root: str) -> Path:
    if root not in ROOT_NAMES:
        raise HTTPException(404, 'Unknown folder.')
    return Path.home() / ROOT_NAMES[root]


def safe_path(root: str, relative: str = '') -> Path:
    base = folder_root(root)
    path = Path(relative)
    if path.is_absolute() or any(part in ('..',) or part.startswith('.') for part in path.parts):
        raise HTTPException(403, 'This path is outside the available folders.')
    target = base / path
    # Never follow symlinks, including a symlinked Documents/Downloads root.
    current = base
    if current.is_symlink():
        raise HTTPException(403, 'Linked folders are not available.')
    for part in path.parts:
        current = current / part
        if current.is_symlink():
            raise HTTPException(403, 'Linked files and folders are not available.')
    if not target.resolve().is_relative_to(base.resolve()):
        raise HTTPException(403, 'This path is outside the available folders.')
    if not target.exists():
        raise HTTPException(404, 'Folder or file not found.')
    return target


@router.get('/files')
def list_files(response: Response, root: str = 'documents', path: str = ''):
    response.headers['Cache-Control'] = 'no-store'
    target = safe_path(root, path)
    if not target.is_dir():
        raise HTTPException(400, 'Choose a folder.')
    entries = []
    truncated = False
    try:
        with os.scandir(target) as children:
            for child in children:
                if child.name.startswith('.') or child.is_symlink():
                    continue
                try:
                    info = child.stat(follow_symlinks=False)
                except OSError:
                    continue
                if not (stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode)):
                    continue
                if len(entries) >= 500:
                    truncated = True
                    break
                entries.append({'name': child.name, 'directory': stat.S_ISDIR(info.st_mode),
                                'size': info.st_size, 'modified': info.st_mtime})
    except PermissionError:
        raise HTTPException(403, 'This folder is not readable.')
    entries.sort(key=lambda item: (not item['directory'], item['name'].casefold()))
    return {'root': root, 'path': path, 'entries': entries, 'truncated': truncated}


@router.get('/files/download')
def download_file(root: str, path: str):
    target = safe_path(root, path)
    try:
        info = target.stat()
    except OSError:
        raise HTTPException(404, 'File is no longer available.')
    if not stat.S_ISREG(info.st_mode):
        raise HTTPException(400, 'Choose a regular file.')
    if info.st_size > MAX_DOWNLOAD:
        raise HTTPException(413, 'Browser downloads are limited to 100 MB. Use the desktop file manager for larger files.')
    return FileResponse(target, filename=target.name, media_type='application/octet-stream',
                        headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})


@router.get('/wiki')
def wiki_status(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    directory = Path.home() / 'Documents' / 'Wikipedia'
    try:
        archives = sorted(p.name for p in directory.glob('*.zim') if p.is_file() and not p.is_symlink())
    except OSError:
        archives = []
    online = False
    connection = http.client.HTTPConnection('127.0.0.1', 8081, timeout=2)
    try:
        connection.request('GET', '/')
        result = connection.getresponse()
        online = result.status == 200 and b'kiwix' in result.read(65536).lower()
    except (OSError, http.client.HTTPException):
        pass
    finally:
        connection.close()
    return {'ready': online, 'archives': archives, 'url': 'http://127.0.0.1:8081/' if online else None}
