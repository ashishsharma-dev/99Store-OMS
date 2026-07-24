'use client';

import React from 'react';
import { Order } from '@/lib/types';
import { AddressRatingIndicator } from './AddressRatingIndicator';

// Simple Code 39 Barcode Map
const CODE39_MAP: { [key: string]: string } = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
  '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
  '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
  'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',
  'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
  'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
  'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001',
  'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',
  'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
  '-': '100101011011', '.': '110010101101', ' ': '100110101101', '$': '100100100101',
  '/': '100100101001', '+': '100101001001', '%': '101001001001', '*': '100101101101'
};

// Fix the Asterisk encoding mapping
CODE39_MAP['*'] = '100101101101';

const Code39Barcode = ({ value, height = 45 }: { value: string; height?: number }) => {
  const cleanValue = (value || 'PENDING').toUpperCase().replace(/[^0-9A-Z\-\.\ \$\/\+\%]/g, '');
  const barcodeText = `*${cleanValue}*`;

  let pattern = '';
  for (let i = 0; i < barcodeText.length; i++) {
    const char = barcodeText[i];
    const charPattern = CODE39_MAP[char] || CODE39_MAP[' '];
    pattern += charPattern + '0';
  }

  const barWidth = 1.5;
  const totalWidth = pattern.length * barWidth;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${totalWidth} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {pattern.split('').map((bit, idx) => {
        if (bit === '1') {
          return (
            <rect
              key={idx}
              x={idx * barWidth}
              y={0}
              width={barWidth}
              height={height}
              fill="#000000"
            />
          );
        }
        return null;
      })}
    </svg>
  );
};

// Number to Words Converter helper
function numberToWords(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const g = ['', 'Thousand', 'Million', 'Billion'];

  if (num === 0) return 'Zero';

  const makeGroup = (n: number) => {
    let s = '';
    if (n >= 100) {
      s += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      s += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      s += a[n] + ' ';
    }
    return s;
  };

  let i = 0;
  let word = '';
  let integerPart = Math.floor(num);

  while (integerPart > 0) {
    let rem = integerPart % 1000;
    if (rem > 0) {
      word = makeGroup(rem) + g[i] + ' ' + word;
    }
    integerPart = Math.floor(integerPart / 1000);
    i++;
  }

  return word.trim() + ' Only';
}

interface HealvitaShippingLabelProps {
  order: Order;
  phoneSelection?: string;
}

