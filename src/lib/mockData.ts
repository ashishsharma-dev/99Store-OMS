import { User, Order, NdrRecord, SystemSettings, WhatsAppLog, CourierApiLog, Message } from './types';

export const mockUsers: User[] = [
  {
    id: 'usr-1',
    username: 'admin',
    name: 'Aniket Sharma (Super Admin)',
    role: 'Super Admin',
    isActive: true,
    lastLoginIp: '127.0.0.1',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '9999999999',
    password: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' // admin123
  },
  {
    id: 'usr-2',
    username: 'order_user',
    name: 'Rahul K. (Order Team)',
    role: 'Order Team',
    isActive: true,
    lastLoginIp: '127.0.0.1',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '9999999999',
    password: 'b621ec544b845350195c1b6e5a3c1b01265634409df15c1c4aa1e93a88e72eb9' // order123
  },
  {
    id: 'usr-3',
    username: 'packing_user',
    name: 'Suresh Kumar (Packing Team)',
    role: 'Packing Team',
    isActive: true,
    lastLoginIp: '192.168.1.10',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '9999999999',
    password: '991439961443957d513bb02e4da72a8c6e10f0ebb1a07ac7b8b9b3fb42006b0c' // packing123
  },
  {
    id: 'usr-4',
    username: 'tracking_user',
    name: 'Neha Mehta (Tracking Team)',
    role: 'Tracking Team',
    isActive: true,
    lastLoginIp: '192.168.1.11',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '9999999999',
    password: 'bc321463451204a196d7dff38ff4d79a230f82e804263e7f3801a21ed9840f5c' // tracking123
  },
  {
    id: 'usr-5',
    username: 'accounts_user',
    name: 'Rohan Shah (Accounts Team)',
    role: 'Accounts Team',
    isActive: true,
    lastLoginIp: '127.0.0.1',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '9999999999',
    password: '3730f9f9069024dccfefaf0c79ac46208e3256ddb38f46e5c5556069083e9930' // accounts123
  }
];

export const mockSettings: SystemSettings = {
  otpWhatsappNumber: '9999999999',
  ipWhitelist: ['127.0.0.1', '::1', '192.168.1.10', '192.168.1.11'],
  isIpWhitelistEnabled: false, // Turned off by default to make local testing seamless, but can toggle in settings
  autoCourierEnabled: true,
  dtdcActive: true,
  xpressbeesActive: true,
  deliveryActive: true,
  aggregatorActive: true,
  dtdcConfig: {
    apiKey: 'f4ae602554b4a185d21695991885f0',
    priority: 1,
    customerCode: 'GL018',
    serviceTypeId: 'PRIORITY',
    commodityId: '2',
    username: 'GL018_trk_json',
    password: 'chwzf'
  },
  xpressbeesConfig: {
    apiKey: 'xb_live_key_99store_cd3e82ab',
    priority: 2,
    email: 'admin@shivayair.com',
    password: 'Xpress@1234567',
    baseUrl: 'https://shipment.xpressbees.com/api',
    warehouseName: 'Main Warehouse',
    contactName: 'Warehouse Manager',
    address: '140 MG Road',
    address2: 'Near Metro Station',
    city: 'Agra',
    state: 'Uttar Pradesh',
    pincode: '282001',
    phone: '9999999999',
    secretKey: 'd0277ffa8e293bf04578ee8f63337fe71ac41f854e296fb95b5975ed5aa4a802',
    xbKey: 'JnueT39994Dyats',
    vendorCode: 'VEND001',
    serviceType: 'NDD',
    authType: 'new',
    tokenUrl: 'https://userauthapis.xbees.in/api/auth/generateToken',
    manifestUrl: 'https://apishipmentmanifestation.xbees.in/shipmentmanifestation/forward',
    awbGenUrl: 'https://xbclientapi.xbees.in/POSTShipmentService.svc/AWBNumberSeriesGeneration',
    awbRetrieveUrl: 'https://xbclientapi.xbees.in/TrackingService.svc/GetAWBNumberGeneratedSeries',
    cancelUrl: 'https://clientshipupdatesapi.xbees.in/forwardcancellation',
    ndrUrl: 'https://clientshipupdatesapi.xbees.in/client/UpdateNDRDeferredDeliveryDate',
    pincodeUrl: 'https://xbmasterapi.xbees.in/expose/get/serviceabilitypincode/details',
    trackSummaryUrl: 'https://apishipmenttracking.xbees.in/GetShipmentAuditLog',
    trackBulkUrl: 'https://apishipmenttracking.xbees.in/GetCurrentShipmentStatus'
  },
  deliveryConfig: {
    apiKey: 'dlv_live_tok_99store_fe839db0',
    priority: 3,
    clientName: 'SOM ENTERPRISES',
    pickupLocation: 'Default Pickup Location'
  }
};

