#!/usr/bin/env bash
set -eu
repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
install -d "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/128x128/apps" "$HOME/.config/autostart"
if [ -f "$HOME/.local/bin/start-klinekraft" ] && [ ! -f "$HOME/.local/bin/start-klinekraft.pre-app" ]; then
  cp -p "$HOME/.local/bin/start-klinekraft" "$HOME/.local/bin/start-klinekraft.pre-app"
fi
install -m 755 "$repo/scripts/start-terminal.sh" "$HOME/.local/bin/start-klinekraft"
install -m 644 "$repo/frontend/public/brand/logo-128.png" "$HOME/.local/share/icons/hicolor/128x128/apps/klinekraft-terminal.png"
cat > "$HOME/.local/share/applications/klinekraft-terminal.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Klinekraft Terminal
Comment=Local cyberdeck workspace, maps, notes and games
Exec="$HOME/.local/bin/start-klinekraft"
Icon=klinekraft-terminal
Terminal=false
Categories=Utility;
StartupNotify=true
StartupWMClass=KlinekraftTerminal
EOF
if [ -f "$HOME/.config/autostart/klinekraft-dashboard.desktop" ] && [ ! -f "$HOME/.config/autostart/klinekraft-dashboard.desktop.pre-app" ]; then
  cp -p "$HOME/.config/autostart/klinekraft-dashboard.desktop" "$HOME/.config/autostart/klinekraft-dashboard.desktop.pre-app"
fi
cp "$HOME/.local/share/applications/klinekraft-terminal.desktop" "$HOME/.config/autostart/klinekraft-dashboard.desktop"
if command -v desktop-file-validate >/dev/null; then
  desktop-file-validate "$HOME/.local/share/applications/klinekraft-terminal.desktop"
fi
if command -v update-desktop-database >/dev/null; then update-desktop-database "$HOME/.local/share/applications"; fi
printf '%s\n' 'Installed Klinekraft Terminal in the application menu and at desktop login.'
