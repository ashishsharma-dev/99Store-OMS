import { getDatabase } from './mongodb';
import { User, Order, NdrRecord, SystemSettings, WhatsAppLog, CourierApiLog, Message } from './types';
import { mockUsers, mockSettings, mockOrders, mockNdrs, mockWhatsAppLogs, mockCourierLogs, mockMessages } from './mockData';
import fs from 'fs';
import path from 'path';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

// Helper to escape regex characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'db.json');

// Helper to read database file
function readLocalDbFile(): any {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading local db.json:', err);
  }
  return null;
}

// Helper to write database file atomically (write to temp first, then rename)
function writeLocalDbFile(data: any): void {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${DB_FILE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data), 'utf-8');
    fs.renameSync(tempPath, DB_FILE_PATH);
  } catch (err) {
    console.error('Error writing local db.json:', err);
  }
}

async function safeGetDb() {
  if (process.env.USE_MONGODB === 'true') {
    try {
      return await getDatabase();
    } catch (err) {
      return null;
    }
  }
  return null;
}

// Load local DB on startup
const localDb = readLocalDbFile() || {};

let memoryUsers: User[] = localDb.users || [...mockUsers];
let memoryOrders: Order[] = localDb.orders || [...mockOrders];
let memoryNdrs: NdrRecord[] = localDb.ndr || [...mockNdrs];
let memoryWhatsAppLogs: WhatsAppLog[] = localDb.whatsappLogs || [...mockWhatsAppLogs];
let memoryCourierLogs: CourierApiLog[] = localDb.courierLogs || [...mockCourierLogs];
let memorySettings: SystemSettings = localDb.settings ? { ...mockSettings, ...localDb.settings } : { ...mockSettings };
let memoryMessages: Message[] = localDb.messages || [...mockMessages];
let memoryTrackingEvents: any[] = localDb.tracking_events || [];
let memoryBulkJobs: any[] = localDb.bulk_jobs || [];

// Helper to sync memory state to db.json
function saveMemoryToLocalFile() {
  const data = {
    users: memoryUsers,
    orders: memoryOrders,
    ndr: memoryNdrs,
    whatsappLogs: memoryWhatsAppLogs,
    courierLogs: memoryCourierLogs,
    settings: memorySettings,
    messages: memoryMessages,
    tracking_events: memoryTrackingEvents,
    bulk_jobs: memoryBulkJobs
  };
  writeLocalDbFile(data);
}

// Helper to perform weekly backup if 7 days have passed since the last backup
async function performWeeklyBackupIfDue() {
  try {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // List existing backups
    const files = fs.readdirSync(backupDir);
    const backupFiles = files.filter(f => f.startsWith('db-backup-') && f.endsWith('.json'));

    let lastBackupTime = 0;
    if (backupFiles.length > 0) {
      const timestamps = backupFiles.map(f => {
        const match = f.match(/db-backup-(?:local-|mongo-)?(\d+)\.json/);
        return match ? parseInt(match[1]) : 0;
      });
      lastBackupTime = Math.max(...timestamps);
    }

    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (now - lastBackupTime >= oneWeekMs) {
      const database = await safeGetDb();
      let dataToBackup: any = null;

      if (database) {
        dataToBackup = {
          users: await database.collection('users').find({}).toArray(),
          orders: await database.collection('orders').find({}).toArray(),
          ndr: await database.collection('ndr').find({}).toArray(),
          whatsappLogs: await database.collection('whatsappLogs').find({}).toArray(),
          courierLogs: await database.collection('courierLogs').find({}).toArray(),
          settings: await database.collection('settings').findOne({ key: 'system-settings' }),
          messages: await database.collection('messages').find({}).toArray(),
          tracking_events: await database.collection('tracking_events').find({}).toArray()
        };
      } else {
        dataToBackup = readLocalDbFile();
      }

      if (dataToBackup) {
        const backupName = database ? `db-backup-mongo-${now}.json` : `db-backup-local-${now}.json`;
        const backupPath = path.join(backupDir, backupName);
        fs.writeFileSync(backupPath, JSON.stringify(dataToBackup, null, 2), 'utf-8');
        console.log(`Weekly database backup created at ${backupPath}`);
      }
    }
  } catch (err) {
    console.error('Weekly database backup failed:', err);
  }
}