export const mockOrders: Order[] = [
  {
    id: 'ord-1001',
    orderId: '99S-1001',
    customerName: 'Aditya Birla',
    phonePrimary: '9876543210',
    phoneSecondary: '9876543211',
    address: 'Flat 402, Sunset Heights, Bandra West',
    pincode: '400050',
    state: 'Maharashtra',
    area: 'Mumbai',
    productDetails: '99Store Premium Ceramic Coffee Mug - Matte Black',
    paymentType: 'Paid',
    orderValue: 999,
    weight: 0.6,
    createdBy: 'admin',
    isVip: true,
    status: 'Delivered',
    awb: 'DTDC901238912',
    courier: 'DTDC',
    eta: '2026-05-25',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    history: [
      { status: 'Created', timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'admin', remarks: 'Order imported via manual entry.' },
      { status: 'Packing', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'Items verified and bubble wrapped.' },
      { status: 'Courier Selected', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'Auto-routed to DTDC (Weight < 1kg).' },
      { status: 'Label Generated', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'AWB DTDC901238912 allocated.' },
      { status: 'Dispatched', timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'tracking_user', remarks: 'Handed over to DTDC pickup hub.' },
      { status: 'OFD', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'tracking_user', remarks: 'Out for delivery from Bandra Hub (Rider: Vikram, 9892182738).' },
      { status: 'Delivered', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'tracking_user', remarks: 'Delivered. OTP verified.' }
    ]
  },
  {
    id: 'ord-1002',
    orderId: '99S-1002',
    customerName: 'Priya Sharma',
    phonePrimary: '8765432109',
    address: 'House No 12, Sector 15',
    pincode: '122001',
    state: 'Haryana',
    area: 'Gurugram',
    productDetails: '99Store Leather Travel Organiser',
    paymentType: 'COD',
    orderValue: 1499,
    weight: 0.8,
    createdBy: 'order_user',
    isVip: false,
    status: 'Dispatched',
    awb: 'XB878291038',
    courier: 'XpressBees',
    eta: '2026-06-03',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    history: [
      { status: 'Created', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'order_user', remarks: 'COD Order created. Verified by phone call.' },
      { status: 'Packing', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'Packing complete. Sealed with 99Store tape.' },
      { status: 'Courier Selected', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'Auto-routed to XpressBees.' },
      { status: 'Label Generated', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'AWB XB878291038 allocated.' },
      { status: 'Dispatched', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'tracking_user', remarks: 'Shipped from Main Warehouse.' }
    ]
  },
  {
    id: 'ord-1003',
    orderId: '99S-1003',
    customerName: 'Rajesh Patel',
    phonePrimary: '7654321098',
    phoneSecondary: '7654321099',
    address: '403, Shanti Niketan Apts, SG Highway',
    pincode: '380015',
    state: 'Gujarat',
    area: 'Ahmedabad',
    productDetails: '99Store Desk Mat Minimalist Wool Felt (Large)',
    paymentType: 'COD',
    orderValue: 1299,
    weight: 0.9,
    createdBy: 'order_user',
    isVip: true,
    status: 'NDR',
    awb: 'DLV991203948',
    courier: 'Delhivery',
    eta: '2026-05-30',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    history: [
      { status: 'Created', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'order_user', remarks: 'VIP Customer COD order created.' },
      { status: 'Packing', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'Standard packing.' },
      { status: 'Courier Selected', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'Auto-routed to Delhivery.' },
      { status: 'Label Generated', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'AWB DLV991203948 allocated.' },
      { status: 'Dispatched', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'tracking_user', remarks: 'Dispatched via Express Service.' },
      { status: 'OFD', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'tracking_user', remarks: 'Out for delivery Ahmedabad West.' },
      { status: 'NDR', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), updatedBy: 'tracking_user', remarks: 'Delivery failed: Customer phone out of reach.' }
    ]
  },
  {
    id: 'ord-1004',
    orderId: '99S-1004',
    customerName: 'Karan Johar',
    phonePrimary: '9988776655',
    address: 'Bunglow 99, Juhu Scheme',
    pincode: '400049',
    state: 'Maharashtra',
    area: 'Mumbai',
    productDetails: '99Store Solid Brass Pen + Leather Stand Set',
    paymentType: 'Paid',
    orderValue: 3999,
    weight: 1.5,
    createdBy: 'admin',
    isVip: true,
    status: 'Packing',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    history: [
      { status: 'Created', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), updatedBy: 'admin', remarks: 'Premium Paid Order created.' },
      { status: 'Packing', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), updatedBy: 'packing_user', remarks: 'Assigned to packing queue.' }
    ]
  },
  {
    id: 'ord-1005',
    orderId: '99S-1005',
    customerName: 'Meera Nair',
    phonePrimary: '9009009001',
    address: 'Apartment 7B, Green Meadows, Indira Nagar',
    pincode: '560038',
    state: 'Karnataka',
    area: 'Bengaluru',
    productDetails: '99Store Bamboo Keyboard & Mouse Combo',
    paymentType: 'Paid',
    orderValue: 2499,
    weight: 1.2,
    createdBy: 'order_user',
    isVip: false,
    status: 'Created',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [
      { status: 'Created', timestamp: new Date().toISOString(), updatedBy: 'order_user', remarks: 'Order entered manually.' }
    ]
  }
];

