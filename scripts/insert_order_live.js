const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');

try {
  if (!fs.existsSync(dbPath)) {
    console.error('Error: data/db.json does not exist. Make sure you are in the project root directory.');
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  if (!db.orders) {
    db.orders = [];
  }

  const existing = db.orders.find(o => o.orderId === '99S-1059');
  if (!existing) {
    db.orders.push({
      id: "ord-1059",
      orderId: "99S-1059",
      customerName: "Raghunandan Singh",
      phonePrimary: "+91 8057023592",
      phoneSecondary: "",
      phoneTertiary: "",
      address: "Plot No 25 Dwarika Dham Colony",
      pincode: "281121",
      state: "Uttar Pradesh",
      area: "Mathura",
      productDetails: "99Store Premium Ceramic Coffee Mug - Matte Black",
      paymentType: "COD",
      orderValue: 6165,
      weight: 1.5,
      createdBy: "admin",
      isVip: false,
      status: "OFD",
      awb: "1635310036396",
      courier: "Delhivery",
      eta: "2026-07-31",
      createdAt: "2026-07-27T12:48:47.721Z",
      updatedAt: "2026-07-31T11:49:46.597Z",
      history: [
        { status: "Created", timestamp: "2026-07-27T12:48:47.721Z", updatedBy: "admin", remarks: "Order imported via manual entry." },
        { status: "Label Generated", timestamp: "2026-07-27T12:48:48.000Z", updatedBy: "admin", remarks: "AWB 1635310036396 allocated." },
        { status: "Dispatched", timestamp: "2026-07-28T16:48:12.000Z", updatedBy: "tracking_user", remarks: "Handed over to Delhivery." },
        { status: "OFD", timestamp: "2026-07-31T11:49:46.597Z", updatedBy: "tracking_user", remarks: "Out for delivery" }
      ]
    });
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    console.log('Successfully inserted order 99S-1059 into your production database.');
  } else {
    console.log('Order 99S-1059 already exists in the database.');
  }
} catch (err) {
  console.error('Failed to parse or write to database:', err.message);
  process.exit(1);
}
