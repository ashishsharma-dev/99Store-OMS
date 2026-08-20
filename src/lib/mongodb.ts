import dns from 'dns';

// Configure DNS fallback before loading MongoDB client to fix Windows querySrv ECONNREFUSED
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

let clientPromise: Promise<any> | null = null;
let lastFailureTime = 0;
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown on failure

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
    return client.db('99store-oms');
  } catch (err) {
    console.warn('MongoDB connection failed, falling back to local database:', err);
    lastFailureTime = Date.now(); // Record failure timestamp
    clientPromise = null; // Reset promise so next attempt after cooldown creates fresh client
    return null;
  }
}

export default getDatabase;

