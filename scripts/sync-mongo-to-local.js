const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Try reading MONGODB_URI from .env.local or process.env
let uri = process.env.MONGODB_URI;
if (!uri) {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/MONGODB_URI=(.+)/);
    if (match) {
      uri = match[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}

async function syncMongoToLocal() {
  const dbPath = path.join(process.cwd(), 'data', 'db.json');
  let localData = { users: [], orders: [], ndr: [], whatsappLogs: [], courierLogs: [], settings: {}, messages: [], tracking_events: [], bulk_jobs: [] };
  
  if (fs.existsSync(dbPath)) {
    try {
      localData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {}
  }

  if (!uri) {
    console.log('No MONGODB_URI found in environment or .env.local.');
    return;
  }

  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('99store-oms');
    console.log('Connected to MongoDB 99store-oms!');

    const mongoOrders = await db.collection('orders').find({}).toArray();
    console.log(`Fetched ${mongoOrders.length} orders from MongoDB.`);

    if (mongoOrders.length > 0) {
      const ordersMap = new Map();
      
      // Load existing local orders
      (localData.orders || []).forEach(o => {
        const key = o.id || o.orderId;
        if (key) ordersMap.set(key, o);
      });

      // Merge MongoDB orders (overwriting with latest from Mongo)
      mongoOrders.forEach(o => {
        const { _id, ...rest } = o;
        const key = rest.id || rest.orderId;
        if (key) ordersMap.set(key, rest);
      });

      localData.orders = Array.from(ordersMap.values());
      fs.writeFileSync(dbPath, JSON.stringify(localData, null, 2), 'utf8');
      console.log(`Successfully merged ${localData.orders.length} total orders into data/db.json!`);
    } else {
      console.log('No orders found in MongoDB.');
    }
  } catch (err) {
    console.error('Error syncing from MongoDB:', err.message);
  } finally {
    await client.close();
  }
}

syncMongoToLocal();
