import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('Error: Please set the MONGODB_URI environment variable.');
    process.exit(1);
  }

  const dbPath = path.join(process.cwd(), 'data', 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Local database file not found at ${dbPath}`);
    process.exit(1);
  }

  console.log('Reading local db.json...');
  const rawData = fs.readFileSync(dbPath, 'utf-8');
  let data: any;
  try {
    data = JSON.parse(rawData);
  } catch (err) {
    console.error('Error parsing db.json:', err);
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    console.log('Connected successfully!');

    // Helper to upload collection
    const uploadCollection = async (colName: string, items: any[]) => {
      if (!items || items.length === 0) {
        console.log(`Collection "${colName}" is empty, skipping...`);
        return;
      }
      console.log(`Uploading ${items.length} items to "${colName}" collection...`);
      await db.collection(colName).deleteMany({});
      await db.collection(colName).insertMany(items);
      console.log(`Finished uploading to "${colName}".`);
    };

    // Upload collections
    await uploadCollection('users', data.users);
    await uploadCollection('orders', data.orders);
    await uploadCollection('ndr', data.ndr);
    await uploadCollection('whatsappLogs', data.whatsappLogs);
    await uploadCollection('courierLogs', data.courierLogs);
    await uploadCollection('messages', data.messages);

    // Upload settings (single document)
    if (data.settings) {
      console.log('Uploading settings...');
      await db.collection('settings').deleteMany({});
      await db.collection('settings').insertOne({ ...data.settings, key: 'system-settings' });
      console.log('Finished uploading settings.');
    }

    console.log('\n🎉 Migration completed successfully! Your cloud database is now seeded with your local database records.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.close();
  }
}

run();
