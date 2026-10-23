#!/usr/bin/env bash
set -euo pipefail
variables=()
for name in DISPLAY WAYLAND_DISPLAY XAUTHORITY XDG_RUNTIME_DIR DBUS_SESSION_BUS_ADDRESS; do
  if [[ -n "${!name:-}" ]]; then variables+=("$name"); fi
done
if [[ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  echo 'Run this from a Terminal window on the Pi desktop.' >&2
  exit 1
fi
systemctl --user import-environment "${variables[@]}"
systemctl --user restart klinekraft.service
