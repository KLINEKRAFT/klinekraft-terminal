#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob
archives=("$HOME/Documents/Wikipedia/"*.zim)
if ((${#archives[@]} == 0)); then
  echo 'No ZIM archives in ~/Documents/Wikipedia. Run scripts/setup-local-content.sh first.' >&2
  exit 1
fi
exec /usr/bin/kiwix-serve --address=127.0.0.1 --port=8081 "${archives[@]}"
