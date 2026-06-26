import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  // During build time or fallback, we don't want to crash the process immediately,
  // but we should warn or handle it if we attempt to use it.
  console.warn('Warning: Environment variable "MONGODB_URI" is not defined.');
}

const uri = process.env.MONGODB_URI || 'mongodb+srv://99storedbuser:N65qUyPOrnr28OQ6@cluster0.mdbcuhy.mongodb.net/?appName=Cluster0';
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // Cache the client promise in development mode to prevent HMR from creating multiple connections
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

export async function getDatabase() {
  const client = await clientPromise;
  // If the MONGODB_URI has a database specified (e.g. mongodb+srv://.../dbname), client.db() will automatically use it.
  return client.db();
}
