#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

APP_DIR="${APP_DIR:-/home/ayurvedacare/99store-oms}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env.local}"
BACKUP_DIR="${MONGODB_BACKUP_DIR:-/root/99store-mongo-backups/scheduled}"
RETENTION_DAYS="${MONGODB_BACKUP_RETENTION_DAYS:-14}"

command -v mongodump >/dev/null
command -v gzip >/dev/null
command -v sha256sum >/dev/null
test -r "$ENV_FILE"

MONGODB_URI="$(sed -n 's/^MONGODB_URI=//p' "$ENV_FILE" | tail -n 1)"
MONGODB_URI="${MONGODB_URI%\"}"
MONGODB_URI="${MONGODB_URI#\"}"
test -n "$MONGODB_URI"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${BACKUP_DIR}/99store-oms-${STAMP}.archive.gz"

mongodump --uri "$MONGODB_URI" --db '99store-oms' --archive="$ARCHIVE" --gzip --quiet
test -s "$ARCHIVE"
gzip -t "$ARCHIVE"
sha256sum "$ARCHIVE" > "${ARCHIVE}.sha256"

find "$BACKUP_DIR" -type f -name '99store-oms-*.archive.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name '99store-oms-*.archive.gz.sha256' -mtime "+$RETENTION_DAYS" -delete

echo "MongoDB backup completed: $ARCHIVE"
