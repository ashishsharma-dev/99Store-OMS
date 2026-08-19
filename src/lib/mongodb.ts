import dns from 'dns';

// Configure DNS fallback before loading MongoDB client to fix Windows querySrv ECONNREFUSED
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

let clientPromise: Promise<any> | null = null;

export async function getDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (process.env.USE_MONGODB !== 'true' || !mongoUri) {
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
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      clientPromise = client.connect();
    } catch (e) {
      console.warn('MongoDB client initialization failed:', e);
      return null;
    }
  }

  try {
    const client = await clientPromise;
    return client.db('99store-oms');
  } catch (err) {
    console.warn('MongoDB connection failed, falling back to local database:', err);
    clientPromise = null; // Reset so future calls don't hang
    return null;
  }
}

export default getDatabase;
