#!/bin/bash
# 99Store OMS VPS Deployment Script
# Target Directory: /home/ayurvedacare/99store-oms

set -e

APP_DIR="/home/ayurvedacare/99store-oms"

echo "========================================="
echo " 🚀 Deploying 99Store OMS to VPS "
echo " Target: $APP_DIR"
echo " Date: $(date)"
echo "========================================="

# Navigate to app directory
cd "$APP_DIR"

# 1. Pull latest code from GitHub
echo "📥 1. Pulling latest code from GitHub..."
git pull origin master

# 2. Install dependencies
echo "📦 2. Installing Node modules..."
npm install --production=false

# 3. Build Next.js production bundle
echo "🏗️  3. Building Next.js production app..."
npm run build

# 4. Clean up / prune db.json if bloated (> 1MB)
if [ -f "data/db.json" ]; then
    echo "🧹 4. Checking database file health..."
    node -e '
    const fs = require("fs");
    const p = "data/db.json";
    if (fs.existsSync(p)) {
      const stats = fs.statSync(p);
      if (stats.size > 1024 * 1024) {
        console.log(`Pruning large db.json (${(stats.size/1024/1024).toFixed(2)} MB)...`);
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data.settings && data.settings.xpressbeesAwbPool && data.settings.xpressbeesAwbPool.length > 500) {
          data.settings.xpressbeesAwbPool = data.settings.xpressbeesAwbPool.slice(0, 500);
        }
        if (data.whatsappLogs && data.whatsappLogs.length > 100) {
          data.whatsappLogs = data.whatsappLogs.slice(0, 100);
        }
        if (data.courierLogs && data.courierLogs.length > 100) {
          data.courierLogs = data.courierLogs.slice(0, 100);
        }
        fs.writeFileSync(p, JSON.stringify(data));
        console.log("Database file optimized successfully.");
      }
    }
    '
fi

# 5. Restart PM2 Process cleanly
echo "🔄 5. Reloading PM2 process manager..."
if pm2 list | grep -q "99store-oms"; then
    pm2 restart ecosystem.config.js --update-env
else
    pm2 start ecosystem.config.js
fi

# Save PM2 state
pm2 save

echo "========================================="
echo " ✅ Deployment completed successfully! "
echo " App status: online "
echo "========================================="
