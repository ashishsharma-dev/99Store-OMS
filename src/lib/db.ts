import { getDatabase } from './mongodb';
import { User, Order, NdrRecord, SystemSettings, WhatsAppLog, CourierApiLog, Message } from './types';
import { mockUsers, mockSettings, mockOrders, mockNdrs, mockWhatsAppLogs, mockCourierLogs, mockMessages } from './mockData';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { applyIntegrationSecrets, stripIntegrationSecrets } from './integrationSecrets';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

// Helper to escape regex characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'db.json');

function mergeSettings(overrides?: Partial<SystemSettings>): SystemSettings {
  return {
    ...mockSettings,
    ...(overrides || {}),
    dtdcConfig: { ...mockSettings.dtdcConfig, ...(overrides?.dtdcConfig || {}) },
    xpressbeesConfig: {
      ...mockSettings.xpressbeesConfig,
      ...(overrides?.xpressbeesConfig || {}),
      airAccount: overrides?.xpressbeesConfig?.airAccount || mockSettings.xpressbeesConfig.airAccount,
      surfaceAccount: overrides?.xpressbeesConfig?.surfaceAccount || mockSettings.xpressbeesConfig.surfaceAccount,
    },
    deliveryConfig: { ...mockSettings.deliveryConfig, ...(overrides?.deliveryConfig || {}) },
    shadowfaxConfig: { ...mockSettings.shadowfaxConfig, ...(overrides?.shadowfaxConfig || {}) },
  };
}

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
let memorySettings: SystemSettings = applyIntegrationSecrets(mergeSettings(localDb.settings));
let memoryMessages: Message[] = localDb.messages || [...mockMessages];
let memoryTrackingEvents: any[] = localDb.tracking_events || [];
const memoryBulkJobs: any[] = localDb.bulk_jobs || [];

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
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT || process.env.DISABLE_LOCAL_DB_WRITES === 'true') {
    return;
  }
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
        settings: stripIntegrationSecrets(memorySettings),
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
    if (!db) {
      isMongoCircuitBroken = true;
      nextMongoRetryTime = Date.now() + 5 * 60 * 1000; // 5 minutes cooldown
      return null;
    }
    isMongoCircuitBroken = false;
    return db;
  } catch (err) {
    isMongoCircuitBroken = true;
    nextMongoRetryTime = Date.now() + 5 * 60 * 1000; // 5 minutes cooldown
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
          settings: stripIntegrationSecrets(memorySettings),
          messages: memoryMessages,
          tracking_events: memoryTrackingEvents,
          bulk_jobs: memoryBulkJobs
        };
      }

      if (dataToBackup) {
        if (dataToBackup.settings) {
          const { _id, key, ...backupSettings } = dataToBackup.settings;
          dataToBackup.settings = { ...stripIntegrationSecrets(mergeSettings(backupSettings)), key: key || 'system-settings' };
        }
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

// Google Sheets real-time synchronization debounce map
const sheetSyncDebounceTimers = new Map<string, NodeJS.Timeout>();

function triggerDebouncedSheetSync(order: Order) {
  if (order.isDeleted) return;
  const key = order.id || order.orderId;
  if (!key) return;

  const existingTimer = sheetSyncDebounceTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    sheetSyncDebounceTimers.delete(key);
    import('./googleSheet').then(({ syncOrderToGoogleSheet }) => {
      syncOrderToGoogleSheet(order).catch(err => {
        console.warn(`[Google Sheet Sync] Background sync error for ${order.orderId}:`, err);
      });
    }).catch(() => {});
  }, 1000);

  sheetSyncDebounceTimers.set(key, timer);
}

