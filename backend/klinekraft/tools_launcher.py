"""Fixed desktop utility launchers; no user-provided commands or arguments."""
import os
import subprocess
import threading
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from .local_content import local_request

router = APIRouter(prefix='/api/tools', dependencies=[Depends(local_request)])
TOOLS = {
    'files': ('Files · nnn', 'Browse and manage local files.', '/usr/bin/nnn'),
    'monitor': ('System · btop', 'Inspect processes and resource use.', '/usr/bin/btop'),
    'music': ('Music · cmus', 'Play music stored on your Pi.', '/usr/bin/cmus'),
}
TERMINALS = ('/usr/bin/lxterminal', '/usr/bin/foot', '/usr/bin/xfce4-terminal', '/usr/bin/xterm')
lock = threading.Lock()
processes = {}


def terminal():
    return next((path for path in TERMINALS if os.access(path, os.X_OK)), None)


def readiness(tool_id):
    if os.environ.get('KLINEKRAFT_TOOLS') != '1':
        return 'Run Tools setup on the Pi desktop.'
    if not (os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY')):
        return 'Sign into the Pi desktop and run the desktop-session helper.'
    if not terminal(): return 'A supported terminal is not installed. Run Tools setup.'
    if not os.access(TOOLS[tool_id][2], os.X_OK): return 'Utility is not installed. Run Tools setup.'
    return None


@router.get('')
def list_tools(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return {'tools': [{'id': key, 'title': title, 'description': description, 'unavailable': readiness(key)}
                      for key, (title, description, _) in TOOLS.items()]}


class LaunchRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    tool_id: str


@router.post('/launch')
def launch_tool(body: LaunchRequest):
    if body.tool_id not in TOOLS: raise HTTPException(404, 'Unknown utility.')
    with lock:
        error = readiness(body.tool_id)
        if error: raise HTTPException(503, error)
        existing = processes.get(body.tool_id)
        if existing is not None and existing.poll() is None:
            raise HTTPException(409, 'This utility is already open. Switch to its terminal window.')
        # Some terminal clients exit successfully after handing off to an existing desktop process.
        # Do not claim that this process handle tracks the utility's lifetime in those cases.
        try:
            process = subprocess.Popen([terminal(), '-e', TOOLS[body.tool_id][2]],
                cwd=Path.home(), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, start_new_session=True)
            processes[body.tool_id] = process
            try:
                code = process.wait(timeout=0.4)
                if code != 0: raise HTTPException(503, 'Terminal could not start. Run Tools setup from the Pi desktop.')
            except subprocess.TimeoutExpired:
                pass
        except OSError:
            raise HTTPException(503, 'Unable to open the terminal. Check your desktop session.')
        return {'requested': True, 'title': TOOLS[body.tool_id][0]}
