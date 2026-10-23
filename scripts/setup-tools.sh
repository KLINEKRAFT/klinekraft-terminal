#!/usr/bin/env bash
set -euo pipefail
if [[ $(id -u) == 0 ]]; then echo 'Run as your desktop user, not with sudo.' >&2; exit 1; fi
cd "$(dirname "$0")/.."
if [[ "$PWD" != "$HOME/klinekraft-terminal" ]]; then echo 'Expected ~/klinekraft-terminal.' >&2; exit 1; fi
if [[ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then echo 'Run this from Terminal on the Pi desktop.' >&2; exit 1; fi
sudo apt-get update
sudo apt-get install -y lxterminal nnn btop cmus
.venv/bin/python -m pip install -e ./backend
mkdir -p "$HOME/.config/systemd/user/klinekraft.service.d" "$HOME/.config/autostart"
cat > "$HOME/.config/systemd/user/klinekraft.service.d/tools.conf" <<'UNIT'
[Service]
Environment=KLINEKRAFT_TOOLS=1
PrivateTmp=false
UNIT
# Reuse the existing desktop-session helper and autostart entry; it also serves Games.
cat > "$HOME/.config/autostart/klinekraft-games-session.desktop" <<ENTRY
[Desktop Entry]
Type=Application
Name=Klinekraft desktop session
Exec=/usr/bin/bash "$PWD/scripts/games-session.sh"
NoDisplay=true
Terminal=false
ENTRY
systemctl --user daemon-reload
bash scripts/games-session.sh
printf '\nTools are ready. Refresh Klinekraft and choose Home → Tools.\n'
