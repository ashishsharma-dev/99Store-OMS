import dns from 'dns';

// Configure DNS fallback before loading MongoDB client to fix Windows querySrv ECONNREFUSED
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

let clientPromise: Promise<any> | null = null;
let indexesPromise: Promise<void> | null = null;
let lastFailureTime = 0;
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown on failure

async function ensureIndexes(database: any) {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      database.collection('courierLogs').createIndex({ timestamp: -1 }, { name: 'courier_logs_timestamp_desc' }),
      database.collection('whatsappLogs').createIndex({ timestamp: -1 }, { name: 'whatsapp_logs_timestamp_desc' }),
      database.collection('orders').createIndex({ createdAt: -1 }, { name: 'orders_created_desc' }),
      database.collection('orders').createIndex({ status: 1, createdAt: -1 }, { name: 'orders_status_created_desc' }),
      database.collection('orders').createIndex({ updatedAt: -1 }, { name: 'orders_updated_desc' }),
      database.collection('orders').createIndex({ status: 1, updatedAt: -1 }, { name: 'orders_status_updated_desc' }),
    ]).then(() => undefined).catch((error) => {
      indexesPromise = null;
      console.warn('MongoDB index initialization failed:', error);
    });
  }
  await indexesPromise;
}

export async function getDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (process.env.USE_MONGODB !== 'true' || !mongoUri) {
    return null;
  }

  // Fast check: If MongoDB failed recently, don't attempt reconnection for 5 mins
  if (lastFailureTime > 0 && Date.now() - lastFailureTime < FAILURE_COOLDOWN_MS) {
    return null;
  }

  if (!clientPromise) {
    try {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
      } catch (e) {}

      // Dynamically import mongodb so dns.setServers executes beforehand
      const { MongoClient } = await import('mongodb');
      const client = new MongoClient(mongoUri, {
        serverSelectionTimeoutMS: 1000,
        connectTimeoutMS: 1000,
        maxPoolSize: 10,
        minPoolSize: 1,
        family: 4,
      });
      clientPromise = client.connect();
    } catch (e) {
      console.warn('MongoDB client initialization failed:', e);
      lastFailureTime = Date.now();
      clientPromise = null;
      return null;
    }
  }

  try {
    const client = await clientPromise;
    lastFailureTime = 0; // Reset on success
    const database = client.db('99store-oms');
    void ensureIndexes(database);
    return database;
  } catch (err) {
    console.warn('MongoDB connection failed, falling back to local database:', err);
    lastFailureTime = Date.now(); // Record failure timestamp
    clientPromise = null; // Reset promise so next attempt after cooldown creates fresh client
    return null;
  }
}

export default getDatabase;

