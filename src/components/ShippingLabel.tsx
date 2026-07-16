"use client";

import React from 'react';
import { Order } from '@/lib/types';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

interface ShippingLabelProps {
  order: Order;
  phoneOverride?: string;
}

// Helper: Convert number to Indian currency words
const convertNumberToWords = (num: number): string => {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    if (n === 0) return '';
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += 'and ';
      if (n < 20) {
        str += ones[n] + ' ';
      } else {
        str += tens[Math.floor(n / 10)] + ' ';
        if (n % 10 > 0) {
          str += ones[n % 10] + ' ';
        }
      }
    }
    return str;
  };

  const integerPart = Math.round(num);
  if (integerPart === 0) return 'Zero Only';

  let result = '';
  let temp = integerPart;

  const lakhs = Math.floor(temp / 100000);
  temp %= 100000;
  if (lakhs > 0) {
    result += convertLessThanOneThousand(lakhs) + 'Lakh ';
  }

  const thousands = Math.floor(temp / 1000);
  temp %= 1000;
  if (thousands > 0) {
    result += convertLessThanOneThousand(thousands) + 'Thousand ';
  }

  if (temp > 0) {
    result += convertLessThanOneThousand(temp);
  }

  return result.trim() + ' Only';
};

// Helper: Format invoice number
const getInvoiceNumber = (orderId: string) => {
  const cleanId = orderId.replace(/[^0-9]/g, '');
  const paddedId = cleanId.padStart(6, '0');
  return `INV-2026-07-${paddedId}`;
};

// Helper: Format date
const formatDate = (dateStr?: string) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return '14-07-2026';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// SVG Icon Components for high resolution print output
const ShieldLogo = () => (
  <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px' }}>
    <path d="M50 5C26 15 15 28 15 48C15 72 38 90 50 95C62 90 85 72 85 48C85 28 74 15 50 5Z" fill="#E53E3E" />
    <path d="M50 12C31 21 22 32 22 48C22 68 41 83 50 87C59 83 78 68 78 48C78 32 69 21 50 12Z" fill="#1A1A1E" />
    <text x="50%" y="60%" textAnchor="middle" fill="#FAFAFA" fontSize="30" fontWeight="900" fontFamily="sans-serif">99</text>
  </svg>
);

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2F855A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const UserIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const PinIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const TruckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const ClipboardIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const PackageIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <polygon points="12 22.08 12 12 3 6.92 3 17 12 22.08" />
    <polygon points="12 22.08 21 17 21 6.92 12 12 12 22.08" />
    <polygon points="12 12 21 6.92 12 1.84 3 6.92 12 12" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const BankNoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <line x1="6" y1="12" x2="6.01" y2="12" />
    <line x1="18" y1="12" x2="18.01" y2="12" />
  </svg>
);

// Real Barcode component using JsBarcode
const Barcode: React.FC<{ value: string; height: number }> = ({ value, height }) => {
  const svgRef = React.useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 1.5,
          height: height,
          displayValue: false,
          margin: 0,
          lineColor: '#000000',
        });
      } catch (e) {
        console.error('JsBarcode error:', e);
      }
    }
  }, [value, height]);

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
      <svg ref={svgRef} style={{ maxWidth: '100%', height: `${height}px` }} />
    </div>
  );
};

// Real QR Code component using qrcode
const QRCodeComponent: React.FC<{ value: string; size?: number }> = ({ value, size = 34 }) => {
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('');

  React.useEffect(() => {
    if (value) {
      QRCode.toDataURL(value, { margin: 2, width: 200 })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QRCode error:', err));
    }
  }, [value]);

  if (!qrDataUrl) {
    return <div style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#F0F0F0' }} />;
  }

  return (
    <img
      src={qrDataUrl}
      alt="QR Code"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'block',
        imageRendering: 'pixelated'
      }}
    />
  );
};

// Handle with Care SVGs
const FragileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 4px auto' }}>
    <path d="M6 3h12v3l-5 5v5h3v2H8v-2h3v-5L6 6V3z" />
    <line x1="6" y1="3" x2="18" y2="3" />
    <line x1="12" y1="13" x2="12" y2="16" />
    <line x1="8" y1="18" x2="16" y2="18" />
  </svg>
);

const ThisSideUpIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 4px auto' }}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 5 5 12" />
    <line x1="6" y1="20" x2="18" y2="20" />
  </svg>
);

const KeepDryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 4px auto' }}>
    <path d="M12 2v20M12 12c-4 0-7-3-7-7V4h14v1c0 4-3 7-7 7z" />
    <path d="M12 2a10 10 0 0 0 10 10" />
    <path d="M12 2a10 10 0 0 1-10 10" />
    <path d="M12 22a2 2 0 1 1-4 0h4z" />
  </svg>
);

// Customer Care Icons
const PhoneIconCC = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const MailIconCC = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const WebIconCC = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const ShippingLabel: React.FC<ShippingLabelProps> = ({ order, phoneOverride }) => {
  const [origin, setOrigin] = React.useState('');
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const isPrepaid = order.paymentType?.toUpperCase() === 'PAID';
  const customerPhone = phoneOverride || order.phonePrimary || 'N/A';

  // Tax computations
  const isInterstate = (order.state || '').trim().toLowerCase() !== 'haryana';
  const totalAmount = order.finalPayableAmount !== undefined ? order.finalPayableAmount : order.orderValue;
  const taxableVal = totalAmount / 1.18;
  const totalGst = totalAmount - taxableVal;

  const cgstVal = isInterstate ? 0 : totalGst / 2;
  const sgstVal = isInterstate ? 0 : totalGst / 2;
  const igstVal = isInterstate ? totalGst : 0;

  return (
    <div
      className="thermal-shipping-label"
      style={{
        width: '4in',
        height: '6in',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        border: '1.5px solid #000000',
        boxSizing: 'border-box',
        padding: '6px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontSize: '8px',
        lineHeight: '1.15',
        overflow: 'hidden',
        pageBreakAfter: 'always',
        margin: '0 auto',
      }}
    >

      {/* SECTION 1: HEADER BLOCK (logo, invoice details, gstin) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 0.9fr', borderBottom: '1px solid #000000', paddingBottom: '4px', alignItems: 'stretch' }}>

        {/* Brand & Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid #000000', paddingRight: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/99-logo.png" alt="99Store Logo" style={{ width: '36px', height: '36px', marginRight: '6px', objectFit: 'contain' }} />
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '0.01em', margin: 0, color: '#1A1A1E' }}>99STORE</h2>
              <span style={{ fontSize: '6px', fontWeight: 600, display: 'block', color: '#555' }}>HEALTH & WELLNESS</span>
            </div>
          </div>
          <div style={{ backgroundColor: '#E53E3E', color: '#FFFFFF', fontSize: '5px', fontWeight: 'bold', padding: '1px 3px', borderRadius: '2px', textAlign: 'center', marginTop: '2px' }}>
            ★ PREMIUM QUALITY, TRUSTED CARE ★
          </div>
        </div>

        {/* Tax Invoice Dates */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid #000000', padding: '0 4px', fontSize: '7px' }}>
          <div style={{ backgroundColor: '#E53E3E', color: '#FFFFFF', fontWeight: 'bold', fontSize: '8px', padding: '1px 4px', borderRadius: '3px', textAlign: 'center', marginBottom: '3px', width: 'fit-content', margin: '0 auto 3px auto' }}>
            TAX INVOICE
          </div>
          <div style={{ whiteSpace: 'nowrap' }}><strong>Invoice No.</strong> : {getInvoiceNumber(order.orderId)}</div>
          <div><strong>Invoice Date</strong> : {formatDate(order.createdAt)}</div>
          <div><strong>Order Date</strong> : {formatDate(order.createdAt)}</div>
        </div>

        {/* GSTIN & Compliance */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingLeft: '4px', fontSize: '6.5px', textAlign: 'center' }}>
          <div style={{ border: '0.5px solid #000000', padding: '0.5px 2px', fontWeight: 'bold', fontSize: '5.5px' }}>ORIGINAL FOR RECIPIENT</div>
          <div style={{ marginTop: '2px' }}>GSTIN<br /><strong>27ABCDE1234F1Z5</strong></div>
          <div style={{ color: '#2F855A', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
            <CheckIcon /> COMPLIANT
          </div>
          <div style={{ fontSize: '5px', color: '#555', marginTop: '1px' }}>THANK YOU FOR SHOPPING!</div>
        </div>

      </div>

      {/* SECTION 2: CONSIGNEE & COD AMOUNT ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', borderBottom: '1px solid #000000', alignItems: 'stretch' }}>

        {/* Consignee Details */}
        <div style={{ borderRight: '1px solid #000000', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ backgroundColor: '#000000', color: '#FFFFFF', fontWeight: 'bold', padding: '1px 4px', display: 'flex', alignItems: 'center', fontSize: '7.5px' }}>
            <PinIcon /> C/gn (Consignee) Details
          </div>
          <div style={{ padding: '2px 0 0 2px', fontSize: '8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div><strong>Name</strong> : <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{order.customerName}</span></div>
            <div style={{ lineHeight: '1.1', margin: '2px 0' }}><strong>Address</strong> : {order.address}{order.area ? `, ${order.area}` : ''}, {order.state} - <strong>{order.pincode}</strong></div>
            <div><strong>Mobile</strong> : {customerPhone}</div>
          </div>
        </div>

        {/* COD/PREPAID Collector Box */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2px' }}>
          {/* Main Red/Green Header */}
          <div style={{
            backgroundColor: isPrepaid ? '#2F855A' : '#E53E3E',
            color: '#FFFFFF',
            padding: '3px 4px',
            borderRadius: '2px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '42px'
          }}>
            <span style={{ fontSize: '6px', fontWeight: 'bold', letterSpacing: '0.05em' }}>{isPrepaid ? 'PREPAID AMOUNT' : 'COD AMOUNT'}</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginTop: '2px' }}>
              <div style={{ width: '13px', height: '13px', backgroundColor: '#FFFFFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: isPrepaid ? '#2F855A' : '#E53E3E', fontSize: '9px', fontWeight: 'bold' }}>₹</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 900 }}>
                {isPrepaid ? '0.00' : `${totalAmount.toFixed(2)}`}
              </span>
            </div>
          </div>
          {/* Cash collection instructions */}
          <div style={{ border: '0.5px dashed #000000', padding: '2px', borderRadius: '2px', marginTop: '2px', textAlign: 'center', fontSize: '6px' }}>
            <div style={{ color: isPrepaid ? '#2F855A' : '#E53E3E', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BankNoteIcon /> {isPrepaid ? 'DELIVER ONLY' : 'COLLECT CASH ONLY'}
            </div>
            <span style={{ color: '#555', fontSize: '5px' }}>
              {isPrepaid ? 'PREPAID - DO NOT COLLECT CASH' : 'PLEASE COLLECT EXACT AMOUNT'}
            </span>
          </div>
        </div>

      </div>

      {/* SECTION 3: TRACKING ID (Barcode & QR Code) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.3fr', borderBottom: '1px solid #000000', alignItems: 'stretch' }}>
        {/* AWB Barcode */}
        <div style={{ borderRight: '1px solid #000000', padding: '3px 4px 1px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '2px' }}>
            <div style={{ backgroundColor: '#000000', color: '#FFFFFF', fontWeight: 'bold', padding: '1px 4px', display: 'flex', alignItems: 'center', fontSize: '7px' }}>
              <TruckIcon /> TRACKING ID
            </div>
            <div style={{ fontSize: '8px', fontWeight: '900', color: '#000000', textTransform: 'uppercase', border: '1px solid #000000', padding: '1px 4.5px', borderRadius: '2px', display: 'inline-block', lineHeight: '1.2' }}>
              {order.courier || 'DTDC'}
            </div>
          </div>
          <Barcode value={order.awb || 'TRKID250620123456'} height={24} />
          <span style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.08em', marginTop: '2px' }}>
            {order.awb || 'TRKID250620123456'}
          </span>
        </div>
        {/* QR Code Scan To Track */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px', textAlign: 'center' }}>
          <span style={{ fontSize: '5.5px', fontWeight: 'bold', display: 'block', lineHeight: '1', marginBottom: '2px' }}>SCAN<br />TO<br />TRACK</span>
          <QRCodeComponent value={`${origin || 'https://www.99store.com'}/track?id=${order.awb || order.orderId}`} size={34} />
        </div>
      </div>

      {/* SECTION 4: ORDER ID (Barcode & Order text) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', borderBottom: '1px solid #000000', alignItems: 'center', padding: '2px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '7px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            <ClipboardIcon /> ORDER ID
          </div>
          <Barcode value={order.orderId || 'ORD-2025-061234'} height={12} />
        </div>
        <div style={{ borderLeft: '1px dashed #000000', paddingLeft: '8px', fontSize: '7.5px' }}>
          <span style={{ fontSize: '6px', color: '#555', display: 'block' }}>Order ID</span>
          <strong>{order.orderId || 'ORD-2025-061234'}</strong>
        </div>
      </div>

      {/* SECTION 5: SENDER DETAILS & PRODUCT DESCRIPTION */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000000', alignItems: 'stretch' }}>

        {/* Sender details */}
        <div style={{ borderRight: '1px solid #000000', padding: '2px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ backgroundColor: '#000000', color: '#FFFFFF', fontWeight: 'bold', padding: '1px 4px', display: 'flex', alignItems: 'center', fontSize: '7px' }}>
            <UserIcon /> SENDER DETAILS
          </div>
          <div style={{ padding: '2px 0 0 2px', fontSize: '7px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <strong>99Store Retail Pvt. Ltd.</strong>
            <div>Plot No. 48, Sector 5, IMT Manesar</div>
            <div>Gurugram, Haryana - 122050</div>
            <div>Mobile : 1800-123-4567</div>
            <div>GSTIN : 06ABCDE1234F1Z5</div>
          </div>
        </div>

        {/* Product description table */}
        <div style={{ padding: '2px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ backgroundColor: '#000000', color: '#FFFFFF', fontWeight: 'bold', padding: '1px 4px', display: 'flex', alignItems: 'center', fontSize: '7px' }}>
            <PackageIcon /> PRODUCT DESCRIPTION
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7px', marginTop: '2px', flex: 1 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid #000000' }}>
                <th style={{ textAlign: 'left', paddingBottom: '2px' }}>Product Name</th>
                <th style={{ textAlign: 'center', paddingBottom: '2px', width: '30px' }}>HSN</th>
                <th style={{ textAlign: 'right', paddingBottom: '2px', width: '20px' }}>QTY.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ paddingTop: '2px', lineHeight: '1.1', fontWeight: 'bold' }}>
                  {order.productDetails || '99Store Wellness Package'}
                </td>
                <td style={{ textAlign: 'center', paddingTop: '2px' }}>21069099</td>
                <td style={{ textAlign: 'right', paddingTop: '2px', fontWeight: 'bold' }}>1</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* SECTION 6: INVOICE DETAILS TABLE & BREAKDOWN */}
      <div style={{ borderBottom: '1px solid #000000', padding: '2px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ backgroundColor: '#000000', color: '#FFFFFF', fontWeight: 'bold', padding: '1px 4px', display: 'flex', alignItems: 'center', fontSize: '7px' }}>
          <FileTextIcon /> INVOICE DETAILS
        </div>

        {/* Main invoice table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5px', marginTop: '2px' }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #000000', backgroundColor: '#F7FAFC' }}>
              <th style={{ textAlign: 'left', padding: '2px 1px' }}>DESCRIPTION</th>
              <th style={{ textAlign: 'center', padding: '2px 1px' }}>HSN CODE</th>
              <th style={{ textAlign: 'center', padding: '2px 1px' }}>QTY.</th>
              <th style={{ textAlign: 'right', padding: '2px 1px' }}>RATE (₹)</th>
              <th style={{ textAlign: 'right', padding: '2px 1px' }}>TAXABLE VALUE (₹)</th>
              <th style={{ textAlign: 'center', padding: '2px 1px' }} colSpan={2}>TAX (9% / 9% / 18%)</th>
              <th style={{ textAlign: 'right', padding: '2px 1px' }}>AMOUNT (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '0.5px solid #E2E8F0' }}>
              <td style={{ padding: '2px 1px', fontWeight: 600, width: '35%' }}>{order.productDetails || '99Store Wellness Package'}</td>
              <td style={{ textAlign: 'center', padding: '2px 1px' }}>21069099</td>
              <td style={{ textAlign: 'center', padding: '2px 1px', fontWeight: 'bold' }}>1</td>
              <td style={{ textAlign: 'right', padding: '2px 1px' }}>{taxableVal.toFixed(2)}</td>
              <td style={{ textAlign: 'right', padding: '2px 1px' }}>{taxableVal.toFixed(2)}</td>
              <td style={{ textAlign: 'center', padding: '2px 1px' }} colSpan={2}>
                {isInterstate
                  ? `IGST: ₹${igstVal.toFixed(2)}`
                  : `C+S: ₹${(cgstVal + sgstVal).toFixed(2)}`}
              </td>
              <td style={{ textAlign: 'right', padding: '2px 1px', fontWeight: 'bold' }}>{totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Invoice footer (amount in words & totals table) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', marginTop: '2px', alignItems: 'start' }}>
          {/* Words and Badges */}
          <div style={{ paddingRight: '4px', fontSize: '6.5px' }}>
            <div style={{ marginBottom: '2px' }}>
              <span style={{ color: '#555', display: 'block', fontSize: '5.5px' }}>Amount in Words:</span>
              <strong style={{ textTransform: 'capitalize' }}>{convertNumberToWords(totalAmount)}</strong>
            </div>
            <div style={{ display: 'flex', gap: '3px', marginTop: '3px' }}>
              <span style={{ border: '0.5px solid #2F855A', color: '#2F855A', padding: '1px 3px', borderRadius: '2px', fontWeight: 'bold', fontSize: '5px' }}>✔ 100% AUTHENTIC</span>
              <span style={{ border: '0.5px solid #2F855A', color: '#2F855A', padding: '1px 3px', borderRadius: '2px', fontWeight: 'bold', fontSize: '5px' }}>✔ SAFE & EFFECTIVE</span>
            </div>
          </div>

          {/* Summary table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6px', textAlign: 'right' }}>
            <tbody>
              <tr>
                <td style={{ color: '#555', padding: '1px' }}>Taxable Value</td>
                <td style={{ fontWeight: 'bold', padding: '1px', width: '40px' }}>₹ {taxableVal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style={{ color: '#555', padding: '1px' }}>CGST (9%)</td>
                <td style={{ fontWeight: 'bold', padding: '1px' }}>{cgstVal > 0 ? `₹ ${cgstVal.toFixed(2)}` : '-'}</td>
              </tr>
              <tr>
                <td style={{ color: '#555', padding: '1px' }}>SGST (9%)</td>
                <td style={{ fontWeight: 'bold', padding: '1px' }}>{sgstVal > 0 ? `₹ ${sgstVal.toFixed(2)}` : '-'}</td>
              </tr>
              {isInterstate && (
                <tr>
                  <td style={{ color: '#555', padding: '1px' }}>IGST (18%)</td>
                  <td style={{ fontWeight: 'bold', padding: '1px' }}>₹ {igstVal.toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td style={{ color: '#555', padding: '1px' }}>Shipping Charges</td>
                <td style={{ fontWeight: 'bold', padding: '1px' }}>₹ 0.00</td>
              </tr>
              <tr style={{ backgroundColor: '#E53E3E', color: '#FFFFFF' }}>
                <td style={{ padding: '2px', fontWeight: 'bold', color: '#FFFFFF' }}>TOTAL AMOUNT</td>
                <td style={{ fontWeight: '900', padding: '2px', fontSize: '7.5px' }}>₹ {totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* SECTION 7: RTO & CUSTOMER CARE & Bottom Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>

        {/* Three Columns Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1.2fr', alignItems: 'stretch', padding: '2px 0' }}>

          {/* Return Address */}
          <div style={{ borderRight: '1px dashed #000000', paddingRight: '4px', fontSize: '6.5px' }}>
            <span style={{ fontWeight: 'bold', display: 'block', textDecoration: 'underline', fontSize: '6.5px', marginBottom: '1px' }}>RETURN / RTO ADDRESS:</span>
            <strong>99Store Retail Pvt. Ltd.</strong>
            <div>Plot No. 48, Sector 5, IMT Manesar</div>
            <div>Gurugram, Haryana - 122050</div>
            <div>Mobile: 1800-123-4567</div>
          </div>

          {/* Handle with Care */}
          <div style={{ borderRight: '1px dashed #000000', padding: '0 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontWeight: 'bold', display: 'block', fontSize: '5.5px', marginBottom: '3px' }}>HANDLE WITH CARE</span>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <div title="Fragile"><FragileIcon /></div>
              <div title="This Side Up"><ThisSideUpIcon /></div>
              <div title="Keep Dry"><KeepDryIcon /></div>
            </div>
          </div>

          {/* Customer Care */}
          <div style={{ paddingLeft: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '6.5px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontWeight: 'bold', display: 'block', fontSize: '6.5px', marginBottom: '1px' }}>CUSTOMER CARE:</span>
              <div><PhoneIconCC /> 1800-123-4567</div>
              <div><MailIconCC /> support@99store.com</div>
              <div><WebIconCC /> www.99store.com</div>
            </div>
            {/* Secondary customer care QR */}
            <QRCodeComponent value="https://www.99store.com" />
          </div>

        </div>

        {/* Bottom Tagline */}
        <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '2px 0', fontSize: '7px', fontWeight: 'bold', textAlign: 'center', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          THANK YOU FOR CHOOSING 99STORE <span style={{ color: '#E53E3E', margin: '0 3px' }}>♥</span> YOUR TRUST IS OUR STRENGTH
        </div>

      </div>

    </div>
  );
};