export const HealvitaShippingLabel = ({ order, phoneSelection }: HealvitaShippingLabelProps) => {
  const finalPhone = phoneSelection || order.phonePrimary;

  // Format dates: DD-MM-YYYY
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '20-06-2026';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const invoiceNo = `INV-2025-${String(order.orderId || '').replace(/[^0-9]/g, '') || '001234'}`;
  const invoiceDate = formatDate(order.createdAt);
  const orderDate = formatDate(order.createdAt);

  const amountToCollect = (order.paymentType === 'COD' || (order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount))
    ? (order.orderValue - (order.partiallyPaidAmount || 0))
    : 0;

  // Tax calculations
  const orderVal = order.orderValue || 0;
  const isHaryana = (order.state || '').toLowerCase().includes('haryana');

  // Assume 18% GST (9% CGST + 9% SGST or 18% IGST)
  const taxableValue = parseFloat((orderVal / 1.18).toFixed(2));
  const totalTax = parseFloat((orderVal - taxableValue).toFixed(2));
  const cgst = isHaryana ? parseFloat((totalTax / 2).toFixed(2)) : 0;
  const sgst = isHaryana ? parseFloat((totalTax / 2).toFixed(2)) : 0;
  const igst = !isHaryana ? totalTax : 0;

  const amountInWords = numberToWords(amountToCollect > 0 ? amountToCollect : orderVal);

  const trackingAwb = order.awb || 'TRKID250620123456';
  const trackingUrl = `https://99-store-oms.vercel.app/track?id=${trackingAwb}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(trackingUrl)}`;

  return (
    <div className="healvita-label" style={{
      width: '100%',
      backgroundColor: '#FFFFFF',
      color: '#000000',
      fontFamily: 'sans-serif',
      boxSizing: 'border-box',
      border: '2px solid #000000',
      display: 'flex',
      flexDirection: 'column',
      fontSize: '10px',
      lineHeight: '1.2'
    }}>

      {/* 1. Header Box */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1fr',
        borderBottom: '2px solid #000000',
        padding: '6px',
        alignItems: 'center'
      }}>
        {/* Logo and brand name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid #000000', paddingRight: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
              <path d="M50 5C50 5 80 15 80 45C80 75 50 95 50 95C50 95 20 75 20 45C20 15 50 5 50 5Z" fill="#E53E3E" stroke="#000" strokeWidth="4" />
              <path d="M50 15C50 15 72 23 72 45C72 67 50 82 50 82C50 82 28 67 28 45C28 23 50 15 50 15Z" fill="#FFF" />
              <path d="M38 30 V60 H44 V48 H56 V60 H62 V30 H56 V42 H44 V30 H38 Z" fill="#E53E3E" />
            </svg> */}

            <img style={{ width: '40px', marginRight: '10px' }} src="/99-logo.png" loading="eager" alt="99Store Logo" />
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 900, margin: 0, color: '#000000', fontFamily: 'Arial, sans-serif', letterSpacing: '-0.5px' }}>99Store</h2>
              <span style={{ fontSize: '7px', fontWeight: 'bold', display: 'block', color: '#000000', marginTop: '-2px' }}>HEALTH & WELLNESS</span>
            </div>
          </div>
          <div style={{
            backgroundColor: '#E53E3E',
            color: '#FFFFFF',
            fontSize: '6.5px',
            fontWeight: 'bold',
            width: '100%',
            textAlign: 'center',
            padding: '2px 0',
            marginTop: '4px',
            borderRadius: '2px',
            letterSpacing: '0.5px'
          }}>
            ★ PREMIUM QUALITY, TRUSTED CARE ★
          </div>
        </div>

        {/* Tax invoice */}
        <div style={{ padding: '0 6px', borderRight: '1px solid #000000', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            backgroundColor: '#E53E3E',
            color: '#FFFFFF',
            fontSize: '8px',
            fontWeight: 'bold',
            textAlign: 'center',
            padding: '2px 0',
            borderRadius: '2px',
            marginBottom: '4px',
            textTransform: 'uppercase'
          }}>
            Tax Invoice
          </div>
          <div style={{ fontSize: '8px' }}>
            <div><strong>Invoice No.</strong> : {invoiceNo}</div>
            <div><strong>Invoice Date</strong> : {invoiceDate}</div>
            <div><strong>Order Date</strong> : {orderDate}</div>
          </div>
        </div>

        {/* Original for recipient */}
        <div style={{ paddingLeft: '6px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: '7px', fontWeight: 'bold', display: 'block', border: '1px solid #000000', padding: '1px 2px', borderRadius: '2px', textTransform: 'uppercase' }}>
            Original for Recipient
          </span>
          <span style={{ fontSize: '8px', fontWeight: 'bold', margin: '4px 0 2px 0', display: 'block' }}>
            GSTIN: 09GQCPS4557N1ZX
          </span>

          <span style={{ fontSize: '6px', color: '#555555', marginTop: '1px' }}>THANK YOU FOR SHOPPING WITH US!</span>
        </div>
      </div>

      {/* 2. Consignee Details & COD/Prepaid Box */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        borderBottom: '2px solid #000000'
      }}>
        {/* Consignee */}
        <div style={{ borderRight: '2px solid #000000', padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#000000', color: '#FFFFFF', padding: '2px 6px', borderRadius: '2px', fontSize: '7.5px', fontWeight: 'bold', width: 'fit-content' }}>
            📍 C/gn (Consignee) Details
          </div>
          <div style={{ fontSize: '8.5px', marginTop: '2px' }}>
            <div><strong>Name</strong> : <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{order.customerName}</span></div>
            <div style={{ display: 'flex', marginTop: '2px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <strong style={{ minWidth: '45px' }}>Address</strong> :
              <span style={{ paddingLeft: '4px', lineHeight: '1.2', flex: 1 }}>
                {order.address}, {order.area}, {order.state} - <strong>{order.pincode}</strong>
                {/* <AddressRatingIndicator address={order.address} mode="print" /> */}
              </span>
            </div>
            <div style={{ marginTop: '2px' }}><strong>Mobile</strong> : <span style={{ fontWeight: 'bold' }}>{finalPhone}</span></div>
          </div>
        </div>

        {/* COD Amount Box */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{
            backgroundColor: '#E53E3E',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            padding: '4px 6px',
            gap: '6px'
          }}>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              color: '#E53E3E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '11px'
            }}>
              ₹
            </div>
            <div style={{ lineHeight: '1.1' }}>
              <span style={{ fontSize: '6px', textTransform: 'uppercase', display: 'block' }}>
                {order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount
                  ? 'Balance to Collect'
                  : (order.paymentType === 'COD' ? 'COD Amount' : 'Payment Type')}
              </span>
              <span style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount
                  ? 'Partially Paid'
                  : (order.paymentType === 'COD' ? 'Collect Cash' : 'Prepaid')}
              </span>
            </div>
          </div>

          {/* Amount */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 900,
            color: '#E53E3E',
            padding: '2px 0',
            borderBottom: '1px solid #E2E8F0'
          }}>
            ₹{amountToCollect.toFixed(2)}
          </div>

          {/* Cash collector instructions */}
          <div style={{
            padding: '3px',
            textAlign: 'center',
            fontSize: '7px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}>
            💵 {order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount ? (
              <span style={{ color: '#C05621' }}><strong>PARTIALLY PAID - COLLECT BALANCE CASH</strong><br />PLEASE COLLECT BALANCE ₹{amountToCollect.toFixed(2)}</span>
            ) : order.paymentType === 'COD' ? (
              <span><strong>COLLECT CASH ONLY</strong><br />PLEASE COLLECT EXACT AMOUNT</span>
            ) : (
              <span style={{ color: '#2F855A' }}><strong>PREPAID - DO NOT COLLECT CASH</strong><br />THANK YOU FOR SHOPPING!</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Tracking ID Box */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        borderBottom: '2px solid #000000'
      }}>
        {/* Barcode side */}
        <div style={{
          borderRight: '2px solid #000000',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1px 6px', borderRadius: '2px', fontSize: '7.5px', fontWeight: 'bold' }}>
              🚚 TRACKING ID
            </span>
            <span style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {order.courier || 'DTDC'}
            </span>
          </div>

          {/* Barcode component */}
          <div style={{ width: '100%', margin: '2px 0' }}>
            <Code39Barcode value={trackingAwb} height={38} />
          </div>

          <span style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '2px', fontFamily: 'monospace' }}>
            {trackingAwb}
          </span>
        </div>

        {/* QR Code Scan Side */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.8fr',
          padding: '6px',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '8px',
            backgroundColor: '#000000',
            color: '#FFFFFF',
            height: '100%',
            borderRadius: '4px',
            padding: '4px'
          }}>
            <span>SCAN</span>
            <span>TO</span>
            <span>TRACK</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: '4px' }}>
            <img src={qrCodeUrl} alt="Scan QR" loading="eager" style={{ width: '56px', height: '56px', border: '1px solid #E2E8F0' }} />
          </div>
        </div>
      </div>

      {/* 4. Order ID Box */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        borderBottom: '2px solid #000000',
        alignItems: 'center',
        padding: '3px 4px'
      }}>
        {/* Order barcode */}
        <div style={{ borderRight: '2px solid #000000', paddingRight: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
            <span style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1px 6px', borderRadius: '2px', fontSize: '7.5px', fontWeight: 'bold' }}>
              📋 ORDER ID
            </span>
          </div>
          <div style={{ width: '100%', margin: '2px 0' }}>
            <Code39Barcode value={order.orderId} height={18} />
          </div>
        </div>

        {/* Order Id details text */}
        <div style={{ paddingLeft: '6px' }}>
          <span style={{ fontSize: '7px', color: '#555555', display: 'block' }}>Order ID:</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{order.orderId}</span>
        </div>
      </div>

      {/* 5. Sender details & Product description */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        borderBottom: '2px solid #000000'
      }}>
        {/* Sender details */}
        <div style={{ borderRight: '2px solid #000000', padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1px 6px', borderRadius: '2px', fontSize: '7.5px', fontWeight: 'bold', width: 'fit-content' }}>
            👤 SENDER DETAILS
          </div>
          <div style={{ fontSize: '7.5px', lineHeight: '1.2', marginTop: '2px' }}>
            <div style={{ fontWeight: 'bold' }}>Shivay Ayurveda</div>
            <div>Plot No. 25 Dwarika Dham Colony</div>
            <div>Hathras Road Agra UP 282006</div>
            <div>Mobile : 9027953133</div>
            <div><strong>GSTIN</strong> : 09GQCPS4557N1ZX</div>
            <div><strong>FSSAI</strong> : 22726113002151</div>
          </div>
        </div>

        {/* Product description */}
        <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1px 6px', borderRadius: '2px', fontSize: '7.5px', fontWeight: 'bold', width: 'fit-content' }}>
            📦 PRODUCT DESCRIPTION
          </div>

          <table style={{ width: '100%', fontSize: '7.5px', borderCollapse: 'collapse', marginTop: '2px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000000', textAlign: 'left', fontWeight: 'bold' }}>
                <th style={{ padding: '1px 0' }}>Product Name</th>
                <th style={{ padding: '1px 2px', textAlign: 'right' }}>HSN</th>
                <th style={{ padding: '1px 0', textAlign: 'right' }}>QTY.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '1px 0', fontWeight: 'bold' }}>
                  {order.productDetails || 'Wellness Premium Supplements'}
                </td>
                <td style={{ padding: '1px 2px', textAlign: 'right' }}>3004</td>
                <td style={{ padding: '1px 0', textAlign: 'right', fontWeight: 'bold' }}>1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Invoice Details Table */}
      <div style={{ padding: '6px', borderBottom: '2px solid #000000' }}>
        <div style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '1px 6px', borderRadius: '2px', fontSize: '7.5px', fontWeight: 'bold', width: 'fit-content', marginBottom: '4px' }}>
          📄 INVOICE DETAILS
        </div>

        <table style={{ width: '100%', fontSize: '7.5px', borderCollapse: 'collapse', border: '1px solid #000000' }}>
          <thead>
            <tr style={{ backgroundColor: '#F7FAFC', borderBottom: '1px solid #000000', fontWeight: 'bold', fontSize: '6.5px' }}>
              <th style={{ borderRight: '1px solid #000000', padding: '2px', textAlign: 'left' }}>DESCRIPTION</th>
              <th style={{ borderRight: '1px solid #000000', padding: '2px', textAlign: 'center' }}>HSN CODE</th>
              <th style={{ borderRight: '1px solid #000000', padding: '2px', textAlign: 'center' }}>QTY.</th>
              <th style={{ borderRight: '1px solid #000000', padding: '2px', textAlign: 'right' }}>RATE (₹)</th>
              <th style={{ borderRight: '1px solid #000000', padding: '2px', textAlign: 'right' }}>TAXABLE (₹)</th>
              <th style={{ borderRight: '1px solid #000000', padding: '1px', textAlign: 'center' }}>CGST (9%)</th>
              <th style={{ borderRight: '1px solid #000000', padding: '1px', textAlign: 'center' }}>SGST (9%)</th>
              <th style={{ borderRight: '1px solid #000000', padding: '1px', textAlign: 'center' }}>IGST (18%)</th>
              <th style={{ padding: '2px', textAlign: 'right' }}>AMOUNT (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #000000' }}>
              <td style={{ borderRight: '1px solid #000000', padding: '3px', fontWeight: 'bold' }}>
                {order.productDetails || 'Wellness Premium Supplements'}
              </td>
              <td style={{ borderRight: '1px solid #000000', padding: '3px', textAlign: 'center' }}>3004</td>
              <td style={{ borderRight: '1px solid #000000', padding: '3px', textAlign: 'center' }}>1</td>
              <td style={{ borderRight: '1px solid #000000', padding: '3px', textAlign: 'right' }}>{taxableValue.toFixed(2)}</td>
              <td style={{ borderRight: '1px solid #000000', padding: '3px', textAlign: 'right' }}>{taxableValue.toFixed(2)}</td>
              <td style={{ borderRight: '1px solid #000000', padding: '3px', textAlign: 'right' }}>{isHaryana ? cgst.toFixed(2) : '-'}</td>
              <td style={{ borderRight: '1px solid #000000', padding: '3px', textAlign: 'right' }}>{isHaryana ? sgst.toFixed(2) : '-'}</td>
              <td style={{ borderRight: '1px solid #000000', padding: '3px', textAlign: 'right' }}>{!isHaryana ? igst.toFixed(2) : '-'}</td>
              <td style={{ padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{orderVal.toFixed(2)}</td>
            </tr>
            {/* Summary calculation rows */}
            <tr>
              <td colSpan={4} rowSpan={5} style={{ borderRight: '1px solid #000000', padding: '4px', verticalAlign: 'top' }}>
                <div style={{ fontSize: '7.5px' }}>
                  <strong>Amount in Words:</strong><br />
                  <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{amountInWords}</span>
                </div>

                {/* Visual badges */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <div style={{ border: '1px solid #000000', padding: '1px 3px', borderRadius: '2px', fontSize: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '1px' }}>
                    ✔ 100% AUTHENTIC
                  </div>
                  <div style={{ border: '1px solid #000000', padding: '1px 3px', borderRadius: '2px', fontSize: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '1px' }}>
                    🛡 SAFE & EFFECTIVE
                  </div>
                </div>
              </td>
              <td colSpan={4} style={{ borderRight: '1px solid #000000', padding: '2px 4px', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>Taxable Value</td>
              <td style={{ padding: '2px 4px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>₹{taxableValue.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ borderRight: '1px solid #000000', padding: '2px 4px', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>CGST (9%)</td>
              <td style={{ padding: '2px 4px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>₹{cgst.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ borderRight: '1px solid #000000', padding: '2px 4px', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>SGST (9%)</td>
              <td style={{ padding: '2px 4px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>₹{sgst.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ borderRight: '1px solid #000000', padding: '2px 4px', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>Shipping Charges</td>
              <td style={{ padding: '2px 4px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>₹0.00</td>
            </tr>
            {order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 ? (
              <>
                <tr style={{ fontWeight: 'bold' }}>
                  <td colSpan={4} style={{ borderRight: '1px solid #000000', padding: '2px 4px', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>TOTAL AMOUNT</td>
                  <td style={{ padding: '2px 4px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>₹{orderVal.toFixed(2)}</td>
                </tr>
                <tr style={{ color: '#10B981', fontWeight: 'bold' }}>
                  <td colSpan={4} style={{ borderRight: '1px solid #000000', padding: '2px 4px', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>LESS: PAID AMOUNT</td>
                  <td style={{ padding: '2px 4px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>-₹{order.partiallyPaidAmount.toFixed(2)}</td>
                </tr>
                <tr style={{ backgroundColor: '#E53E3E', color: '#FFFFFF', fontWeight: 'bold' }}>
                  <td colSpan={4} style={{ borderRight: '1px solid #FFFFFF', padding: '3px 4px', textAlign: 'left' }}>
                    {(order.paymentType === 'COD' || (order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount)) ? 'BALANCE TO COLLECT (COD)' : 'TOTAL AMOUNT'}
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                    ₹{amountToCollect.toFixed(2)}
                  </td>
                </tr>
              </>
            ) : (
              <tr style={{ backgroundColor: '#E53E3E', color: '#FFFFFF', fontWeight: 'bold' }}>
                <td colSpan={4} style={{ borderRight: '1px solid #FFFFFF', padding: '3px 4px', textAlign: 'left' }}>TOTAL AMOUNT</td>
                <td style={{ padding: '3px 4px', textAlign: 'right' }}>₹{orderVal.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 7. Footer Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1fr',
        padding: '6px',
        fontSize: '7px',
        lineHeight: '1.2',
        alignItems: 'center'
      }}>
        {/* RTO Address */}
        <div style={{ borderRight: '1px solid #000000', paddingRight: '6px' }}>
          <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
            🔄 RETURN / RTO ADDRESS
          </div>
          <div>Shivay Ayurveda</div>
          <div>Plot No. 25 Dwarika Dham Colony</div>
          <div>Hathras Road Agra UP 282006</div>
          <div>Mobile: 9027953133</div>
          <div><strong>FSSAI</strong> : 22726113002151</div>
        </div>

        {/* Handle with care */}
        <div style={{ borderRight: '1px solid #000000', padding: '0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '6.5px', textTransform: 'uppercase' }}>Handle With Care</span>
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
            <div style={{ border: '1px solid #000000', padding: '2px', borderRadius: '2px', textAlign: 'center', minWidth: '30px' }}>
              🍷<br /><span style={{ fontSize: '4.5px', fontWeight: 'bold' }}>FRAGILE</span>
            </div>
            <div style={{ border: '1px solid #000000', padding: '2px', borderRadius: '2px', textAlign: 'center', minWidth: '30px' }}>
              ↑↑<br /><span style={{ fontSize: '4.5px', fontWeight: 'bold' }}>THIS SIDE UP</span>
            </div>
            <div style={{ border: '1px solid #000000', padding: '2px', borderRadius: '2px', textAlign: 'center', minWidth: '30px' }}>
              ☂<br /><span style={{ fontSize: '4.5px', fontWeight: 'bold' }}>KEEP DRY</span>
            </div>
          </div>
        </div>

        {/* Customer Care */}
        <div style={{ paddingLeft: '6px', display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
          <div style={{ fontWeight: 'bold', width: '100%' }}>🎧 CUSTOMER CARE</div>
          <div style={{ width: '100%' }}>📞 9027953133</div>
          <div style={{ width: '100%', wordBreak: 'break-all' }}>✉ customercare@viatvi.com</div>
          <div style={{ width: '100%' }}>🌐 www.viatvi.com</div>
        </div>
      </div>

      {/* 8. Black Bottom Bar */}
      <div style={{
        backgroundColor: '#000000',
        color: '#FFFFFF',
        textAlign: 'center',
        padding: '3px 0',
        fontSize: '7px',
        fontWeight: 'bold',
        letterSpacing: '0.5px'
      }}>
        THANK YOU FOR CHOOSING SHIVAY AYURVEDA ❤️ YOUR TRUST IS OUR STRENGTH
      </div>

    </div>
  );
};
