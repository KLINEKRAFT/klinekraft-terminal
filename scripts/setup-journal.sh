#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
sudo install -d -m 755 /etc/systemd/journald.conf.d
sudo install -o root -g root -m 644 "$repo_root/deploy/systemd/klinekraft-journal.conf" /etc/systemd/journald.conf.d/60-klinekraft.conf
sudo systemctl restart systemd-journald.service
sudo journalctl --flush
echo 'Persistent boot logs enabled: 100 MB target, seven-day retention, 1 GB free-space reserve.'
