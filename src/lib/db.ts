import { getDatabase } from './mongodb';
import { User, Order, NdrRecord, SystemSettings, WhatsAppLog, CourierApiLog, Message } from './types';
import { mockUsers, mockSettings, mockOrders, mockNdrs, mockWhatsAppLogs, mockCourierLogs, mockMessages } from './mockData';

// Helper to escape regex characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const db = {
  // Reset the database to mock data
  reset: async (): Promise<any> => {
    const database = await getDatabase();
    
    // Clear all collections
    await database.collection('users').deleteMany({});
    await database.collection('orders').deleteMany({});
    await database.collection('ndr').deleteMany({});
    await database.collection('whatsappLogs').deleteMany({});
    await database.collection('courierLogs').deleteMany({});
    await database.collection('settings').deleteMany({});
    await database.collection('messages').deleteMany({});
    await database.collection('tracking_events').deleteMany({});

    // Seed mock data
    if (mockUsers.length > 0) await database.collection('users').insertMany(mockUsers);
    if (mockOrders.length > 0) await database.collection('orders').insertMany(mockOrders);
    if (mockNdrs.length > 0) await database.collection('ndr').insertMany(mockNdrs);
    if (mockWhatsAppLogs.length > 0) await database.collection('whatsappLogs').insertMany(mockWhatsAppLogs);
    if (mockCourierLogs.length > 0) await database.collection('courierLogs').insertMany(mockCourierLogs);
    await database.collection('settings').insertOne({ ...mockSettings, key: 'system-settings' });
    if (mockMessages.length > 0) await database.collection('messages').insertMany(mockMessages);

    return {
      users: mockUsers,
      orders: mockOrders,
      ndr: mockNdrs,
      whatsappLogs: mockWhatsAppLogs,
      courierLogs: mockCourierLogs,
      settings: mockSettings,
      messages: mockMessages,
    };
  },

  // Users Operations
  getUsers: async (): Promise<User[]> => {
    const database = await getDatabase();
    const result = await database.collection('users').find({}).toArray();
    return result.map(u => {
      const { _id, ...rest } = u as any;
      return rest as User;
    });
  },
  getUserById: async (id: string): Promise<User | undefined> => {
    const database = await getDatabase();
    const result = await database.collection('users').findOne({ id });
    if (!result) return undefined;
    const { _id, ...rest } = result as any;
    return rest as User;
  },
  getUserByUsername: async (username: string): Promise<User | undefined> => {
    const database = await getDatabase();
    const result = await database.collection('users').findOne({
      username: { $regex: new RegExp('^' + escapeRegExp(username) + '$', 'i') }
    });
    if (!result) return undefined;
    const { _id, ...rest } = result as any;
    return rest as User;
  },
  saveUser: async (user: User): Promise<User> => {
    const database = await getDatabase();
    const { ...userDoc } = user as any;
    await database.collection('users').replaceOne({ id: user.id }, userDoc, { upsert: true });
    return user;
  },
  deleteUser: async (id: string): Promise<boolean> => {
    const database = await getDatabase();
    const result = await database.collection('users').deleteOne({ id });
    return (result.deletedCount ?? 0) > 0;
  },

  // Orders Operations
  getOrders: async (): Promise<Order[]> => {
    const database = await getDatabase();
    const result = await database.collection('orders').find({}).toArray();
    return result.map(o => {
      const { _id, ...rest } = o as any;
      return rest as Order;
    });
  },
  getOrderById: async (id: string): Promise<Order | undefined> => {
    const database = await getDatabase();
    const result = await database.collection('orders').findOne({ id });
    if (!result) return undefined;
    const { _id, ...rest } = result as any;
    return rest as Order;
  },
  getOrderByOrderId: async (orderId: string): Promise<Order | undefined> => {
    const database = await getDatabase();
    const result = await database.collection('orders').findOne({
      orderId: { $regex: new RegExp('^' + escapeRegExp(orderId) + '$', 'i') }
    });
    if (!result) return undefined;
    const { _id, ...rest } = result as any;
    return rest as Order;
  },
  saveOrder: async (order: Order): Promise<Order> => {
    const database = await getDatabase();
    const { ...orderDoc } = order as any;
    await database.collection('orders').replaceOne({ id: order.id }, orderDoc, { upsert: true });
    return order;
  },
  deleteOrder: async (id: string): Promise<boolean> => {
    const database = await getDatabase();
    const result = await database.collection('orders').deleteOne({ id });
    return (result.deletedCount ?? 0) > 0;
  },

  // NDR Operations
  getNdrRecords: async (): Promise<NdrRecord[]> => {
    const database = await getDatabase();
    const result = await database.collection('ndr').find({}).toArray();
    return result.map(n => {
      const { _id, ...rest } = n as any;
      return rest as NdrRecord;
    });
  },
  getNdrRecordById: async (id: string): Promise<NdrRecord | undefined> => {
    const database = await getDatabase();
    const result = await database.collection('ndr').findOne({ id });
    if (!result) return undefined;
    const { _id, ...rest } = result as any;
    return rest as NdrRecord;
  },
  getNdrRecordByOrderId: async (orderId: string): Promise<NdrRecord | undefined> => {
    const database = await getDatabase();
    const result = await database.collection('ndr').findOne({
      orderId: { $regex: new RegExp('^' + escapeRegExp(orderId) + '$', 'i') }
    });
    if (!result) return undefined;
    const { _id, ...rest } = result as any;
    return rest as NdrRecord;
  },
  saveNdrRecord: async (record: NdrRecord): Promise<NdrRecord> => {
    const database = await getDatabase();
    const { ...recordDoc } = record as any;
    await database.collection('ndr').replaceOne({ id: record.id }, recordDoc, { upsert: true });
    return record;
  },

  // WhatsApp Logs
  getWhatsAppLogs: async (): Promise<WhatsAppLog[]> => {
    const database = await getDatabase();
    const result = await database.collection('whatsappLogs').find({}).sort({ timestamp: -1 }).limit(500).toArray();
    return result.map(l => {
      const { _id, ...rest } = l as any;
      return rest as WhatsAppLog;
    });
  },
  addWhatsAppLog: async (log: WhatsAppLog): Promise<void> => {
    const database = await getDatabase();
    const { ...logDoc } = log as any;
    await database.collection('whatsappLogs').insertOne(logDoc);
    
    // Maintain max 500 logs to prevent bloat
    const count = await database.collection('whatsappLogs').countDocuments();
    if (count > 500) {
      const oldestDocs = await database.collection('whatsappLogs')
        .find({})
        .sort({ timestamp: 1 })
        .limit(count - 500)
        .toArray();
      const oldestIds = oldestDocs.map(d => d._id);
      await database.collection('whatsappLogs').deleteMany({ _id: { $in: oldestIds } });
    }
  },

  // Courier Logs
  getCourierLogs: async (): Promise<CourierApiLog[]> => {
    const database = await getDatabase();
    const result = await database.collection('courierLogs').find({}).sort({ timestamp: -1 }).limit(500).toArray();
    return result.map(l => {
      const { _id, ...rest } = l as any;
      return rest as CourierApiLog;
    });
  },
  addCourierLog: async (log: CourierApiLog): Promise<void> => {
    const database = await getDatabase();
    const { ...logDoc } = log as any;
    await database.collection('courierLogs').insertOne(logDoc);

    const count = await database.collection('courierLogs').countDocuments();
    if (count > 500) {
      const oldestDocs = await database.collection('courierLogs')
        .find({})
        .sort({ timestamp: 1 })
        .limit(count - 500)
        .toArray();
      const oldestIds = oldestDocs.map(d => d._id);
      await database.collection('courierLogs').deleteMany({ _id: { $in: oldestIds } });
    }
  },

  // Settings Operations
  getSettings: async (): Promise<SystemSettings> => {
    const database = await getDatabase();
    const result = await database.collection('settings').findOne({ key: 'system-settings' });
    if (!result) {
      // Seed default settings if not exists
      await database.collection('settings').insertOne({ ...mockSettings, key: 'system-settings' });
      return mockSettings;
    }
    const { _id, key, ...rest } = result as any;
    return rest as SystemSettings;
  },
  saveSettings: async (settings: SystemSettings): Promise<SystemSettings> => {
    const database = await getDatabase();
    const { ...settingsDoc } = settings as any;
    await database.collection('settings').replaceOne({ key: 'system-settings' }, { ...settingsDoc, key: 'system-settings' }, { upsert: true });
    return settings;
  },

  // Messages Operations
  getMessages: async (): Promise<Message[]> => {
    const database = await getDatabase();
    const result = await database.collection('messages').find({}).toArray();
    return result.map(m => {
      const { _id, ...rest } = m as any;
      return rest as Message;
    });
  },
  saveMessage: async (msg: Message): Promise<Message> => {
    const database = await getDatabase();
    const { ...msgDoc } = msg as any;
    await database.collection('messages').replaceOne({ id: msg.id }, msgDoc, { upsert: true });
    return msg;
  },
  markMessagesAsRead: async (userId: string, senderIdOrAll: string): Promise<void> => {
    const database = await getDatabase();
    
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
  },

  // Tracking Events Operations
  getTrackingEvents: async (shipment: string): Promise<any[]> => {
    const database = await getDatabase();
    return await database.collection('tracking_events').find({ shipment }).toArray();
  },
  addTrackingEvent: async (event: any): Promise<void> => {
    const database = await getDatabase();
    await database.collection('tracking_events').insertOne(event);
  }
};
