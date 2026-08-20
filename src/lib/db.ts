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

// --- IN-MEMORY PRIMARY DB & INDEXING ENGINE ---
let localDb: any = null;
try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    localDb = JSON.parse(raw);
  }
} catch (err) {
  console.error('[DB Engine] Initial local db.json read error:', err);
}

if (!localDb) localDb = {};

let memoryUsers: User[] = localDb.users || [...mockUsers];
let memoryOrders: Order[] = localDb.orders || [...mockOrders];
let memoryNdrs: NdrRecord[] = localDb.ndr || [...mockNdrs];
let memoryWhatsAppLogs: WhatsAppLog[] = localDb.whatsappLogs || [...mockWhatsAppLogs];
let memoryCourierLogs: CourierApiLog[] = localDb.courierLogs || [...mockCourierLogs];
let memorySettings: SystemSettings = localDb.settings ? { ...mockSettings, ...localDb.settings } : { ...mockSettings };
let memoryMessages: Message[] = localDb.messages || [...mockMessages];
let memoryTrackingEvents: any[] = localDb.tracking_events || [];
let memoryBulkJobs: any[] = localDb.bulk_jobs || [];

// Fast O(1) Hash Map Index Maps
const idUserMap = new Map<string, User>();
const usernameUserMap = new Map<string, User>();

const idOrderMap = new Map<string, Order>();
const orderIdOrderMap = new Map<string, Order>();

const idNdrMap = new Map<string, NdrRecord>();
const orderIdNdrMap = new Map<string, NdrRecord>();

function rebuildIndexes() {
  idUserMap.clear();
  usernameUserMap.clear();
  memoryUsers.forEach(u => {
    if (u.id) idUserMap.set(u.id, u);
    if (u.username) usernameUserMap.set(u.username.toLowerCase(), u);
  });

  idOrderMap.clear();
  orderIdOrderMap.clear();
  memoryOrders.forEach(o => {
    if (o.id) idOrderMap.set(o.id, o);
    if (o.orderId) orderIdOrderMap.set(o.orderId.toLowerCase(), o);
  });

  idNdrMap.clear();
  orderIdNdrMap.clear();
  memoryNdrs.forEach(n => {
    if (n.id) idNdrMap.set(n.id, n);
    if (n.orderId) orderIdNdrMap.set(n.orderId.toLowerCase(), n);
  });
}

rebuildIndexes();

// --- DEBOUNCED ASYNCHRONOUS FILE PERSISTENCE ---
let isDiskSaveScheduled = false;
let saveTimer: NodeJS.Timeout | null = null;

function saveMemoryToLocalFile() {
  rebuildIndexes();
  if (isDiskSaveScheduled) return;
  isDiskSaveScheduled = true;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    isDiskSaveScheduled = false;
    try {
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
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const tempPath = `${DB_FILE_PATH}.tmp`;
      await fs.promises.writeFile(tempPath, JSON.stringify(data), 'utf-8');
      await fs.promises.rename(tempPath, DB_FILE_PATH);
    } catch (err) {
      console.error('[DB Engine] Async db.json save error:', err);
    }
  }, 1000);
}

// --- NON-BLOCKING MONGODB CIRCUIT BREAKER ---
let isMongoCircuitBroken = false;
let nextMongoRetryTime = 0;

async function safeGetDb() {
  if (process.env.USE_MONGODB !== 'true') return null;

  // Circuit Breaker: If broken, don't delay local requests
  if (isMongoCircuitBroken && Date.now() < nextMongoRetryTime) {
    return null;
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('MongoDB Connection Timeout')), 1000)
    );
    const db = await Promise.race([getDatabase(), timeoutPromise]) as any;
    isMongoCircuitBroken = false;
    return db;
  } catch (err) {
    isMongoCircuitBroken = true;
    nextMongoRetryTime = Date.now() + 60000; // 60s cooldown
    return null;
  }
}

