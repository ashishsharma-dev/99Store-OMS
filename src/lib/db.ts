import { getDatabase } from './mongodb';
import { User, Order, NdrRecord, SystemSettings, WhatsAppLog, CourierApiLog, Message } from './types';
import { mockUsers, mockSettings, mockOrders, mockNdrs, mockWhatsAppLogs, mockCourierLogs, mockMessages } from './mockData';

// Helper to escape regex characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// In-memory fallback state in case MongoDB is unreachable
let memoryUsers: User[] = [...mockUsers];
let memoryOrders: Order[] = [...mockOrders];
let memoryNdrs: NdrRecord[] = [...mockNdrs];
let memoryWhatsAppLogs: WhatsAppLog[] = [...mockWhatsAppLogs];
let memoryCourierLogs: CourierApiLog[] = [...mockCourierLogs];
let memorySettings: SystemSettings = { ...mockSettings };
let memoryMessages: Message[] = [...mockMessages];
let memoryTrackingEvents: any[] = [];

async function safeGetDb() {
  try {
    return await getDatabase();
  } catch (err) {
    return null;
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

  // Users Operations
  getUsers: async (): Promise<User[]> => {
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
    const u = memoryUsers.find(usr => usr.username.toLowerCase() === username.toLowerCase());
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
    memoryUsers = memoryUsers.filter(u => u.id !== id);
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
    return memoryOrders.find(o => o.orderId.toLowerCase() === orderId.toLowerCase());
  },
  saveOrder: async (order: Order): Promise<Order> => {
    const idx = memoryOrders.findIndex(o => o.id === order.id);
    if (idx >= 0) memoryOrders[idx] = order;
    else memoryOrders.push(order);

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
    memoryOrders = memoryOrders.filter(o => o.id !== id);
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
    return memoryNdrs.find(n => n.orderId.toLowerCase() === orderId.toLowerCase());
  },
  saveNdrRecord: async (record: NdrRecord): Promise<NdrRecord> => {
    const idx = memoryNdrs.findIndex(n => n.id === record.id);
    if (idx >= 0) memoryNdrs[idx] = record;
    else memoryNdrs.push(record);

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
        const result = await database.collection('whatsappLogs').find({}).sort({ timestamp: -1 }).limit(500).toArray();
        if (result) return result.map(l => { const { _id, ...rest } = l as any; return rest as WhatsAppLog; });
      } catch (e) {
        console.warn('MongoDB getWhatsAppLogs error, using memory:', e);
      }
    }
    return memoryWhatsAppLogs;
  },
  addWhatsAppLog: async (log: WhatsAppLog): Promise<void> => {
    memoryWhatsAppLogs.unshift(log);
    if (memoryWhatsAppLogs.length > 500) memoryWhatsAppLogs.pop();

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

  // Courier Logs
  getCourierLogs: async (): Promise<CourierApiLog[]> => {
    const database = await safeGetDb();
    if (database) {
      try {
        const result = await database.collection('courierLogs').find({}).sort({ timestamp: -1 }).limit(500).toArray();
        if (result) return result.map(l => { const { _id, ...rest } = l as any; return rest as CourierApiLog; });
      } catch (e) {
        console.warn('MongoDB getCourierLogs error, using memory:', e);
      }
    }
    return memoryCourierLogs;
  },
  addCourierLog: async (log: CourierApiLog): Promise<void> => {
    memoryCourierLogs.unshift(log);
    if (memoryCourierLogs.length > 500) memoryCourierLogs.pop();

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
        if (result) { const { _id, key, ...rest } = result as any; return rest as SystemSettings; }
      } catch (e) {
        console.warn('MongoDB getSettings error, using memory:', e);
      }
    }
    return memorySettings;
  },
  saveSettings: async (settings: SystemSettings): Promise<SystemSettings> => {
    memorySettings = { ...settings };
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
    return memoryMessages;
  },
  saveMessage: async (msg: Message): Promise<Message> => {
    const idx = memoryMessages.findIndex(m => m.id === msg.id);
    if (idx >= 0) memoryMessages[idx] = msg;
    else memoryMessages.push(msg);

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
    memoryMessages.forEach(m => {
      if (senderIdOrAll === 'all') {
        if (m.isBroadcast && !m.isReadBy.includes(userId)) m.isReadBy.push(userId);
      } else {
        if (m.senderId === senderIdOrAll && m.recipientId === userId && !m.isReadBy.includes(userId)) m.isReadBy.push(userId);
      }
    });

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
    return memoryTrackingEvents.filter(e => e.shipment === shipment);
  },
  addTrackingEvent: async (event: any): Promise<void> => {
    memoryTrackingEvents.push(event);
    const database = await safeGetDb();
    if (database) {
      try {
        await database.collection('tracking_events').insertOne(event);
      } catch (e) {
        console.warn('MongoDB addTrackingEvent error:', e);
      }
    }
  }
};

