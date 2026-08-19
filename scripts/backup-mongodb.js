const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { MongoClient } = require('mongodb');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

// Read MONGODB_URI from .env.local if not set in process.env
let uri = process.env.MONGODB_URI;
if (!uri) {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/MONGODB_URI=(.+)/);
    if (match) {
      uri = match[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}

if (!uri) {
  console.error('ERROR: MONGODB_URI is not set in environment or .env.local!');
  process.exit(1);
}

async function backupMongoDB() {
  console.log('Connecting to MongoDB Atlas for backup...');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

  try {
    await client.connect();
    const db = client.db('99store-oms');

    const backupData = {
      timestamp: new Date().toISOString(),
      users: await db.collection('users').find({}).toArray(),
      orders: await db.collection('orders').find({}).toArray(),
      ndr: await db.collection('ndr').find({}).toArray(),
      whatsappLogs: await db.collection('whatsappLogs').find({}).toArray(),
      courierLogs: await db.collection('courierLogs').find({}).toArray(),
      settings: await db.collection('settings').findOne({ key: 'system-settings' }) || {},
      messages: await db.collection('messages').find({}).toArray(),
      tracking_events: await db.collection('tracking_events').find({}).toArray(),
      bulk_jobs: await db.collection('bulk_jobs').find({}).toArray()
    };

    const backupDir = path.join(__dirname, '..', 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filename = `db-backup-mongo-${Date.now()}.json`;
    const backupPath = path.join(backupDir, filename);

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    const stats = fs.statSync(backupPath);
    console.log(`=========================================`);
    console.log(`MongoDB Weekly Backup Successful!`);
    console.log(`File: ${backupPath}`);
    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Orders Backed Up: ${backupData.orders.length}`);
    console.log(`=========================================`);
  } catch (err) {
    console.error('Backup failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

backupMongoDB();
