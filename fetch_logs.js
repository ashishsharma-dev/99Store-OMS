const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://99storedbuser:N65qUyPOrnr28OQ6@cluster0.mdbcuhy.mongodb.net/?appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    let targetDb = client.db();
    console.log("Connected to default DB:", targetDb.databaseName);
    
    const courierLogsColl = targetDb.collection("courierLogs");
    const logs = await courierLogsColl.find({}).sort({ timestamp: -1 }).limit(10).toArray();
    
    console.log(`\n=== FOUND ${logs.length} RECENT COURIER LOGS ===\n`);
    for (const log of logs) {
      console.log(`ID: ${log.id || log._id}`);
      console.log(`Timestamp: ${log.timestamp}`);
      console.log(`Courier: ${log.courier}`);
      console.log(`Action: ${log.action}`);
      console.log(`Status: ${log.status}`);
      console.log(`Request Payload:\n${log.requestPayload}`);
      console.log(`Response Payload:\n${log.responsePayload}`);
      console.log("-------------------------------------------\n");
    }
  } catch (err) {
    console.error("Error querying MongoDB:", err);
  } finally {
    await client.close();
  }
}

run();
