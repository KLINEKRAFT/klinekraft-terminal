#!/usr/bin/env bash
set -eu
# A private profile and dedicated systemd cgroup isolate the screensaver from real work.
exec /usr/bin/chromium --user-data-dir="$HOME/.local/state/klinekraft/away-browser" \
  --no-first-run --no-default-browser-check --disable-session-crashed-bubble \
  --disable-background-networking --disable-extensions --disable-sync \
  --class=KlinekraftAway --kiosk --app='http://127.0.0.1:8000/?desktop-away=1'
