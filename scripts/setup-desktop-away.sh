#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
for binary in swayidle chromium; do command -v "$binary" >/dev/null; done
# Refuse to compete with an existing display-idle daemon; review it first.
if pgrep -x swayidle >/dev/null && ! systemctl --user is-active --quiet klinekraft-idle.service; then
  echo 'An existing swayidle process needs review before installing Desktop Away.' >&2
  exit 1
fi
install -d "$HOME/.local/bin" "$HOME/.config/systemd/user" "$HOME/.config/autostart" "$HOME/.config/klinekraft"
install -m 755 "$repo_root/scripts/desktop-idle.py" "$HOME/.local/bin/klinekraft-desktop-idle"
install -m 755 "$repo_root/scripts/desktop-away-control.sh" "$HOME/.local/bin/klinekraft-away-control"
install -m 755 "$repo_root/scripts/start-desktop-away.sh" "$HOME/.local/bin/klinekraft-desktop-away"
install -m 644 "$repo_root/deploy/systemd/klinekraft-idle.service" "$HOME/.config/systemd/user/"
install -m 644 "$repo_root/deploy/systemd/klinekraft-away-window.service" "$HOME/.config/systemd/user/"
cat > "$HOME/.local/bin/klinekraft-start-idle" <<'START'
#!/usr/bin/env bash
set -eu
systemctl --user import-environment WAYLAND_DISPLAY DISPLAY XDG_RUNTIME_DIR
systemctl --user restart klinekraft-idle.service
START
chmod 755 "$HOME/.local/bin/klinekraft-start-idle"
cat > "$HOME/.config/autostart/klinekraft-idle.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Klinekraft desktop Away
Exec="$HOME/.local/bin/klinekraft-start-idle"
Terminal=false
NoDisplay=true
DESKTOP
systemctl --user daemon-reload
"$HOME/.local/bin/klinekraft-start-idle"
echo 'Desktop Away installed: 2 minutes idle, black screen at 5 minutes (hardware power-off disabled) by default.'
