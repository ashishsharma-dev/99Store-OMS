import React, { useState } from 'react';
import { Eye, Copy, Check } from 'lucide-react';
import { Order } from '@/lib/types';
import { AddressRatingIndicator } from './AddressRatingIndicator';
import { getUserDisplayName } from '@/lib/utils';

interface InspectTooltipButtonProps {
  order: Order;
  onClick: () => void;
  iconSize?: number;
  padding?: string;
  showText?: boolean;
}

export const InspectTooltipButton = ({ 
  order, 
  onClick, 
  iconSize = 14, 
  padding = '6px 8px',
  showText = false
}: InspectTooltipButtonProps) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const fullAddress = `${order.address}, ${order.area || ''}, ${order.state || ''} - ${order.pincode || ''}`
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div 
      className="inspect-tooltip-container"
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseLeave={() => setCopiedType(null)}
    >
      <button
        onClick={onClick}
        className="premium-btn premium-btn-secondary"
        style={{ padding, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        title="View Full Order Details"
      >
        <Eye size={iconSize} />
        {showText && <span>Inspect</span>}
      </button>

      {/* Tooltip Card */}
      <div 
        className="inspect-tooltip-card"
        style={{
          visibility: 'hidden',
          opacity: 0,
          position: 'absolute',
          top: '100%',
          marginTop: '6px',
          right: 0,
          width: '260px',
          backgroundColor: '#161618',
          border: '1px solid #2D2D30',
          borderRadius: '6px',
          padding: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 1000,
          transition: 'opacity 0.15s ease-in-out, visibility 0.15s ease-in-out',
          color: '#FAFAFA',
          fontSize: '11px',
          lineHeight: '1.4',
          textAlign: 'left',
          whiteSpace: 'normal'
        }}
      >
        <div style={{ fontWeight: 600, borderBottom: '1px solid #2D2D30', paddingBottom: '6px', marginBottom: '8px', color: '#A1A1AA' }}>
          Quick Info: {order.orderId}
        </div>

        {/* Phone numbers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace' }}>📞 P: {order.phonePrimary}</span>
            <button
              onClick={(e) => copyToClipboard(order.phonePrimary, 'p1', e)}
              style={{ background: 'none', border: 'none', color: copiedType === 'p1' ? '#10B981' : '#737373', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
              title="Copy Primary Phone"
            >
              {copiedType === 'p1' ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace' }}>📞 S: {order.phoneSecondary || 'N/A'}</span>
            {order.phoneSecondary && (
              <button
                onClick={(e) => copyToClipboard(order.phoneSecondary!, 'p2', e)}
                style={{ background: 'none', border: 'none', color: copiedType === 'p2' ? '#10B981' : '#737373', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                title="Copy Secondary Phone"
              >
                {copiedType === 'p2' ? <Check size={11} /> : <Copy size={11} />}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace' }}>📞 T: {order.phoneTertiary || 'N/A'}</span>
            {order.phoneTertiary && (
              <button
                onClick={(e) => copyToClipboard(order.phoneTertiary!, 'p3', e)}
                style={{ background: 'none', border: 'none', color: copiedType === 'p3' ? '#10B981' : '#737373', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                title="Copy Tertiary Phone"
              >
                {copiedType === 'p3' ? <Check size={11} /> : <Copy size={11} />}
              </button>
            )}
          </div>
        </div>

        {/* Price & Billing */}
        <div style={{ borderTop: '1px solid #2D2D30', paddingTop: '8px', marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, color: '#A1A1AA' }}>Shipment Value:</span>
            <span style={{ fontWeight: 700, color: '#FAFAFA', fontSize: '11px' }}>₹{order.orderValue.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ color: '#8A8A8A' }}>Created By:</span>
            <span style={{ fontWeight: 500, color: '#FAFAFA' }}>{getUserDisplayName(order.createdBy)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ color: '#8A8A8A' }}>Payment Type:</span>
            <span 
              style={{ 
                fontSize: '9.5px', 
                fontWeight: 600, 
                padding: '1px 6px', 
                borderRadius: '4px',
                backgroundColor: order.paymentType === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: order.paymentType === 'Paid' ? '#10B981' : '#EF4444'
              }}
            >
              {order.paymentType}
            </span>
          </div>
          {order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', paddingLeft: '8px' }}>
                <span style={{ color: '#737373' }}>• Partially Paid:</span>
                <span style={{ color: '#10B981', fontWeight: 500 }}>₹{order.partiallyPaidAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '8px' }}>
                <span style={{ color: '#737373' }}>• Bal. Payable:</span>
                <span style={{ color: '#F59E0B', fontWeight: 500 }}>₹{order.finalPayableAmount?.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Address */}
        <div style={{ borderTop: '1px solid #2D2D30', paddingTop: '8px', marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, color: '#A1A1AA', display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              Delivery Address:
              <AddressRatingIndicator address={order.address} style={{ fontSize: '9px', padding: '1px 4px' }} />
            </span>
            <button
              onClick={(e) => copyToClipboard(fullAddress, 'addr', e)}
              style={{ background: 'none', border: 'none', color: copiedType === 'addr' ? '#10B981' : '#737373', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
              title="Copy Address"
            >
              {copiedType === 'addr' ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </div>
          <div style={{ color: '#D4D4D8', maxHeight: '50px', overflowY: 'auto', fontSize: '10.5px', wordBreak: 'break-word' }}>
            {fullAddress}
          </div>
        </div>
      </div>
    </div>
  );
};