function enrichUser(u: any): User {
  if (!u) return u;
  const { _id, ...rest } = u;
  const mock = mockUsers.find(m => m.username?.toLowerCase() === rest.username?.toLowerCase() || m.id === rest.id);
  return {
    ...mock,
    ...rest,
    password: rest.password || mock?.password,
    phone: rest.phone || mock?.phone || '9999999999'
  } as User;
}

export const db = {
  // Reset the database to mock data
  reset: async (): Promise<any> => {
    memoryUsers = [...mockUsers];
    memoryOrders = [...mockOrders];
    memoryNdrs = [...mockNdrs];
    memoryWhatsAppLogs = [...mockWhatsAppLogs];
    memoryCourierLogs = [...mockCourierLogs];
    memorySettings = { ...mockSettings };
    memoryMessages = [...mockMessages];
    memoryTrackingEvents = [];
    saveMemoryToLocalFile();
    performWeeklyBackupIfDue().catch(console.error);

    const database = await safeGetDb();
    if (database) {
      try {
        await database.collection('users').deleteMany({});
        await database.collection('orders').deleteMany({});
        await database.collection('ndr').deleteMany({});
        await database.collection('whatsappLogs').deleteMany({});
        await database.collection('courierLogs').deleteMany({});
        await database.collection('settings').deleteMany({});
        await database.collection('messages').deleteMany({});
        await database.collection('tracking_events').deleteMany({});

        if (mockUsers.length > 0) await database.collection('users').insertMany(mockUsers);
        if (mockOrders.length > 0) await database.collection('orders').insertMany(mockOrders);
        if (mockNdrs.length > 0) await database.collection('ndr').insertMany(mockNdrs);
        if (mockWhatsAppLogs.length > 0) await database.collection('whatsappLogs').insertMany(mockWhatsAppLogs);
        if (mockCourierLogs.length > 0) await database.collection('courierLogs').insertMany(mockCourierLogs);
        await database.collection('settings').insertOne({ ...mockSettings, key: 'system-settings' });
        if (mockMessages.length > 0) await database.collection('messages').insertMany(mockMessages);
      } catch (e) {
        console.warn('MongoDB reset warning:', e);
      }
    }

    return {
      users: memoryUsers,
      orders: memoryOrders,
      ndr: memoryNdrs,
      whatsappLogs: memoryWhatsAppLogs,
      courierLogs: memoryCourierLogs,
      settings: memorySettings,
      messages: memoryMessages,
    };
  },

  deleteAllOrders: async (): Promise<void> => {
    memoryOrders = [];
    memoryNdrs = [];
    memoryTrackingEvents = [];
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        await database.collection('orders').deleteMany({});
        await database.collection('ndr').deleteMany({});
        await database.collection('tracking_events').deleteMany({});
      } catch (e) {
        console.warn('MongoDB deleteAllOrders warning:', e);
      }
    }
  },

  // Users Operations
  getUsers: async (): Promise<User[]> => {
    performWeeklyBackupIfDue().catch(console.error);
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('users').find({}).toArray();
        if (result && result.length > 0) {
          return result.map(u => enrichUser(u));
        }
      } catch (e) {
        console.warn('MongoDB getUsers error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.users) memoryUsers = local.users;
    return memoryUsers.map(u => enrichUser(u));
  },
  getUserById: async (id: string): Promise<User | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('users').findOne({ id });
        if (result) return enrichUser(result);
      } catch (e) {
        console.warn('MongoDB getUserById error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.users) memoryUsers = local.users;
    const u = memoryUsers.find(usr => usr.id === id);
    return u ? enrichUser(u) : undefined;
  },
  getUserByUsername: async (username: string): Promise<User | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('users').findOne({
          username: { $regex: new RegExp('^' + escapeRegExp(username) + '$', 'i') }
        });
        if (result) return enrichUser(result);
      } catch (e) {
        console.warn('MongoDB getUserByUsername error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.users) memoryUsers = local.users;
    const u = memoryUsers.find(usr => usr.username.toLowerCase() === username.toLowerCase());
    return u ? enrichUser(u) : undefined;
  },
  saveUser: async (user: User): Promise<User> => {
    const enriched = enrichUser(user);
    const local = readLocalDbFile() || {};
    if (local.users) memoryUsers = local.users;
    const idx = memoryUsers.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      memoryUsers[idx] = enriched;
    } else {
      memoryUsers.push(enriched);
    }
    saveMemoryToLocalFile();
    performWeeklyBackupIfDue().catch(console.error);

    const database = await safeGetDb();
    if (database) {
      try {
        const { ...userDoc } = enriched as any;
        await database.collection('users').replaceOne({ id: user.id }, userDoc, { upsert: true });
      } catch (e) {
        console.warn('MongoDB saveUser error:', e);
      }
    }
    return enriched;
  },
  deleteUser: async (id: string): Promise<boolean> => {
    const local = readLocalDbFile() || {};
    if (local.users) memoryUsers = local.users;
    memoryUsers = memoryUsers.filter(u => u.id !== id);
    saveMemoryToLocalFile();
    performWeeklyBackupIfDue().catch(console.error);

    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('users').deleteOne({ id });
        return (result.deletedCount ?? 0) > 0;
      } catch (e) {
        console.warn('MongoDB deleteUser error:', e);
      }
    }
    return true;
  },

  // Orders Operations
  getOrders: async (): Promise<Order[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('orders').find({}).toArray();
        if (result && result.length > 0) {
          return result.map(o => { const { _id, ...rest } = o as any; return rest as Order; });
        }
      } catch (e) {
        console.warn('MongoDB getOrders error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.orders) memoryOrders = local.orders;
    return memoryOrders;
  },
  getOrderById: async (id: string): Promise<Order | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('orders').findOne({ id });
        if (result) { const { _id, ...rest } = result as any; return rest as Order; }
      } catch (e) {
        console.warn('MongoDB getOrderById error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.orders) memoryOrders = local.orders;
    return memoryOrders.find(o => o.id === id);
  },
  getOrderByOrderId: async (orderId: string): Promise<Order | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('orders').findOne({
          orderId: { $regex: new RegExp('^' + escapeRegExp(orderId) + '$', 'i') }
        });
        if (result) { const { _id, ...rest } = result as any; return rest as Order; }
      } catch (e) {
        console.warn('MongoDB getOrderByOrderId error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.orders) memoryOrders = local.orders;
    return memoryOrders.find(o => o.orderId.toLowerCase() === orderId.toLowerCase());
  },
  saveOrder: async (order: Order): Promise<Order> => {
    const local = readLocalDbFile() || {};
    if (local.orders) memoryOrders = local.orders;
    const idx = memoryOrders.findIndex(o => o.id === order.id);
    if (idx >= 0) memoryOrders[idx] = order;
    else memoryOrders.push(order);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        const { ...orderDoc } = order as any;
        await database.collection('orders').replaceOne({ id: order.id }, orderDoc, { upsert: true });
      } catch (e) {
        console.warn('MongoDB saveOrder error:', e);
      }
    }
    return order;
  },
  deleteOrder: async (id: string): Promise<boolean> => {
    const local = readLocalDbFile() || {};
    if (local.orders) memoryOrders = local.orders;
    memoryOrders = memoryOrders.filter(o => o.id !== id);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('orders').deleteOne({ id });
        return (result.deletedCount ?? 0) > 0;
      } catch (e) {
        console.warn('MongoDB deleteOrder error:', e);
      }
    }
    return true;
  },

  // NDR Operations
  getNdrRecords: async (): Promise<NdrRecord[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('ndr').find({}).toArray();
        if (result && result.length > 0) {
          return result.map(n => { const { _id, ...rest } = n as any; return rest as NdrRecord; });
        }
      } catch (e) {
        console.warn('MongoDB getNdrRecords error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.ndr) memoryNdrs = local.ndr;
    return memoryNdrs;
  },
  getNdrRecordById: async (id: string): Promise<NdrRecord | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('ndr').findOne({ id });
        if (result) { const { _id, ...rest } = result as any; return rest as NdrRecord; }
      } catch (e) {
        console.warn('MongoDB getNdrRecordById error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.ndr) memoryNdrs = local.ndr;
    return memoryNdrs.find(n => n.id === id);
  },
  getNdrRecordByOrderId: async (orderId: string): Promise<NdrRecord | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('ndr').findOne({
          orderId: { $regex: new RegExp('^' + escapeRegExp(orderId) + '$', 'i') }
        });
        if (result) { const { _id, ...rest } = result as any; return rest as NdrRecord; }
      } catch (e) {
        console.warn('MongoDB getNdrRecordByOrderId error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.ndr) memoryNdrs = local.ndr;
    return memoryNdrs.find(n => n.orderId.toLowerCase() === orderId.toLowerCase());
  },
  saveNdrRecord: async (record: NdrRecord): Promise<NdrRecord> => {
    const local = readLocalDbFile() || {};
    if (local.ndr) memoryNdrs = local.ndr;
    const idx = memoryNdrs.findIndex(n => n.id === record.id);
    if (idx >= 0) memoryNdrs[idx] = record;
    else memoryNdrs.push(record);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        const { ...recordDoc } = record as any;
        await database.collection('ndr').replaceOne({ id: record.id }, recordDoc, { upsert: true });
      } catch (e) {
        console.warn('MongoDB saveNdrRecord error:', e);
      }
    }
    return record;
  },

  // WhatsApp Logs
  getWhatsAppLogs: async (): Promise<WhatsAppLog[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('whatsappLogs').find({}).sort({ timestamp: -1 }).limit(100).toArray();
        if (result) return result.map(l => { const { _id, ...rest } = l as any; return rest as WhatsAppLog; });
      } catch (e) {
        console.warn('MongoDB getWhatsAppLogs error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.whatsappLogs) memoryWhatsAppLogs = local.whatsappLogs;
    return memoryWhatsAppLogs.slice(0, 100);
  },
  addWhatsAppLog: async (log: WhatsAppLog): Promise<void> => {
    const local = readLocalDbFile() || {};
    if (local.whatsappLogs) memoryWhatsAppLogs = local.whatsappLogs;
    memoryWhatsAppLogs.unshift(log);
    if (memoryWhatsAppLogs.length > 500) memoryWhatsAppLogs.pop();
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        const { ...logDoc } = log as any;
        await database.collection('whatsappLogs').insertOne(logDoc);
      } catch (e) {
        console.warn('MongoDB addWhatsAppLog error:', e);
      }
    }
  },
  saveWhatsAppLog: async (log: WhatsAppLog): Promise<void> => {
    const local = readLocalDbFile() || {};
    if (local.whatsappLogs) memoryWhatsAppLogs = local.whatsappLogs;
    const idx = memoryWhatsAppLogs.findIndex(l => l.id === log.id);
    if (idx >= 0) {
      memoryWhatsAppLogs[idx] = log;
    } else {
      memoryWhatsAppLogs.unshift(log);
      if (memoryWhatsAppLogs.length > 500) memoryWhatsAppLogs.pop();
    }
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        const { ...logDoc } = log as any;
        await database.collection('whatsappLogs').replaceOne({ id: log.id }, logDoc, { upsert: true });
      } catch (e) {
        console.warn('MongoDB saveWhatsAppLog error:', e);
      }
    }
  },

  // Courier Logs
  getCourierLogs: async (): Promise<CourierApiLog[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('courierLogs').find({}).sort({ timestamp: -1 }).limit(100).toArray();
        if (result) return result.map(l => { const { _id, ...rest } = l as any; return rest as CourierApiLog; });
      } catch (e) {
        console.warn('MongoDB getCourierLogs error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.courierLogs) memoryCourierLogs = local.courierLogs;
    return memoryCourierLogs.slice(0, 100);
  },
  addCourierLog: async (log: CourierApiLog): Promise<void> => {
    const local = readLocalDbFile() || {};
    if (local.courierLogs) memoryCourierLogs = local.courierLogs;
    memoryCourierLogs.unshift(log);
    if (memoryCourierLogs.length > 500) memoryCourierLogs.pop();
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        const { ...logDoc } = log as any;
        await database.collection('courierLogs').insertOne(logDoc);
      } catch (e) {
        console.warn('MongoDB addCourierLog error:', e);
      }
    }
  },

  // Settings Operations
  getSettings: async (): Promise<SystemSettings> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('settings').findOne({ key: 'system-settings' });
        if (result) {
          const { _id, key, ...rest } = result as any;
          const settings = {
            ...mockSettings,
            ...rest
          } as SystemSettings;

          // Self-healing: Auto-migrate old DTDC credentials in database to the new live credentials
          if (
            settings.dtdcConfig &&
            (settings.dtdcConfig.customerCode === 'GL018' ||
             settings.dtdcConfig.customerCode === 'MOCK_CUST' ||
             settings.dtdcConfig.apiKey === 'f4ae602554b4a185d21695991885f0' ||
             settings.dtdcConfig.apiKey === 'dtdc_live_sec_99store_8a9238bc')
          ) {
            settings.dtdcConfig = {
              ...settings.dtdcConfig,
              apiKey: 'e614c8b751f65543f53eced95f4174',
              customerCode: 'UO4125',
              serviceTypeId: 'B2C PRIORITY',
              commodityId: '2',
              username: 'UO4125_trk_json',
              password: 'wm4tH',
              accessToken: 'UO4125_trk_json:7a9d27b8932b2194e13e1665680c6d32'
            };
            
            // Asynchronously update MongoDB settings collection
            database.collection('settings').updateOne(
              { key: 'system-settings' },
              { $set: { dtdcConfig: settings.dtdcConfig } }
            ).catch(err => console.error('Failed to auto-migrate DTDC settings in MongoDB:', err));
          }

          // Self-healing: Auto-migrate Velocity settings in database if missing
          if (settings.velocityActive === undefined || !settings.velocityConfig) {
            settings.velocityActive = true;
            settings.velocityConfig = mockSettings.velocityConfig;
            
            // Asynchronously update MongoDB settings collection
            database.collection('settings').updateOne(
              { key: 'system-settings' },
              { $set: { velocityActive: true, velocityConfig: mockSettings.velocityConfig } }
            ).catch(err => console.error('Failed to auto-migrate Velocity settings in MongoDB:', err));
          }

          // Self-healing: Auto-migrate WhatsApp credentials in MongoDB
          if (
            settings.whatsappDeviceId !== '3483' ||
            settings.whatsappAccessToken !== '3b66835690546597e55f36f2605c0b8a'
          ) {
            settings.whatsappDeviceId = '3483';
            settings.whatsappAccessToken = '3b66835690546597e55f36f2605c0b8a';
            
            // Asynchronously update MongoDB settings collection
            database.collection('settings').updateOne(
              { key: 'system-settings' },
              { $set: { whatsappDeviceId: '3483', whatsappAccessToken: '3b66835690546597e55f36f2605c0b8a' } }
            ).catch(err => console.error('Failed to auto-migrate WhatsApp credentials in MongoDB:', err));
          }

          return settings;
        }
      } catch (e) {
        console.warn('MongoDB getSettings error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.settings) memorySettings = local.settings;

    // Self-healing for local memory settings
    if (
      memorySettings.whatsappDeviceId !== '3483' ||
      memorySettings.whatsappAccessToken !== '3b66835690546597e55f36f2605c0b8a'
    ) {
      memorySettings.whatsappDeviceId = '3483';
      memorySettings.whatsappAccessToken = '3b66835690546597e55f36f2605c0b8a';
      saveMemoryToLocalFile();
    }

    return memorySettings;
  },
  saveSettings: async (settings: SystemSettings): Promise<SystemSettings> => {
    memorySettings = { ...settings };
    saveMemoryToLocalFile();
    const database = await safeGetDb();
    if (database) {
      try {
        const { ...settingsDoc } = settings as any;
        await database.collection('settings').replaceOne({ key: 'system-settings' }, { ...settingsDoc, key: 'system-settings' }, { upsert: true });
      } catch (e) {
        console.warn('MongoDB saveSettings error:', e);
      }
    }
    return settings;
  },

  // Messages Operations
  getMessages: async (): Promise<Message[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('messages').find({}).toArray();
        if (result) return result.map(m => { const { _id, ...rest } = m as any; return rest as Message; });
      } catch (e) {
        console.warn('MongoDB getMessages error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.messages) memoryMessages = local.messages;
    return memoryMessages;
  },
  saveMessage: async (msg: Message): Promise<Message> => {
    const local = readLocalDbFile() || {};
    if (local.messages) memoryMessages = local.messages;
    const idx = memoryMessages.findIndex(m => m.id === msg.id);
    if (idx >= 0) memoryMessages[idx] = msg;
    else memoryMessages.push(msg);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        const { ...msgDoc } = msg as any;
        await database.collection('messages').replaceOne({ id: msg.id }, msgDoc, { upsert: true });
      } catch (e) {
        console.warn('MongoDB saveMessage error:', e);
      }
    }
    return msg;
  },
  markMessagesAsRead: async (userId: string, senderIdOrAll: string): Promise<void> => {
    const local = readLocalDbFile() || {};
    if (local.messages) memoryMessages = local.messages;
    memoryMessages.forEach(m => {
      if (senderIdOrAll === 'all') {
        if (m.isBroadcast && !m.isReadBy.includes(userId)) m.isReadBy.push(userId);
      } else {
        if (m.senderId === senderIdOrAll && m.recipientId === userId && !m.isReadBy.includes(userId)) m.isReadBy.push(userId);
      }
    });
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        if (senderIdOrAll === 'all') {
          await database.collection('messages').updateMany(
            { isBroadcast: true, isReadBy: { $ne: userId } },
            { $push: { isReadBy: userId } } as any
          );
        } else {
          await database.collection('messages').updateMany(
            { senderId: senderIdOrAll, recipientId: userId, isReadBy: { $ne: userId } },
            { $push: { isReadBy: userId } } as any
          );
        }
      } catch (e) {
        console.warn('MongoDB markMessagesAsRead error:', e);
      }
    }
  },

  // Tracking Events Operations
  getTrackingEvents: async (shipment: string): Promise<any[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        return await database.collection('tracking_events').find({ shipment }).toArray();
      } catch (e) {
        console.warn('MongoDB getTrackingEvents error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.tracking_events) memoryTrackingEvents = local.tracking_events;
    return memoryTrackingEvents.filter(e => e.shipment === shipment);
  },
  addTrackingEvent: async (event: any): Promise<void> => {
    const local = readLocalDbFile() || {};
    if (local.tracking_events) memoryTrackingEvents = local.tracking_events;
    memoryTrackingEvents.push(event);
    saveMemoryToLocalFile();
    const database = await safeGetDb();
    if (database) {
      try {
        await database.collection('tracking_events').insertOne(event);
      } catch (e) {
        console.warn('MongoDB addTrackingEvent error:', e);
      }
    }
  },
  getBulkJob: async (id: string): Promise<any | null> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('bulk_jobs').findOne({ id });
        if (result) { const { _id, ...rest } = result as any; return rest; }
      } catch (e) {
        console.warn('MongoDB getBulkJob error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.bulk_jobs) memoryBulkJobs = local.bulk_jobs;
    return memoryBulkJobs.find(j => j.id === id) || null;
  },
  saveBulkJob: async (job: any): Promise<void> => {
    const local = readLocalDbFile() || {};
    if (local.bulk_jobs) memoryBulkJobs = local.bulk_jobs;
    const existingIdx = memoryBulkJobs.findIndex(j => j.id === job.id);
    if (existingIdx !== -1) {
      memoryBulkJobs[existingIdx] = job;
    } else {
      memoryBulkJobs.push(job);
    }
    saveMemoryToLocalFile();
    const database = await safeGetDb();
    if (database) {
      try {
        await database.collection('bulk_jobs').replaceOne({ id: job.id }, job, { upsert: true });
      } catch (e) {
        console.warn('MongoDB saveBulkJob error:', e);
      }
    }
  },
  listBulkJobs: async (): Promise<any[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        return await database.collection('bulk_jobs').find({}).toArray();
      } catch (e) {
        console.warn('MongoDB listBulkJobs error, using memory:', e);
      }
    }
    const local = readLocalDbFile() || {};
    if (local.bulk_jobs) memoryBulkJobs = local.bulk_jobs;
    return memoryBulkJobs;
  }
};

// Start background weekly backup runner (polls every 24 hours, and once on server start)
if (typeof window === 'undefined') {
  setTimeout(() => {
    performWeeklyBackupIfDue().catch(console.error);
  }, 10000); // 10 seconds delay after startup to avoid blocking startup tasks

  setInterval(() => {
    performWeeklyBackupIfDue().catch(console.error);
  }, 24 * 60 * 60 * 1000); // 24 hours check
}
