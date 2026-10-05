#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
    echo 'Run this installer as root.'
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install -o root -g root -m 644 \
    "$ROOT_DIR/ops/logrotate/99store-oms-pm2" \
    /etc/logrotate.d/99store-oms-pm2
install -o root -g root -m 644 \
    "$ROOT_DIR/ops/systemd/99store-oms-health.service" \
    /etc/systemd/system/99store-oms-health.service
install -o root -g root -m 644 \
    "$ROOT_DIR/ops/systemd/99store-oms-health.timer" \
    /etc/systemd/system/99store-oms-health.timer

logrotate --debug /etc/logrotate.d/99store-oms-pm2 >/dev/null
systemctl daemon-reload
systemctl start 99store-oms-health.service
systemctl enable --now 99store-oms-health.timer
systemctl --no-pager status 99store-oms-health.timer
