#!/bin/sh
# Preserve the user's OAuth-file ownership while restic reads root-owned files.
set -eu
: "${KLINEKRAFT_BACKUP_USER:?Backup user must be specified}"
exec /usr/sbin/runuser -u "$KLINEKRAFT_BACKUP_USER" -- /usr/bin/rclone "$@"
