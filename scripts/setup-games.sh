#!/usr/bin/env bash
set -euo pipefail
if [[ $(id -u) == 0 ]]; then echo 'Run as your Pi desktop user, not with sudo.' >&2; exit 1; fi
if [[ $(uname -s) != Linux ]]; then echo 'This installer runs on the Pi, not your Mac.' >&2; exit 1; fi
if [[ $# != 1 || ! -d "$1" ]]; then echo 'Usage: bash scripts/setup-games.sh "/path/to/retropie/roms"' >&2; exit 1; fi
source_dir="$(cd "$1" && pwd)"
cd "$(dirname "$0")/.."
if [[ "$PWD" != "$HOME/klinekraft-terminal" ]]; then echo 'Expected project at ~/klinekraft-terminal.' >&2; exit 1; fi
if [[ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then echo 'Run this from Terminal on the Pi desktop, so games have a display.' >&2; exit 1; fi
sudo apt-get update
packages=(retroarch libretro-nestopia)
for package in libretro-snes9x libretro-genesisplusgx; do
  candidate="$(apt-cache policy "$package" | awk '/Candidate:/ {print $2}')"
  if [[ -n "$candidate" && "$candidate" != '(none)' ]]; then packages+=("$package");
  else echo "NOTICE: $package is unavailable in your apt sources. Its games will stay disabled until that core is installed (Debian non-free)."; fi
done
sudo apt-get install -y "${packages[@]}"
.venv/bin/python -m pip install -e ./backend
.venv/bin/python -m klinekraft.game_import "$source_dir"
mkdir -p "$HOME/.config/systemd/user/klinekraft.service.d" "$HOME/.config/autostart"
cat > "$HOME/.config/systemd/user/klinekraft.service.d/games.conf" <<'UNIT'
[Service]
Environment=KLINEKRAFT_GAMES=1
# RetroArch needs the logged-in desktop's X11 socket when using X11/XWayland.
PrivateTmp=false
UNIT
cat > "$HOME/.config/autostart/klinekraft-games-session.desktop" <<ENTRY
[Desktop Entry]
Type=Application
Name=Klinekraft game session
Exec=/usr/bin/bash "$PWD/scripts/games-session.sh"
NoDisplay=true
Terminal=false
ENTRY
systemctl --user daemon-reload
bash scripts/games-session.sh
printf '\nGames setup finished. Refresh Klinekraft and open Games.\nIf a core is missing, its Play buttons explain why. Test the controller in RetroArch before relying on it.\n'
