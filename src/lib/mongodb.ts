import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
  serverSelectionTimeoutMS: 2000,
  connectTimeoutMS: 2000,
};

let clientPromise: Promise<MongoClient> | null = null;

export async function getDatabase() {
  // If MongoDB is not explicitly enabled or no URI is provided, skip MongoDB immediately
  if (process.env.USE_MONGODB !== 'true' || !uri) {
    return null;
  }

  if (!clientPromise) {
    try {
      const client = new MongoClient(uri, options);
      clientPromise = client.connect();
    } catch (e) {
      console.warn('MongoDB client initialization failed:', e);
      return null;
    }
  }

  try {
    const client = await clientPromise;
    return client.db();
  } catch (err) {
    console.warn('MongoDB connection failed, falling back to local database:', err);
    clientPromise = null; // Reset so future calls don't hang
    return null;
  }
}

export default getDatabase;