// Helper to perform weekly backup asynchronously
async function performWeeklyBackupIfDue() {
  try {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      await fs.promises.mkdir(backupDir, { recursive: true });
    }

    const files = await fs.promises.readdir(backupDir);
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
        dataToBackup = {
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
      }

      if (dataToBackup) {
        const backupName = database ? `db-backup-mongo-${now}.json` : `db-backup-local-${now}.json`;
        const backupPath = path.join(backupDir, backupName);
        await fs.promises.writeFile(backupPath, JSON.stringify(dataToBackup, null, 2), 'utf-8');
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

  // --- USERS OPERATIONS ---
  getUsers: async (): Promise<User[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('users').find({}).toArray();
        if (result && result.length > 0) {
          return (result as any[]).map((u: any) => enrichUser(u));
        }
      } catch (e) {}
    }
    return memoryUsers.map(u => enrichUser(u));
  },
  getUserById: async (id: string): Promise<User | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('users').findOne({ id });
        if (result) return enrichUser(result);
      } catch (e) {}
    }
    const u = idUserMap.get(id);
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
      } catch (e) {}
    }
    const u = usernameUserMap.get(username.toLowerCase());
    return u ? enrichUser(u) : undefined;
  },
  saveUser: async (user: User): Promise<User> => {
    const enriched = enrichUser(user);
    const idx = memoryUsers.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      memoryUsers[idx] = enriched;
    } else {
      memoryUsers.push(enriched);
    }
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      database.collection('users').replaceOne({ id: user.id }, enriched as any, { upsert: true }).catch(console.warn);
    }
    return enriched;
  },
  deleteUser: async (id: string): Promise<boolean> => {
    memoryUsers = memoryUsers.filter(u => u.id !== id);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      database.collection('users').deleteOne({ id }).catch(console.warn);
    }
    return true;
  },

  // --- ORDERS OPERATIONS ---
  getOrders: async (): Promise<Order[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('orders').find({}).toArray();
        if (result && result.length > 0) {
          return (result as any[]).map((o: any) => { const { _id, ...rest } = o; return rest as Order; });
        }
      } catch (e) {}
    }
    return memoryOrders;
  },
  getOrderById: async (id: string): Promise<Order | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('orders').findOne({ id });
        if (result) { const { _id, ...rest } = result as any; return rest as Order; }
      } catch (e) {}
    }
    return idOrderMap.get(id);
  },
  getOrderByOrderId: async (orderId: string): Promise<Order | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('orders').findOne({
          orderId: { $regex: new RegExp('^' + escapeRegExp(orderId) + '$', 'i') }
        });
        if (result) { const { _id, ...rest } = result as any; return rest as Order; }
      } catch (e) {}
    }
    return orderIdOrderMap.get(orderId.toLowerCase());
  },
  saveOrder: async (order: Order): Promise<Order> => {
    const idx = memoryOrders.findIndex(o => o.id === order.id);
    if (idx >= 0) memoryOrders[idx] = order;
    else memoryOrders.push(order);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      database.collection('orders').replaceOne({ id: order.id }, order as any, { upsert: true }).catch(console.warn);
    }
    return order;
  },
  deleteOrder: async (id: string): Promise<boolean> => {
    memoryOrders = memoryOrders.filter(o => o.id !== id);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      database.collection('orders').deleteOne({ id }).catch(console.warn);
    }
    return true;
  },

  // --- NDR OPERATIONS ---
  getNdrRecords: async (): Promise<NdrRecord[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('ndr').find({}).toArray();
        if (result && result.length > 0) {
          return (result as any[]).map((n: any) => { const { _id, ...rest } = n; return rest as NdrRecord; });
        }
      } catch (e) {}
    }
    return memoryNdrs;
  },
  getNdrRecordById: async (id: string): Promise<NdrRecord | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('ndr').findOne({ id });
        if (result) { const { _id, ...rest } = result as any; return rest as NdrRecord; }
      } catch (e) {}
    }
    return idNdrMap.get(id);
  },
  getNdrRecordByOrderId: async (orderId: string): Promise<NdrRecord | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('ndr').findOne({
          orderId: { $regex: new RegExp('^' + escapeRegExp(orderId) + '$', 'i') }
        });
        if (result) { const { _id, ...rest } = result as any; return rest as NdrRecord; }
      } catch (e) {}
    }
    return orderIdNdrMap.get(orderId.toLowerCase());
  },
  saveNdrRecord: async (record: NdrRecord): Promise<NdrRecord> => {
    const idx = memoryNdrs.findIndex(n => n.id === record.id);
    if (idx >= 0) memoryNdrs[idx] = record;
    else memoryNdrs.push(record);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      database.collection('ndr').replaceOne({ id: record.id }, record as any, { upsert: true }).catch(console.warn);
    }
    return record;
  },

  // --- WHATSAPP LOGS ---
  getWhatsAppLogs: async (): Promise<WhatsAppLog[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('whatsappLogs').find({}).sort({ timestamp: -1 }).limit(100).toArray();
        if (result) return (result as any[]).map((l: any) => { const { _id, ...rest } = l; return rest as WhatsAppLog; });
      } catch (e) {}
    }
    return memoryWhatsAppLogs.slice(0, 100);
  },
  addWhatsAppLog: async (log: WhatsAppLog): Promise<void> => {
    memoryWhatsAppLogs.unshift(log);
    if (memoryWhatsAppLogs.length > 500) memoryWhatsAppLogs.pop();
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      database.collection('whatsappLogs').insertOne(log as any).catch(console.warn);
    }
  },
  saveWhatsAppLog: async (log: WhatsAppLog): Promise<void> => {
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
      database.collection('whatsappLogs').replaceOne({ id: log.id }, log as any, { upsert: true }).catch(console.warn);
    }
  },

  // --- COURIER LOGS ---
  getCourierLogs: async (): Promise<CourierApiLog[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('courierLogs').find({}).sort({ timestamp: -1 }).limit(100).toArray();
        if (result) return (result as any[]).map((l: any) => { const { _id, ...rest } = l; return rest as CourierApiLog; });
      } catch (e) {}
    }
    return memoryCourierLogs.slice(0, 100);
  },
  addCourierLog: async (log: CourierApiLog): Promise<void> => {
    memoryCourierLogs.unshift(log);
    if (memoryCourierLogs.length > 500) memoryCourierLogs.pop();
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      database.collection('courierLogs').insertOne(log as any).catch(console.warn);
    }
  },

  // --- SETTINGS OPERATIONS ---
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
            database.collection('settings').updateOne({ key: 'system-settings' }, { $set: { dtdcConfig: settings.dtdcConfig } }).catch(console.warn);
          }
          return settings;
        }
      } catch (e) {}
    }

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
      database.collection('settings').replaceOne({ key: 'system-settings' }, { ...settings as any, key: 'system-settings' }, { upsert: true }).catch(console.warn);
    }
    return settings;
  },

  // --- MESSAGES OPERATIONS ---
  getMessages: async (): Promise<Message[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('messages').find({}).toArray();
        if (result) return (result as any[]).map((m: any) => { const { _id, ...rest } = m; return rest as Message; });
      } catch (e) {}
    }
    return memoryMessages;
  },
  saveMessage: async (msg: Message): Promise<Message> => {
    const idx = memoryMessages.findIndex(m => m.id === msg.id);
    if (idx >= 0) memoryMessages[idx] = msg;
    else memoryMessages.push(msg);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      database.collection('messages').replaceOne({ id: msg.id }, msg as any, { upsert: true }).catch(console.warn);
    }
    return msg;
  },
  markMessagesAsRead: async (userId: string, senderIdOrAll: string): Promise<void> => {
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
      if (senderIdOrAll === 'all') {
        database.collection('messages').updateMany({ isBroadcast: true, isReadBy: { $ne: userId } }, { $push: { isReadBy: userId } } as any).catch(console.warn);
      } else {
        database.collection('messages').updateMany({ senderId: senderIdOrAll, recipientId: userId, isReadBy: { $ne: userId } }, { $push: { isReadBy: userId } } as any).catch(console.warn);
      }
    }
  },

  // --- TRACKING EVENTS OPERATIONS ---
  getTrackingEvents: async (shipment: string): Promise<any[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        return await database.collection('tracking_events').find({ shipment }).toArray();
      } catch (e) {}
    }
    return memoryTrackingEvents.filter(e => e.shipment === shipment);
  },
  addTrackingEvent: async (event: any): Promise<void> => {
    memoryTrackingEvents.push(event);
    saveMemoryToLocalFile();
    const database = await safeGetDb();
    if (database) {
      database.collection('tracking_events').insertOne(event).catch(console.warn);
    }
  },
  getBulkJob: async (id: string): Promise<any | null> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('bulk_jobs').findOne({ id });
        if (result) { const { _id, ...rest } = result as any; return rest; }
      } catch (e) {}
    }
    return memoryBulkJobs.find(j => j.id === id) || null;
  },
  saveBulkJob: async (job: any): Promise<void> => {
    const existingIdx = memoryBulkJobs.findIndex(j => j.id === job.id);
    if (existingIdx !== -1) {
      memoryBulkJobs[existingIdx] = job;
    } else {
      memoryBulkJobs.push(job);
    }
    saveMemoryToLocalFile();
    const database = await safeGetDb();
    if (database) {
      database.collection('bulk_jobs').replaceOne({ id: job.id }, job, { upsert: true }).catch(console.warn);
    }
  },
  listBulkJobs: async (): Promise<any[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        return await database.collection('bulk_jobs').find({}).toArray();
      } catch (e) {}
    }
    return memoryBulkJobs;
  }
};

// Background backup runner
if (typeof window === 'undefined') {
  setTimeout(() => {
    performWeeklyBackupIfDue().catch(console.error);
  }, 10000);

  setInterval(() => {
    performWeeklyBackupIfDue().catch(console.error);
  }, 24 * 60 * 60 * 1000);
}
