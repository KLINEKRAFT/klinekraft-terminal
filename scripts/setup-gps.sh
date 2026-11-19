#!/usr/bin/env bash
# Install only the receiver daemon and lightweight terminal diagnostics.
set -euo pipefail
if [[ $(id -u) != 0 ]]; then
  echo 'Run with sudo bash scripts/setup-gps.sh /dev/serial/by-id/RECEIVER' >&2
  exit 1
fi
device=${1:?Supply the receiver path from /dev/serial/by-id}
[[ "$device" == /dev/serial/by-id/* && -c "$device" ]] || { echo 'Receiver must be a connected serial device under /dev/serial/by-id.' >&2; exit 1; }
apt-get install -y --no-install-recommends gpsd gpsd-tools
[[ -e /etc/default/gpsd.before-klinekraft ]] || cp -a /etc/default/gpsd /etc/default/gpsd.before-klinekraft
python3 - "$device" <<'PY'
import shlex,sys
from pathlib import Path
# The systemd EnvironmentFile uses shell-style quotes for this device path.
p=Path('/etc/default/gpsd')
p.write_text('DEVICES='+shlex.quote(sys.argv[1])+'\nGPSD_OPTIONS="-n -b"\nUSBAUTO="true"\n')
PY
systemctl enable --now gpsd.socket gpsd.service
systemctl restart gpsd.service
printf 'GPS configured; use Maps > GPS or cgps -s. A clear sky view is needed.\n'
