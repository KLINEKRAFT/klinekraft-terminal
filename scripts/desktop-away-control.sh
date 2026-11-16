#!/usr/bin/env bash
set -eu
blank_marker="${XDG_RUNTIME_DIR:?}/klinekraft-away-blank"
case "${1:-}" in
  start)
    rm -f "$blank_marker"
    systemctl --user start --no-block klinekraft-away-window.service
    ;;
  blank)
    # Software black screen only: this Pi failed the HDMI power-on test.
    (umask 077; touch "$blank_marker")
    ;;
  resume)
    rm -f "$blank_marker"
    systemctl --user stop klinekraft-away-window.service
    ;;
  *) exit 2 ;;
esac
