export type UserRole = 
  | 'Super Admin' 
  | 'Order Team' 
  | 'Packing Team' 
  | 'Tracking Team' 
  | 'Accounts Team';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginIp?: string;
  createdAt: string;
  phone?: string;
  password?: string;
  tempOtp?: string;
  tempOtpExpiry?: string;
}

export type OrderStatus =
  | 'Created'
  | 'Packing'
  | 'Courier Selected'
  | 'Label Generated'
  | 'Dispatched'
  | 'Call Placed Notification'
  | 'OFD' // Out for Delivery
  | 'Delivered'
  | 'Undelivered'
  | 'Return'
  | 'RDC' // Return Delivery Center
  | 'NDR'; // Non-Delivery Report

export interface TemporalRemark {
  remark_text: string;
  created_at: string;
  author_user_id: string;
}

export interface OrderHistory {
  status: OrderStatus;
  timestamp: string;
  updatedBy: string;
  remarks: string;
}

export interface Order {
  id: string; // Internal unique uuid
  orderId: string; // Customer visible (e.g. 99S-1001)
  customerName: string;
  phonePrimary: string;
  phoneSecondary?: string;
  phoneTertiary?: string;
  address: string;
  pincode: string;
  state: string;
  area: string;
  
  productDetails: string;
  paymentType: 'COD' | 'Paid';
  orderValue: number;
  weight: number; // in kg
  shippingDetails?: string;
  
  createdBy: string; // username
  handledBy?: string; // username
  internalRemarks?: string;
  temporal_remarks?: TemporalRemark[];
  isVip: boolean;
  
  status: OrderStatus;
  awb?: string;
  courier?: 'DTDC' | 'XpressBees' | 'Delhivery' | 'Aggregator';
  eta?: string;
  createdAt: string;
  updatedAt: string;
  
  history: OrderHistory[];

  // Additional requirement fields
  partiallyPaidAmount?: number;
  finalPayableAmount?: number;
  assignedTo?: string;
  feNumber?: string;
  inNdrWorkingSheet?: boolean;
  ndrAction?: 'Arranged' | 'Arranged for Tomorrow' | 'Future Delivery';
  futureDeliveryDate?: string;

  // DTDC fields
  dtdc_reference_number?: string;
  current_status?: string;
  current_status_code?: string;
  last_tracking_update?: string;
  label_generated?: boolean;
  cancelled?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface NdrRecord {
  id: string;
  orderId: string;
  customerName: string;
  phonePrimary: string;
  courier: string;
  awb: string;
  reason: string;
  status: 'Pending' | 'Re-attempt Scheduled' | 'Returned to Origin';
  reattemptDate?: string;
  internalNotes: string;
  temporal_remarks?: TemporalRemark[];
  history: {
    action: string;
    timestamp: string;
    remarks: string;
  }[];
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface CourierApiLog {
  id: string;
  timestamp: string;
  courier: string;
  action: string;
  requestPayload: string;
  responsePayload: string;
  status: 'Success' | 'Error';
}

export interface WhatsAppLog {
  id: string;
  timestamp: string;
  phone: string;
  type: 'Primary' | 'Secondary';
  message: string;
  status: 'Sent' | 'Failed';
}

export interface SystemSettings {
  primaryContactNumbers?: string[];
  secondaryContactNumbers?: string[];
  otpWhatsappNumber?: string;
  ipWhitelist: string[];
  isIpWhitelistEnabled: boolean;
  autoCourierEnabled: boolean;
  dtdcActive: boolean;
  xpressbeesActive: boolean;
  deliveryActive: boolean;
  aggregatorActive: boolean;
  dtdcConfig: {
    apiKey: string;
    priority: number;
    customerCode?: string;
    serviceTypeId?: string;
    commodityId?: string;
    username?: string;
    password?: string;
    accessToken?: string;
    contactName?: string;
    phone?: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  xpressbeesConfig: {
    apiKey: string;
    priority: number;
    email?: string;
    password?: string;
    secretKey?: string;
    xbKey?: string;
    activeAccount?: 'Air' | 'Surface';
    airAccount?: {
      email: string;
      password: string;
      secretKey: string;
      xbKey: string;
    };
    surfaceAccount?: {
      email: string;
      password: string;
      secretKey: string;
      xbKey: string;
    };
    baseUrl?: string;
    warehouseName?: string;
    contactName?: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    vendorCode?: string;
    serviceType?: string;
    authType?: string;
    tokenUrl?: string;
    manifestUrl?: string;
    awbGenUrl?: string;
    awbRetrieveUrl?: string;
    cancelUrl?: string;
    ndrUrl?: string;
    pincodeUrl?: string;
    trackSummaryUrl?: string;
    trackBulkUrl?: string;
  };
  deliveryConfig: {
    apiKey: string;
    priority: number;
    clientName?: string;
    pickupLocation?: string;
  };
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  recipientId: string; // User ID, or 'all' for broadcasts
  recipientName: string; // User Name, or 'All Users' for broadcasts
  recipientUsername: string; // User Username, or 'all' for broadcasts
  content: string;
  timestamp: string; // ISO format string
  isReadBy: string[]; // List of user IDs who have read the message
  isBroadcast: boolean; // True if it's an admin broadcast
  isAlertBanner?: boolean; // True if it should display as a global dashboard banner
}