export const mockNdrs: NdrRecord[] = [
  {
    id: 'ndr-1',
    orderId: '99S-1003',
    customerName: 'Rajesh Patel',
    phonePrimary: '7654321098',
    courier: 'Delhivery',
    awb: 'DLV991203948',
    reason: 'Customer phone out of reach / Switched off',
    status: 'Pending',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    internalNotes: 'VIP Customer, call alternate phone number (7654321099) during next attempt.',
    history: [
      {
        action: 'NDR Received from Courier API',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        remarks: 'Status marked as NDR due to failed delivery. Reason: Phone unreachable.'
      }
    ]
  }
];

export const mockWhatsAppLogs: WhatsAppLog[] = [
  {
    id: 'wa-1',
    timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '9876543210',
    type: 'Primary',
    message: 'Welcome Aditya Birla! Your order 99S-1001 for 99Store Premium Ceramic Coffee Mug - Matte Black has been created. Thank you for shopping with 99Store!',
    status: 'Sent'
  },
  {
    id: 'wa-2',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '9876543210',
    type: 'Primary',
    message: 'Hi Aditya Birla, your 99Store order 99S-1001 is dispatched! Courier: DTDC, AWB: DTDC901238912. Track status online.',
    status: 'Sent'
  },
  {
    id: 'wa-3',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '9876543211',
    type: 'Secondary',
    message: 'Tracking Update: Order 99S-1001 is now OUT FOR DELIVERY (OFD). Rider: Vikram (9892182738). ETA: Today.',
    status: 'Sent'
  },
  {
    id: 'wa-4',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '9876543210',
    type: 'Primary',
    message: 'Delivered! Your 99Store order 99S-1001 was successfully delivered today. Enjoy your purchase!',
    status: 'Sent'
  },
  {
    id: 'wa-5',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    phone: '8765432109',
    type: 'Primary',
    message: 'Welcome Priya Sharma! Your COD order 99S-1002 has been created. Amount due on delivery: ₹1499.00.',
    status: 'Sent'
  }
];

