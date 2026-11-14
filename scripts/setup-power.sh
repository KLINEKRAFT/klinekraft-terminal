#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
sudo apt-get install -y python3-smbus2 gpiod
sudo install -d -m 755 /usr/local/lib/klinekraft-power
sudo install -m 644 "$repo_root/backend/klinekraft/battery.py" "$repo_root/backend/klinekraft/power_policy.py" "$repo_root/scripts/battery-guard.py" /usr/local/lib/klinekraft-power/
sudo install -m 644 "$repo_root/deploy/systemd/klinekraft-battery-guard.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now klinekraft-battery-guard.service
