#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
    echo 'Run this installer as root.'
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install -o root -g root -m 700 \
    "$ROOT_DIR/scripts/backup-mongodb.sh" \
    /usr/local/sbin/99store-mongodb-backup
install -o root -g root -m 644 \
    "$ROOT_DIR/ops/systemd/99store-mongodb-backup.service" \
    /etc/systemd/system/99store-mongodb-backup.service
install -o root -g root -m 644 \
    "$ROOT_DIR/ops/systemd/99store-mongodb-backup.timer" \
    /etc/systemd/system/99store-mongodb-backup.timer

systemctl daemon-reload
systemctl start 99store-mongodb-backup.service
systemctl enable --now 99store-mongodb-backup.timer
systemctl --no-pager status 99store-mongodb-backup.timer