export const mockCourierLogs: CourierApiLog[] = [
  {
    id: 'cl-1',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    courier: 'DTDC',
    action: 'Generate AWB',
    requestPayload: JSON.stringify({
      orderId: '99S-1001',
      shipper: '99Store Warehouse, Delhi',
      recipient: { name: 'Aditya Birla', address: 'Flat 402, Sunset Heights, Bandra West', pincode: '400050', phone: '9876543210' },
      weight: 0.6,
      payment: 'Prepaid'
    }, null, 2),
    responsePayload: JSON.stringify({
      status: 'SUCCESS',
      awb: 'DTDC901238912',
      estimated_days: 2,
      charge: 85.00
    }, null, 2),
    status: 'Success'
  },
  {
    id: 'cl-2',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    courier: 'XpressBees',
    action: 'Generate AWB',
    requestPayload: JSON.stringify({
      orderId: '99S-1002',
      shipper: '99Store Warehouse, Delhi',
      recipient: { name: 'Priya Sharma', address: 'House No 12, Sector 15', pincode: '122001', phone: '8765432109' },
      weight: 0.8,
      payment: 'COD',
      cod_amount: 1499
    }, null, 2),
    responsePayload: JSON.stringify({
      status: 'SUCCESS',
      awb: 'XB878291038',
      estimated_days: 3,
      charge: 110.00
    }, null, 2),
    status: 'Success'
  }
];

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    senderId: 'usr-1',
    senderUsername: 'admin',
    senderName: 'Aniket Sharma (Super Admin)',
    recipientId: 'all',
    recipientUsername: 'all',
    recipientName: 'All Users',
    content: 'Welcome to the internal messaging system. Please use this space to coordinate orders, verify packing queues, and report delivery issues.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isReadBy: ['usr-1', 'usr-2', 'usr-3'],
    isBroadcast: true
  },
  {
    id: 'msg-2',
    senderId: 'usr-3',
    senderUsername: 'packing_user',
    senderName: 'Suresh Kumar (Packing Team)',
    recipientId: 'usr-2',
    recipientUsername: 'order_user',
    recipientName: 'Rahul K. (Order Team)',
    content: 'Hi Rahul, is order 99S-1002 ready for packing? Customer details look incomplete on my dashboard.',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    isReadBy: ['usr-2'],
    isBroadcast: false
  },
  {
    id: 'msg-3',
    senderId: 'usr-2',
    senderUsername: 'order_user',
    senderName: 'Rahul K. (Order Team)',
    recipientId: 'usr-3',
    recipientUsername: 'packing_user',
    recipientName: 'Suresh Kumar (Packing Team)',
    content: 'Yes Suresh, I verified the phone call. Address and pincode are correct. You can proceed with packing.',
    timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    isReadBy: ['usr-3'],
    isBroadcast: false
  },
  {
    id: 'msg-4',
    senderId: 'usr-5',
    senderUsername: 'accounts_user',
    senderName: 'Rohan Shah (Accounts Team)',
    recipientId: 'usr-1',
    recipientUsername: 'admin',
    recipientName: 'Aniket Sharma (Super Admin)',
    content: 'Aniket, the courier charges for Delhivery are higher than DTDC for orders under 1kg. Can we double check the auto-routing settings?',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isReadBy: [],
    isBroadcast: false
  }
];

