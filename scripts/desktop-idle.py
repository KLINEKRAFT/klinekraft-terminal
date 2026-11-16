#!/usr/bin/env python3
"""Run Wayland idle events. Settings are validated again at the process boundary."""
import json
import os
from pathlib import Path

def command(minutes):
    if type(minutes) is not int or minutes not in (0, 1, 2, 5, 10): minutes = 2
    if not minutes: return ['/usr/bin/sleep', 'infinity']
    # Separate Chromium service: never kill the user's regular browser.
    return ['/usr/bin/swayidle', '-w',
            'timeout', str(minutes * 60), '"$HOME/.local/bin/klinekraft-away-control" start',
            'resume', '"$HOME/.local/bin/klinekraft-away-control" resume',
            'timeout', str(max(5, minutes + 3) * 60),
            '"$HOME/.local/bin/klinekraft-away-control" blank',
            'resume', '"$HOME/.local/bin/klinekraft-away-control" resume']

if __name__ == '__main__':
    try:
        data = json.loads((Path.home()/'.config/klinekraft/desktop-away.json').read_text())
        minutes = data.get('idleMinutes', 2)
    except (OSError, ValueError, AttributeError): minutes = 2
    args = command(minutes)
    os.execv(args[0], args)
