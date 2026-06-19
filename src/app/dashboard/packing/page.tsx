'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Printer, 
  Send, 
  Tag, 
  Check, 
  RefreshCcw, 
  ArrowRight,
  Barcode
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';

export default function Packing() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Printing label popup state
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [showPrintLabel, setShowPrintLabel] = useState(false);

  // Selected courier overrides for each order during packing
  const [courierOverrides, setCourierOverrides] = useState<Record<string, 'DTDC' | 'XpressBees' | 'Delhivery' | 'Aggregator'>>({});
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
    fetchPackingQueue();
  }, []);

  const fetchPackingQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?limit=100');
      const data = await res.json();
      if (res.ok && data.orders) {
        // Only show orders in 'Created', 'Packing' or 'Label Generated' states
        const queue = (data.orders as Order[]).filter(o => o.status === 'Created' || o.status === 'Packing' || o.status === 'Label Generated');
        setOrders(queue);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleCourierSelectChange = (orderId: string, courier: any) => {
    setCourierOverrides(prev => ({ ...prev, [orderId]: courier }));
  };

  const handleGenerateLabel = async (order: Order) => {
    setProcessingOrderId(order.id);
    const selectedCourier = courierOverrides[order.id] || order.courier || 'DTDC';

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Label Generated',
          courier: selectedCourier,
          updatedBy: currentUser?.username || 'packing_operator',
          remarks: `Packed items verified. Manually routing via ${selectedCourier} courier.`
        })
      });

      const data = await res.json();
      setProcessingOrderId(null);

      if (res.ok) {
        // Refresh queue
        fetchPackingQueue();
      } else {
        alert(data.error || 'Failed to generate AWB label.');
      }
    } catch (err) {
      setProcessingOrderId(null);
      alert('API Communication network error.');
    }
  };

  const handlePrintLabel = (order: Order) => {
    setPrintingOrder(order);
    setShowPrintLabel(true);
  };

  const handleDispatch = async (order: Order) => {
    if (!order.awb) {
      alert('AWB is required to dispatch package.');
      return;
    }
    
    setProcessingOrderId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Dispatched',
          updatedBy: currentUser?.username || 'packing_operator',
          remarks: `Package labeled with AWB ${order.awb}. Handed over to logistics pickup driver.`
        })
      });

      setProcessingOrderId(null);
      if (res.ok) {
        fetchPackingQueue();
      }
    } catch (err) {
      setProcessingOrderId(null);
      alert('Dispatch API network error.');
    }
  };

  const handleSimulatePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>Packaging & Label Queue</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Verify products, assign logistics providers, print monochrome shipping invoices, and dispatch packages.
          </p>
        </div>

        <button onClick={fetchPackingQueue} className="premium-btn premium-btn-secondary">
          <RefreshCcw size={14} />
          <span>Reload Queue</span>
        </button>
      </div>

      {/* Queue Counter Dashboard banner */}
      <div className="premium-card" style={{ padding: '16px 24px', display: 'flex', gap: '24px', alignItems: 'center', backgroundColor: '#0F0F11', borderStyle: 'dashed' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package size={20} style={{ color: '#3B82F6' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#FAFAFA' }}>
            Packing Department Load:
          </span>
        </div>
        <div style={{ fontSize: '14px', color: '#8A8A8A' }}>
          <strong>{orders.filter(o => o.status === 'Created').length}</strong> New Orders | <strong>{orders.filter(o => o.status === 'Packing').length}</strong> Currently Packing
        </div>
      </div>

      {/* Main Packing Table */}
      {loading ? (
        <div style={{ color: '#737373', fontSize: '14px' }}>Retrieving packing tasks...</div>
      ) : orders.length === 0 ? (
        <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
          No packages pending in the packaging queue. Good job! All orders are dispatched.
        </div>
      ) : (
        <div className="premium-table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer details</th>
                <th>Product Weight</th>
                <th>Courier Option</th>
                <th>Fulfillment State</th>
                <th style={{ textAlign: 'right' }}>Operations Control</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const isProcessing = processingOrderId === o.id;
                const activeCourier = courierOverrides[o.id] || o.courier || 'DTDC';
                
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{o.orderId}</span>
                        {o.isVip && <span style={{ color: 'var(--color-vip)' }}>⭐</span>}
                      </div>
                      <span style={{ fontSize: '11px', color: '#737373', fontWeight: 'normal' }}>{o.createdAt.split('T')[0]}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                      <div style={{ fontSize: '11.5px', color: '#737373' }}>{o.pincode} | {o.area}, {o.state}</div>
                    </td>
                    <td>
                      <div>{o.productDetails}</div>
                      <span style={{ fontSize: '11px', color: '#737373' }}>Weight: {o.weight} kg | Pay: {o.paymentType}</span>
                    </td>
                    <td>
                      {/* Courier Selection Dropdown */}
                      {o.status === 'Created' || o.status === 'Packing' ? (
                        <select
                          className="premium-input"
                          style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}
                          value={activeCourier}
                          onChange={(e) => handleCourierSelectChange(o.id, e.target.value as any)}
                          disabled={isProcessing}
                        >
                          <option value="DTDC">DTDC (Priority 1)</option>
                          <option value="XpressBees">XpressBees (Priority 2)</option>
                          <option value="Delhivery">Delhivery (Priority 3)</option>
                          <option value="Aggregator">Aggregator API</option>
                        </select>
                      ) : (
                        <span style={{ fontWeight: 500 }}>{o.courier}</span>
                      )}
                    </td>
                    <td>
                      <span className={`premium-badge status-${o.status.toLowerCase().replace(' ', '')}`}>
                        {o.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {/* Phase 1: Generated AWB Label */}
                        {!o.awb && (
                          <button
                            onClick={() => handleGenerateLabel(o)}
                            className="premium-btn premium-btn-primary animate-fade-in"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            disabled={isProcessing}
                          >
                            <Tag size={12} />
                            <span>{isProcessing ? 'Generating AWB...' : 'Generate AWB'}</span>
                          </button>
                        )}

                        {/* Phase 2: AWB Generated, ready to Print Shipping Label & Dispatch */}
                        {o.awb && (
                          <>
                            <button
                              onClick={() => handlePrintLabel(o)}
                              className="premium-btn premium-btn-secondary animate-fade-in"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              disabled={isProcessing}
                            >
                              <Printer size={12} />
                              <span>Print Label</span>
                            </button>

                            <button
                              onClick={() => handleDispatch(o)}
                              className="premium-btn premium-btn-primary animate-fade-in"
                              style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#10B981', borderColor: '#10B981' }}
                              disabled={isProcessing}
                            >
                              <Send size={12} />
                              <span>Dispatch pkg</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SHipping Label CSS Printing Mock Modal */}
      {showPrintLabel && printingOrder && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '480px', backgroundColor: '#FFFFFF', color: '#000000', border: '2px solid #000000' }}>
            {/* Real Visual Shipping Invoice Label Card */}
            <div id="printable-shipping-label" style={{ padding: '24px', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Header Box */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000000', paddingBottom: '12px', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>99STORE</h2>
                  <span style={{ fontSize: '10px' }}>LOGISTICS CENTER</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', border: '2px solid #000000', padding: '2px 8px', textTransform: 'uppercase' }}>
                    {printingOrder.paymentType}
                  </div>
                  {printingOrder.isVip && <span style={{ fontSize: '11px', fontWeight: 'bold' }}>⭐ VIP SHIPMENT</span>}
                </div>
              </div>

              {/* Courier and AWB Box */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', borderBottom: '2px solid #000000', paddingBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '9px', display: 'block', color: '#555' }}>COURIER:</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{printingOrder.courier || 'DTDC'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '9px', display: 'block', color: '#555' }}>AWB NUMBER:</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{printingOrder.awb || 'N/A'}</span>
                </div>
              </div>

              {/* Barcode Mock */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', borderBottom: '2px solid #000000', paddingBottom: '14px', paddingTop: '4px' }}>
                <Barcode size={44} style={{ color: '#000000' }} />
                {/* Visual pure-CSS barcode mock lines */}
                <div style={{ width: '100%', height: '36px', display: 'flex', gap: '2px', backgroundColor: '#FFFFFF', padding: '0 10px', boxSizing: 'border-box' }}>
                  {Array.from({ length: 42 }).map((_, i) => {
                    const barWidths = [1, 2, 3, 1, 4, 2, 1, 3];
                    const w = barWidths[i % barWidths.length];
                    return (
                      <div key={i} style={{ flexGrow: w, height: '100%', backgroundColor: i % 3 === 0 ? '#FFFFFF' : '#000000' }} />
                    );
                  })}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.1em' }}>*{printingOrder.awb}*</span>
              </div>

              {/* Address Recipient Box */}
              <div style={{ borderBottom: '2px solid #000000', paddingBottom: '12px', fontSize: '12px' }}>
                <span style={{ fontSize: '9px', display: 'block', color: '#555', marginBottom: '4px' }}>DELIVER TO:</span>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{printingOrder.customerName}</div>
                <div style={{ lineHeight: '1.4', marginBottom: '6px' }}>{printingOrder.address}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>PINCODE: {printingOrder.pincode}</span>
                  <span>TEL: {printingOrder.phonePrimary}</span>
                </div>
              </div>

              {/* Product and billing Box */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', fontSize: '12px' }}>
                <div>
                  <span style={{ fontSize: '9px', display: 'block', color: '#555' }}>PRODUCT DETAILS:</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{printingOrder.productDetails}</span>
                  <span style={{ display: 'block', fontSize: '10px', marginTop: '2px' }}>Weight: {printingOrder.weight} kg</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '9px', display: 'block', color: '#555' }}>COLLECT AMOUNT:</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {printingOrder.paymentType === 'COD' ? `₹${printingOrder.orderValue.toFixed(2)}` : '₹0.00 (PAID)'}
                  </span>
                </div>
              </div>

            </div>

            {/* Print operations bar */}
            <div style={{ padding: '16px', backgroundColor: '#F4F4F5', borderTop: '2px solid #000000', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowPrintLabel(false)} 
                className="premium-btn premium-btn-secondary" 
                style={{ color: '#000', borderColor: '#000', padding: '6px 12px' }}
              >
                Close Print Queue
              </button>
              
              <button 
                onClick={handleSimulatePrint} 
                className="premium-btn premium-btn-primary" 
                style={{ backgroundColor: '#000', color: '#FFF', border: 'none', padding: '6px 12px' }}
              >
                <Printer size={14} />
                <span>Simulate Print API</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
