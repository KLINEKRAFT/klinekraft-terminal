#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
routing_root="$HOME/.local/share/klinekraft/routing"
sudo apt-get install -y default-jre-headless unzip
mkdir -p "$routing_root/customprofiles" "$HOME/.config/systemd/user"
if [ ! -f "$routing_root/brouter-1.7.10/brouter-1.7.10-all.jar" ]; then
  temporary=$(mktemp -d)
  trap 'rm -rf -- "$temporary"' EXIT
  curl -fL --retry 2 'https://github.com/abrensch/brouter/releases/download/v1.7.10/brouter-1.7.10.zip' -o "$temporary/brouter.zip"
  echo "023fec3ba997758e8cd7ab9e1bae52e962af3f00b57683e3de86b84ffad01532  $temporary/brouter.zip" | sha256sum -c -
  unzip -q "$temporary/brouter.zip" -d "$routing_root"
fi
python3 "$repo_root/scripts/download-routing.py"
install -m 644 "$repo_root/deploy/systemd/klinekraft-routing.service" "$HOME/.config/systemd/user/klinekraft-routing.service"
systemctl --user daemon-reload
systemctl --user enable --now klinekraft-routing.service
