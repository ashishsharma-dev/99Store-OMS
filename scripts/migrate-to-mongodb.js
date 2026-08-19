const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { MongoClient } = require('mongodb');

// Ensure SRV DNS resolution succeeds on Windows network setups
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

// Read MONGODB_URI from .env.local if not present in process.env
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

async function migrateData() {
  const dbPath = path.join(__dirname, '..', 'data', 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error(`ERROR: Local database file not found at ${dbPath}`);
    process.exit(1);
  }

  console.log('Reading local data/db.json...');
  const localData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  console.log(`Connecting to MongoDB Atlas...`);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

  try {
    await client.connect();
    const db = client.db('99store-oms');
    console.log('Connected to MongoDB database: 99store-oms\n');

    // 1. Migrate Users
    const users = localData.users || [];
    if (users.length > 0) {
      console.log(`Migrating ${users.length} users...`);
      const ops = users.map(u => {
        const { _id, ...doc } = u;
        return {
          replaceOne: {
            filter: { id: doc.id || doc.username },
            replacement: doc,
            upsert: true
          }
        };
      });
      await db.collection('users').bulkWrite(ops);
      console.log(`Successfully migrated ${users.length} users.`);
    }

    // 2. Migrate Orders
    const orders = localData.orders || [];
    if (orders.length > 0) {
      console.log(`Migrating ${orders.length} orders...`);
      // Process in batches of 1000 to prevent BSON/memory overflow
      const batchSize = 1000;
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        const ops = batch.map(o => {
          const { _id, ...doc } = o;
          const key = doc.id || doc.orderId;
          return {
            replaceOne: {
              filter: key ? { id: key } : { orderId: doc.orderId },
              replacement: doc,
              upsert: true
            }
          };
        });
        await db.collection('orders').bulkWrite(ops);
        console.log(`   Processed orders batch ${i + 1} - ${Math.min(i + batchSize, orders.length)} / ${orders.length}`);
      }
      console.log(`Successfully migrated ${orders.length} orders.`);
    }

    // 3. Migrate NDR records
    const ndr = localData.ndr || [];
    if (ndr.length > 0) {
      console.log(`Migrating ${ndr.length} NDR records...`);
      const ops = ndr.map(n => {
        const { _id, ...doc } = n;
        const key = doc.id || doc.orderId;
        return {
          replaceOne: {
            filter: key ? { id: key } : { orderId: doc.orderId },
            replacement: doc,
            upsert: true
          }
        };
      });
      await db.collection('ndr').bulkWrite(ops);
      console.log(`Successfully migrated ${ndr.length} NDR records.`);
    }

    // 4. Migrate WhatsApp Logs
    const whatsappLogs = localData.whatsappLogs || [];
    if (whatsappLogs.length > 0) {
      console.log(`Migrating ${whatsappLogs.length} WhatsApp logs...`);
      const batchSize = 1000;
      for (let i = 0; i < whatsappLogs.length; i += batchSize) {
        const batch = whatsappLogs.slice(i, i + batchSize);
        const ops = batch.map(l => {
          const { _id, ...doc } = l;
          return {
            replaceOne: {
              filter: { id: doc.id || `log_${Math.random()}` },
              replacement: doc,
              upsert: true
            }
          };
        });
        await db.collection('whatsappLogs').bulkWrite(ops);
      }
      console.log(`Successfully migrated ${whatsappLogs.length} WhatsApp logs.`);
    }

    // 5. Migrate Courier Logs
    const courierLogs = localData.courierLogs || [];
    if (courierLogs.length > 0) {
      console.log(`Migrating ${courierLogs.length} Courier logs...`);
      const batchSize = 1000;
      for (let i = 0; i < courierLogs.length; i += batchSize) {
        const batch = courierLogs.slice(i, i + batchSize);
        const ops = batch.map(l => {
          const { _id, ...doc } = l;
          return {
            replaceOne: {
              filter: { id: doc.id || `clog_${Math.random()}` },
              replacement: doc,
              upsert: true
            }
          };
        });
        await db.collection('courierLogs').bulkWrite(ops);
      }
      console.log(`Successfully migrated ${courierLogs.length} Courier logs.`);
    }

    // 6. Migrate Messages
    const messages = localData.messages || [];
    if (messages.length > 0) {
      console.log(`Migrating ${messages.length} messages...`);
      const ops = messages.map(m => {
        const { _id, ...doc } = m;
        return {
          replaceOne: {
            filter: { id: doc.id },
            replacement: doc,
            upsert: true
          }
        };
      });
      await db.collection('messages').bulkWrite(ops);
      console.log(`Successfully migrated ${messages.length} messages.`);
    }

    // 7. Migrate Tracking Events
    const trackingEvents = localData.tracking_events || [];
    if (trackingEvents.length > 0) {
      console.log(`Migrating ${trackingEvents.length} tracking events...`);
      const ops = trackingEvents.map(te => {
        const { _id, ...doc } = te;
        return {
          replaceOne: {
            filter: { id: doc.id || doc.awb || `te_${Math.random()}` },
            replacement: doc,
            upsert: true
          }
        };
      });
      await db.collection('tracking_events').bulkWrite(ops);
      console.log(`Successfully migrated ${trackingEvents.length} tracking events.`);
    }

    // 8. Migrate Settings
    const settings = localData.settings;
    if (settings && Object.keys(settings).length > 0) {
      console.log(`Migrating system settings...`);
      const { _id, ...doc } = settings;
      await db.collection('settings').replaceOne(
        { key: 'system-settings' },
        { ...doc, key: 'system-settings' },
        { upsert: true }
      );
      console.log(`Successfully migrated system settings.`);
    }

    console.log('\n=========================================');
    console.log('Migration Completed Successfully!');
    console.log('All collections have been imported to MongoDB Atlas.');
    console.log('=========================================');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrateData();