export const db = {
  reset: async (): Promise<any> => {
    memoryUsers = [...mockUsers];
    memoryOrders = [...mockOrders];
    memoryNdrs = [...mockNdrs];
    memoryWhatsAppLogs = [...mockWhatsAppLogs];
    memoryCourierLogs = [...mockCourierLogs];
    memorySettings = applyIntegrationSecrets(mergeSettings());
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
        await database.collection('settings').insertOne({ ...stripIntegrationSecrets(mockSettings), key: 'system-settings' });
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
      // OTP verification reads MongoDB first, so the generated OTP must be
      // committed before the send-otp request reports success. Leaving this
      // write in the background creates a race with an immediate login request.
      await database.collection('users').replaceOne(
        { id: user.id },
        enriched as any,
        { upsert: true },
      );
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
  claimCourierBooking: async (
    id: string,
    attemptId: string,
  ): Promise<{
    status: 'claimed' | 'already_booked' | 'in_progress' | 'reconciliation_required';
    order: Order;
  } | { status: 'not_found' | 'unavailable'; order?: undefined }> => {
    const now = new Date().toISOString();
    const database = await safeGetDb();

    if (database) {
      try {
        const existingRaw = await database.collection('orders').findOne({ id });
        if (!existingRaw) return { status: 'not_found' };
        const { _id, ...existingRest } = existingRaw as any;
        const existing = existingRest as Order;
        if (existing.awb) return { status: 'already_booked', order: existing };
        if (existing.courierBookingStatus === 'Reconciliation Required') {
          return { status: 'reconciliation_required', order: existing };
        }

        const claimedRaw = await database.collection('orders').findOneAndUpdate(
          {
            id,
            $and: [
              { $or: [{ awb: { $exists: false } }, { awb: null }, { awb: '' }] },
              {
                $or: [
                  { courierBookingStatus: { $exists: false } },
                  { courierBookingStatus: 'Failed' },
                ],
              },
            ],
          },
          {
            $set: {
              courierBookingStatus: 'Processing',
              courierBookingAttemptId: attemptId,
              courierBookingStartedAt: now,
              courierBookingError: '',
              updatedAt: now,
            },
            $inc: { courierBookingAttempts: 1 },
          },
          { returnDocument: 'after' },
        );
        const claimedDoc = (claimedRaw as any)?.value || claimedRaw;
        if (claimedDoc) {
          const { _id: claimedId, ...claimedRest } = claimedDoc as any;
          const claimed = claimedRest as Order;
          const idx = memoryOrders.findIndex(order => order.id === id);
          if (idx >= 0) memoryOrders[idx] = claimed;
          else memoryOrders.push(claimed);
          saveMemoryToLocalFile();
          return { status: 'claimed', order: claimed };
        }

        const latestRaw = await database.collection('orders').findOne({ id });
        if (!latestRaw) return { status: 'not_found' };
        const { _id: latestId, ...latestRest } = latestRaw as any;
        const latest = latestRest as Order;
        if (latest.awb) return { status: 'already_booked', order: latest };
        if (latest.courierBookingStatus === 'Reconciliation Required' || latest.courierBookingStatus === 'Booked') {
          return { status: 'reconciliation_required', order: latest };
        }
        return { status: 'in_progress', order: latest };
      } catch (error) {
        console.warn('MongoDB claimCourierBooking warning:', error);
        return { status: 'unavailable' };
      }
    }

    if (process.env.USE_MONGODB === 'true') {
      return { status: 'unavailable' };
    }

    const existing = idOrderMap.get(id);
    if (!existing) return { status: 'not_found' };
    if (existing.awb) return { status: 'already_booked', order: existing };
    if (existing.courierBookingStatus === 'Reconciliation Required') {
      return { status: 'reconciliation_required', order: existing };
    }
    if (existing.courierBookingStatus === 'Processing') {
      return { status: 'in_progress', order: existing };
    }

    existing.courierBookingStatus = 'Processing';
    existing.courierBookingAttemptId = attemptId;
    existing.courierBookingStartedAt = now;
    existing.courierBookingError = undefined;
    existing.courierBookingAttempts = (existing.courierBookingAttempts || 0) + 1;
    existing.updatedAt = now;
    saveMemoryToLocalFile();
    return { status: 'claimed', order: existing };
  },
  finalizeCourierBooking: async (
    id: string,
    attemptId: string,
    result: {
      status: 'Booked' | 'Failed' | 'Reconciliation Required';
      awb?: string;
      eta?: string;
      courier?: string;
      shipmentContactPhone?: string;
      shipmentContactType?: string;
      error?: string;
    },
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const setValues: Record<string, unknown> = {
      courierBookingStatus: result.status,
      courierBookingCompletedAt: now,
      courierBookingError: result.error || '',
      updatedAt: now,
    };
    if (result.awb) setValues.awb = result.awb;
    if (result.eta) setValues.eta = result.eta;
    if (result.courier) setValues.courier = result.courier;
    if (result.shipmentContactPhone) setValues.shipmentContactPhone = result.shipmentContactPhone;
    if (result.shipmentContactType) setValues.shipmentContactType = result.shipmentContactType;

    const database = await safeGetDb();
    if (database) {
      try {
        const updateResult = await database.collection('orders').updateOne(
          { id, courierBookingAttemptId: attemptId },
          { $set: setValues },
        );
        if (updateResult.matchedCount === 0) return false;
      } catch (error) {
        console.warn('MongoDB finalizeCourierBooking warning:', error);
        return false;
      }
    }

    const order = idOrderMap.get(id);
    if (order && order.courierBookingAttemptId === attemptId) {
      Object.assign(order, setValues);
      saveMemoryToLocalFile();
    }
    return true;
  },
  saveOrder: async (order: Order): Promise<Order> => {
    const idx = memoryOrders.findIndex(o => o.id === order.id);
    if (idx >= 0) memoryOrders[idx] = order;
    else memoryOrders.push(order);
    if (order.id) idOrderMap.set(order.id, order);
    if (order.orderId) orderIdOrderMap.set(order.orderId.toLowerCase(), order);
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      database.collection('orders').replaceOne({ id: order.id }, order as any, { upsert: true }).catch(console.warn);
    }

    // Trigger non-blocking real-time Google Sheet synchronization
    triggerDebouncedSheetSync(order);

    return order;
  },
  deleteOrder: async (id: string): Promise<boolean> => {
    const existing = idOrderMap.get(id);
    if (existing?.orderId) orderIdOrderMap.delete(existing.orderId.toLowerCase());
    idOrderMap.delete(id);
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
          return applyIntegrationSecrets(mergeSettings(rest));
        }
      } catch (e) {}
    }

    if (!memorySettings.walabzBaseUrl) {
      memorySettings.walabzBaseUrl = process.env.WALABZ_BASE_URL || 'https://walabz.com';
      memorySettings.walabzDefaultCountryCode = 'IN';
      memorySettings.walabzDefaultDialCode = '91';
      saveMemoryToLocalFile();
    }

    memorySettings = applyIntegrationSecrets(memorySettings);
    return memorySettings;
  },
  takeXpressBeesAwb: async (): Promise<string | undefined> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const beforeRaw = await database.collection('settings').findOneAndUpdate(
          { key: 'system-settings', 'xpressbeesAwbPool.0': { $exists: true } },
          { $pop: { xpressbeesAwbPool: -1 } },
          { returnDocument: 'before' },
        );
        const before = (beforeRaw as any)?.value || beforeRaw;
        const awb = before?.xpressbeesAwbPool?.[0];
        if (typeof awb === 'string' && awb.trim()) {
          memorySettings.xpressbeesAwbPool = (memorySettings.xpressbeesAwbPool || []).filter(value => value !== awb);
          saveMemoryToLocalFile();
          return awb;
        }
        return undefined;
      } catch (error) {
        console.warn('MongoDB takeXpressBeesAwb warning:', error);
        return undefined;
      }
    }

    const awb = memorySettings.xpressbeesAwbPool?.shift();
    if (awb) saveMemoryToLocalFile();
    return awb;
  },
  addXpressBeesAwbs: async (awbs: string[]): Promise<number> => {
    const normalized = [...new Set(awbs.map(awb => String(awb).trim()).filter(Boolean))];
    if (normalized.length === 0) return 0;

    const existing = new Set(memorySettings.xpressbeesAwbPool || []);
    const additions = normalized.filter(awb => !existing.has(awb));
    memorySettings.xpressbeesAwbPool = [...(memorySettings.xpressbeesAwbPool || []), ...additions];
    saveMemoryToLocalFile();

    const database = await safeGetDb();
    if (database) {
      try {
        await database.collection('settings').updateOne(
          { key: 'system-settings' },
          { $addToSet: { xpressbeesAwbPool: { $each: normalized } } },
          { upsert: true },
        );
      } catch (error) {
        console.warn('MongoDB addXpressBeesAwbs warning:', error);
      }
    }

    return additions.length;
  },
  saveSettings: async (settings: SystemSettings): Promise<SystemSettings> => {
    memorySettings = applyIntegrationSecrets(settings);
    saveMemoryToLocalFile();
    const database = await safeGetDb();
    if (database) {
      const persistedSettings = stripIntegrationSecrets(memorySettings);
      database.collection('settings').replaceOne({ key: 'system-settings' }, { ...persistedSettings as any, key: 'system-settings' }, { upsert: true }).catch(console.warn);
    }
    return memorySettings;
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
  const initialBackupTimer = setTimeout(() => {
    performWeeklyBackupIfDue().catch(console.error);
  }, 10000);
  initialBackupTimer.unref?.();

  const recurringBackupTimer = setInterval(() => {
    performWeeklyBackupIfDue().catch(console.error);
  }, 24 * 60 * 60 * 1000);
  recurringBackupTimer.unref?.();
}
