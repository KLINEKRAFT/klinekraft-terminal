#!/usr/bin/env bash
# Dedicated app window, using the existing Chromium profile to retain preferences.
set -eu
systemctl --user start klinekraft.service
ready=0
for attempt in $(seq 1 30); do
  if curl --max-time 2 -fsS http://127.0.0.1:8000/ >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  message='Klinekraft Terminal could not start. Check: systemctl --user status klinekraft.service'
  printf '%s\n' "$message" >&2
  if command -v zenity >/dev/null; then zenity --error --text="$message"; fi
  exit 1
fi
for browser in chromium chromium-browser; do
  if command -v "$browser" >/dev/null; then
    exec "$browser" --app=http://127.0.0.1:8000/ --class=KlinekraftTerminal --start-maximized
  fi
done
printf '%s\n' 'Chromium is required for the installed Terminal application.' >&2
exit 1
