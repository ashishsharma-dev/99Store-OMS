#!/usr/bin/env bash
set -Eeuo pipefail

ADMIN_ENV_FILE="${MONGODB_ADMIN_ENV_FILE:-/root/.99store-mongodb-admin.env}"
BACKUP_DIR="${MONGODB_BACKUP_DIR:-/root/99store-mongo-backups/scheduled}"
ARCHIVE="${1:-$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '99store-oms-*.archive.gz' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)}"
RESTORE_DB="99store-oms-restore-check-$(date -u +%Y%m%dT%H%M%SZ)"

command -v mongorestore >/dev/null
command -v mongosh >/dev/null
test -r "$ADMIN_ENV_FILE"
test -s "$ARCHIVE"
gzip -t "$ARCHIVE"

ADMIN_URI="$(sed -n 's/^MONGODB_ADMIN_URI=//p' "$ADMIN_ENV_FILE" | tail -n 1)"
test -n "$ADMIN_URI"

cleanup() {
    RESTORE_DB="$RESTORE_DB" mongosh "$ADMIN_URI" --quiet --eval '
      db.getSiblingDB(process.env.RESTORE_DB).dropDatabase();
    ' >/dev/null 2>&1 || true
}
trap cleanup EXIT

mongorestore \
    --uri "$ADMIN_URI" \
    --archive="$ARCHIVE" \
    --gzip \
    --nsInclude='99store-oms.*' \
    --nsFrom='99store-oms.*' \
    --nsTo="${RESTORE_DB}.*" \
    --quiet

RESTORE_DB="$RESTORE_DB" mongosh "$ADMIN_URI" --quiet --eval '
  const restored = db.getSiblingDB(process.env.RESTORE_DB);
  const counts = {
    orders: restored.orders.countDocuments({}),
    users: restored.users.countDocuments({}),
    settings: restored.settings.countDocuments({}),
  };
  if (counts.orders < 1 || counts.users < 1 || counts.settings < 1) quit(2);
  print(`Restore verification passed: orders=${counts.orders}, users=${counts.users}, settings=${counts.settings}`);
'
