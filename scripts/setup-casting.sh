#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
sudo apt-get install -y uxplay avahi-daemon avahi-utils gstreamer1.0-libav gstreamer1.0-plugins-bad gstreamer1.0-plugins-good gstreamer1.0-x gstreamer1.0-gl gstreamer1.0-pulseaudio
sudo systemctl enable --now avahi-daemon
mkdir -p "$HOME/.config/klinekraft" "$HOME/.config/systemd/user"
if [ ! -f "$HOME/.config/klinekraft/uxplayrc" ]; then
  (umask 077; printf '# Managed by Klinekraft Screen Cast\n' > "$HOME/.config/klinekraft/uxplayrc")
fi
install -m 644 "$repo_root/deploy/systemd/klinekraft-cast.service" "$HOME/.config/systemd/user/klinekraft-cast.service"
systemctl --user daemon-reload
# Opt-in only: no boot enablement and no automatic start.
echo 'Screen Cast installed. Start it from Terminal → Network.'
