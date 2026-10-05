#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/ayurvedacare/99store-oms}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-master}"
HEALTH_URL="${HEALTH_URL:-https://oms.ayurvedacare.store/api/health}"

echo "========================================="
echo " Deploying 99Store OMS to VPS"
echo " Target: $APP_DIR"
echo " Date: $(date)"
echo "========================================="

cd "$APP_DIR"

for command_name in git npm pm2 curl mongodump; do
    command -v "$command_name" >/dev/null
done
test -f .env.local
test -f ecosystem.config.js

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Deployment stopped: the VPS worktree has uncommitted tracked changes."
    exit 1
fi

echo "1. Creating the pre-deployment MongoDB backup..."
bash scripts/backup-mongodb.sh

echo "2. Pulling the requested release with fast-forward protection..."
git fetch origin "$DEPLOY_BRANCH"
git merge --ff-only "origin/$DEPLOY_BRANCH"

echo "3. Installing the locked dependency tree..."
npm ci --include=dev

echo "4. Running production environment and release checks..."
npm run verify:env
npm run test
npm run lint -- --quiet

echo "5. Building the Next.js production app..."
npm run build

echo "6. Reloading the PM2 process..."
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo "7. Waiting for the public health check..."
HEALTH=''
for _ in $(seq 1 30); do
    HEALTH="$(curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null || true)"
    if [[ "$HEALTH" == *'"status":"healthy"'* ]]; then
        break
    fi
    sleep 2
done

if [[ "$HEALTH" != *'"status":"healthy"'* ]]; then
    echo "Deployment failed: the public health check did not become healthy."
    pm2 logs 99store-oms --lines 50 --nostream || true
    exit 1
fi

echo "========================================="
echo " Deployment completed and health-checked successfully."
echo "========================================="
