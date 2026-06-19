import fs from 'fs';
import path from 'path';
import { User, Order, NdrRecord, SystemSettings, WhatsAppLog, CourierApiLog, Message } from './types';
import { mockUsers, mockSettings, mockOrders, mockNdrs, mockWhatsAppLogs, mockCourierLogs, mockMessages } from './mockData';

interface DbState {
  users: User[];
  orders: Order[];
  ndr: NdrRecord[];
  whatsappLogs: WhatsAppLog[];
  courierLogs: CourierApiLog[];
  settings: SystemSettings;
  messages: Message[];
}

// Store the DB in the project's root folder under a "data" directory
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Helper to ensure data directory exists and DB file is initialized
function initDbFile(): string {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialState: DbState = {
      users: mockUsers,
      orders: mockOrders,
      ndr: mockNdrs,
      whatsappLogs: mockWhatsAppLogs,
      courierLogs: mockCourierLogs,
      settings: mockSettings,
      messages: mockMessages,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), 'utf-8');
  }
  return DB_FILE;
}

// Thread-safe read state from the file database
export function getDb(): DbState {
  const filePath = initDbFile();
  const rawData = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(rawData) as DbState;
  } catch (err) {
    console.error('Failed to parse database file, resetting to mock data:', err);
    const defaultState: DbState = {
      users: mockUsers,
      orders: mockOrders,
      ndr: mockNdrs,
      whatsappLogs: mockWhatsAppLogs,
      courierLogs: mockCourierLogs,
      settings: mockSettings,
      messages: mockMessages,
    };
    saveDb(defaultState);
    return defaultState;
  }
}

// Atomic thread-safe write to database file
export function saveDb(state: DbState): void {
  const filePath = initDbFile();
  const tempPath = `${filePath}.tmp`;
  
  // Write to temporary file first, then rename atomically
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

// --- DB OPERATION ADAPTERS ---

export const db = {
  // Reset the database to mock data
  reset: (): DbState => {
    const defaultState: DbState = {
      users: mockUsers,
      orders: mockOrders,
      ndr: mockNdrs,
      whatsappLogs: mockWhatsAppLogs,
      courierLogs: mockCourierLogs,
      settings: mockSettings,
      messages: mockMessages,
    };
    saveDb(defaultState);
    return defaultState;
  },

  // Users Operations
  getUsers: (): User[] => getDb().users,
  getUserById: (id: string): User | undefined => getDb().users.find(u => u.id === id),
  getUserByUsername: (username: string): User | undefined => getDb().users.find(u => u.username.toLowerCase() === username.toLowerCase()),
  saveUser: (user: User): User => {
    const state = getDb();
    const index = state.users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      state.users[index] = user;
    } else {
      state.users.push(user);
    }
    saveDb(state);
    return user;
  },
  deleteUser: (id: string): boolean => {
    const state = getDb();
    const lenBefore = state.users.length;
    state.users = state.users.filter(u => u.id !== id);
    saveDb(state);
    return state.users.length < lenBefore;
  },

  // Orders Operations
  getOrders: (): Order[] => getDb().orders,
  getOrderById: (id: string): Order | undefined => getDb().orders.find(o => o.id === id),
  getOrderByOrderId: (orderId: string): Order | undefined => getDb().orders.find(o => o.orderId.toLowerCase() === orderId.toLowerCase()),
  saveOrder: (order: Order): Order => {
    const state = getDb();
    const index = state.orders.findIndex(o => o.id === order.id);
    if (index >= 0) {
      state.orders[index] = order;
    } else {
      state.orders.push(order);
    }
    saveDb(state);
    return order;
  },
  deleteOrder: (id: string): boolean => {
    const state = getDb();
    const lenBefore = state.orders.length;
    state.orders = state.orders.filter(o => o.id !== id);
    saveDb(state);
    return state.orders.length < lenBefore;
  },

  // NDR Operations
  getNdrRecords: (): NdrRecord[] => getDb().ndr,
  getNdrRecordById: (id: string): NdrRecord | undefined => getDb().ndr.find(n => n.id === id),
  getNdrRecordByOrderId: (orderId: string): NdrRecord | undefined => getDb().ndr.find(n => n.orderId.toLowerCase() === orderId.toLowerCase()),
  saveNdrRecord: (record: NdrRecord): NdrRecord => {
    const state = getDb();
    const index = state.ndr.findIndex(n => n.id === record.id);
    if (index >= 0) {
      state.ndr[index] = record;
    } else {
      state.ndr.push(record);
    }
    saveDb(state);
    return record;
  },

  // WhatsApp Logs
  getWhatsAppLogs: (): WhatsAppLog[] => getDb().whatsappLogs,
  addWhatsAppLog: (log: WhatsAppLog): void => {
    const state = getDb();
    state.whatsappLogs.unshift(log); // Add at the top (most recent)
    // Keep max 500 logs to prevent file size bloat
    if (state.whatsappLogs.length > 500) {
      state.whatsappLogs = state.whatsappLogs.slice(0, 500);
    }
    saveDb(state);
  },

  // Courier Logs
  getCourierLogs: (): CourierApiLog[] => getDb().courierLogs,
  addCourierLog: (log: CourierApiLog): void => {
    const state = getDb();
    state.courierLogs.unshift(log);
    if (state.courierLogs.length > 500) {
      state.courierLogs = state.courierLogs.slice(0, 500);
    }
    saveDb(state);
  },

  // Settings Operations
  getSettings: (): SystemSettings => getDb().settings,
  saveSettings: (settings: SystemSettings): SystemSettings => {
    const state = getDb();
    state.settings = settings;
    saveDb(state);
    return settings;
  },

  // Messages Operations
  getMessages: (): Message[] => getDb().messages || [],
  saveMessage: (msg: Message): Message => {
    const state = getDb();
    if (!state.messages) {
      state.messages = [];
    }
    const index = state.messages.findIndex(m => m.id === msg.id);
    if (index >= 0) {
      state.messages[index] = msg;
    } else {
      state.messages.push(msg);
    }
    saveDb(state);
    return msg;
  },
  markMessagesAsRead: (userId: string, senderIdOrAll: string): void => {
    const state = getDb();
    if (!state.messages) return;
    
    let updated = false;
    state.messages.forEach(msg => {
      // For broadcast messages
      if (senderIdOrAll === 'all' && msg.isBroadcast) {
        if (!msg.isReadBy.includes(userId)) {
          msg.isReadBy.push(userId);
          updated = true;
        }
      } 
      // For direct messages from a specific sender to the current user
      else if (msg.senderId === senderIdOrAll && msg.recipientId === userId) {
        if (!msg.isReadBy.includes(userId)) {
          msg.isReadBy.push(userId);
          updated = true;
        }
      }
    });
    
    if (updated) {
      saveDb(state);
    }
  }
};
