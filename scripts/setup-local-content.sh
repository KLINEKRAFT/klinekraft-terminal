#!/usr/bin/env bash
set -euo pipefail
if [[ $(id -u) == 0 ]]; then
  echo 'Run this as your normal Pi desktop user, not with sudo.' >&2
  exit 1
fi
cd "$(dirname "$0")/.."
if [[ "$PWD" != "$HOME/klinekraft-terminal" ]]; then
  echo 'This installer expects the project at ~/klinekraft-terminal.' >&2
  exit 1
fi
sudo apt-get update
sudo apt-get install -y kiwix-tools
mkdir -p "$HOME/Documents/Wikipedia" "$HOME/Downloads" "$HOME/.config/systemd/user"
python3 scripts/download-wikipedia.py
install -m 644 deploy/klinekraft-wiki.service "$HOME/.config/systemd/user/klinekraft-wiki.service"
systemctl --user daemon-reload
systemctl --user enable klinekraft-wiki.service
systemctl --user restart klinekraft-wiki.service
.venv/bin/python - <<'PY'
import time
import urllib.request
for attempt in range(30):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8081/', timeout=2) as response:
            if response.status == 200 and b'kiwix' in response.read(65536).lower():
                print('Offline Wikipedia is ready. Open Library in Klinekraft.')
                break
    except OSError:
        pass
    time.sleep(1)
else:
    raise SystemExit('Kiwix did not become ready. Run: systemctl --user status klinekraft-wiki.service --no-pager -l')
PY
