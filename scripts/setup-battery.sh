#!/usr/bin/env bash
set -euo pipefail
if [[ $(id -u) == 0 ]]; then
  echo 'Run as your normal Pi desktop user, not with sudo.' >&2
  exit 1
fi
cd "$(dirname "$0")/.."
if [[ ! -e /dev/i2c-1 ]]; then
  if command -v raspi-config >/dev/null; then
    sudo raspi-config nonint do_i2c 0
    sudo modprobe i2c-dev
  else
    echo 'I2C bus 1 is not enabled and raspi-config is unavailable. Enable I2C in Raspberry Pi Configuration, reboot, then rerun this script.' >&2
    exit 1
  fi
fi
sudo apt-get install -y i2c-tools
sudo usermod -aG i2c "$(id -un)"
.venv/bin/python -m pip install -e './backend[battery]'
mkdir -p "$HOME/.config/systemd/user/klinekraft.service.d"
cat > "$HOME/.config/systemd/user/klinekraft.service.d/battery.conf" <<'UNIT'
[Service]
Environment=KLINEKRAFT_BATTERY=x1202
UNIT
systemctl --user daemon-reload
systemctl --user restart klinekraft.service
printf '\nX1202 read-only gauge configured. Reboot the Pi to activate I2C and group access.\nThen choose Settings > Dashboard data > Live computer.\nNo automatic shutdown or charge-control behavior has been installed.\n'
