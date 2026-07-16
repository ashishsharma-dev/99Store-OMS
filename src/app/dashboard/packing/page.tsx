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
import { ShippingLabel } from '@/components/ShippingLabel';

export default function Packing() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Printing label popup state (can print single or multiple)
  const [printingOrders, setPrintingOrders] = useState<Order[]>([]);
  const [showPrintLabel, setShowPrintLabel] = useState(false);

  // Selected courier overrides for each order during packing
  const [courierOverrides, setCourierOverrides] = useState<Record<string, 'DTDC' | 'XpressBees' | 'Delhivery' | 'Aggregator' | 'Velocity'>>({});
  
  // Primary phone selection override if customer has multiple phone numbers
  const [phoneSelections, setPhoneSelections] = useState<Record<string, string>>({});
  
  // Selection states for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, activeTask: '', currentOrder: '' });

  // Module 4: Bulk Logistics header dropdown filters
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [contactBindingFilter, setContactBindingFilter] = useState<string>('Primary');

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
    fetchPackingQueue();
  }, []);

  const fetchPackingQueue = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const res = await fetch('/api/orders?limit=100');
      const data = await res.json();
      if (res.ok && data.orders) {
        // Only show orders in 'Created', 'Packing' or 'Label Generated' states
        const queue = (data.orders as Order[]).filter(o => 
          o.status === 'Created' || o.status === 'Packing' || o.status === 'Label Generated'
        );
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

  const handlePhoneSelectChange = (orderId: string, phoneNumber: string) => {
    setPhoneSelections(prev => ({ ...prev, [orderId]: phoneNumber }));
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const filteredOrders = orders.filter(o => {
    if (courierFilter === 'all') return true;
    const c = courierOverrides[o.id] || o.courier || 'DTDC';
    return c.toLowerCase().includes(courierFilter.toLowerCase());
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map(o => o.id));
    }
  };

  // Generate AWB for single order
  const handleGenerateLabel = async (order: Order) => {
    setProcessingOrderId(order.id);
    const selectedCourier = courierOverrides[order.id] || order.courier || 'DTDC';
    const targetPhone = phoneSelections[order.id] || order.phonePrimary;

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Label Generated',
          courier: selectedCourier,
          phonePrimary: targetPhone,
          updatedBy: currentUser?.username || 'packing_operator',
          remarks: `Packed items verified. Routing via ${selectedCourier} courier with shipping number ${targetPhone}.`
        })
      });

      const data = await res.json();
      setProcessingOrderId(null);

      if (res.ok) {
        fetchPackingQueue();
      } else {
        alert(data.error || 'Failed to generate AWB label.');
      }
    } catch (err) {
      setProcessingOrderId(null);
      alert('API Communication network error.');
    }
  };

  // Dispatch single order
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

  // BULK ACTIONS
  const handleBulkGenerateLabels = async () => {
    if (selectedIds.length === 0) return;

    const pendingAWB = orders.filter(o => selectedIds.includes(o.id) && !o.awb);
    if (pendingAWB.length === 0) {
      alert('No selected orders require AWB generation.');
      return;
    }

    setBulkProgress({ current: 0, total: pendingAWB.length, activeTask: 'Generating Bulk AWB Labels', currentOrder: '' });
    setBulkProcessing(true);

    let successCount = 0;
    const batchSize = 5;

    for (let i = 0; i < pendingAWB.length; i += batchSize) {
      const chunk = pendingAWB.slice(i, i + batchSize);
      
      setBulkProgress(prev => ({
        ...prev,
        current: i,
        currentOrder: chunk.map(o => o.orderId).join(', ')
      }));

      const results = await Promise.all(
        chunk.map(async (order) => {
          const selectedCourier = courierOverrides[order.id] || order.courier || 'DTDC';
          const targetPhone = phoneSelections[order.id] || order.phonePrimary;

          try {
            const res = await fetch(`/api/orders/${order.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'Label Generated',
                courier: selectedCourier,
                phonePrimary: targetPhone,
                updatedBy: currentUser?.username || 'packing_operator',
                remarks: `Bulk Packed items verified. Routing via ${selectedCourier} with phone ${targetPhone}.`
              })
            });
            return res.ok;
          } catch (err) {
            console.error(err);
            return false;
          }
        })
      );

      successCount += results.filter(Boolean).length;
    }

    setBulkProgress(prev => ({ ...prev, current: pendingAWB.length }));
    await new Promise(r => setTimeout(r, 600));

    alert(`Bulk AWB Generation complete. Successfully generated ${successCount} of ${pendingAWB.length} labels.`);
    setBulkProcessing(false);
    fetchPackingQueue();
  };

  const handleBulkPrintLabels = () => {
    const selectedOrders = orders.filter(o => selectedIds.includes(o.id) && o.awb);
    if (selectedOrders.length === 0) {
      alert('Please select orders that have generated AWB numbers to print shipping labels.');
      return;
    }
    setPrintingOrders(selectedOrders);
    setShowPrintLabel(true);
  };

  const handleBulkDispatch = async () => {
    if (selectedIds.length === 0) return;

    const dispatchable = orders.filter(o => selectedIds.includes(o.id) && o.status === 'Label Generated' && o.awb);
    if (dispatchable.length === 0) {
      alert('No selected orders are ready for dispatch (must be "Label Generated" with AWB).');
      return;
    }

    setBulkProgress({ current: 0, total: dispatchable.length, activeTask: 'Dispatching Bulk Packages', currentOrder: '' });
    setBulkProcessing(true);

    let successCount = 0;
    const batchSize = 5;

    for (let i = 0; i < dispatchable.length; i += batchSize) {
      const chunk = dispatchable.slice(i, i + batchSize);
      
      setBulkProgress(prev => ({
        ...prev,
        current: i,
        currentOrder: chunk.map(o => `${o.orderId} (${o.awb})`).join(', ')
      }));

      const results = await Promise.all(
        chunk.map(async (order) => {
          try {
            const res = await fetch(`/api/orders/${order.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'Dispatched',
                updatedBy: currentUser?.username || 'packing_operator',
                remarks: `Bulk Dispatch: Package marked as Dispatched with AWB ${order.awb}.`
              })
            });
            return res.ok;
          } catch (err) {
            console.error(err);
            return false;
          }
        })
      );

      successCount += results.filter(Boolean).length;
    }

    setBulkProgress(prev => ({ ...prev, current: dispatchable.length }));
    await new Promise(r => setTimeout(r, 600));

    alert(`Bulk Dispatch complete. Successfully dispatched ${successCount} of ${dispatchable.length} packages.`);
    setBulkProcessing(false);
    fetchPackingQueue();
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
            Verify products, assign logistics providers, select contact numbers, print monochrome thermal invoices, and dispatch packages.
          </p>
        </div>

        <button onClick={fetchPackingQueue} className="premium-btn premium-btn-secondary" disabled={loading || bulkProcessing}>
          <RefreshCcw size={14} />
          <span>Reload Queue</span>
        </button>
      </div>

      {/* Queue Counter Dashboard banner & Module 4 Bulk Header Filters */}
      <div className="premium-card" style={{ padding: '16px 24px', display: 'flex', gap: '24px', alignItems: 'center', backgroundColor: '#0F0F11', borderStyle: 'dashed', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package size={20} style={{ color: '#3B82F6' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#FAFAFA' }}>
            Packing Department Load:
          </span>
        </div>
        <div style={{ fontSize: '14px', color: '#8A8A8A', flex: 1, minWidth: '240px' }}>
          <strong>{orders.filter(o => o.status === 'Created').length}</strong> New Orders | <strong>{orders.filter(o => o.status === 'Packing').length}</strong> Currently Packing | <strong>{orders.filter(o => o.status === 'Label Generated').length}</strong> Ready to Dispatch
        </div>

        {/* Module 4: Header Dropdown Filters */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#737373', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Courier Partner Filter</span>
            <select
              className="premium-input"
              style={{ padding: '4px 8px', fontSize: '12px', borderColor: '#3B82F6' }}
              value={courierFilter}
              onChange={(e) => setCourierFilter(e.target.value)}
            >
              <option value="all">All Carrier Partners</option>
              <option value="DTDC">DTDC Express</option>
              <option value="XpressBees">XpressBees Logistics</option>
              <option value="Delhivery">Delhivery Express</option>
              <option value="Aggregator">Aggregator API</option>
              <option value="Velocity">Velocity Aggregator</option>
            </select>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#737373', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Pickup Contact Binding</span>
            <select
              className="premium-input"
              style={{ padding: '4px 8px', fontSize: '12px', borderColor: '#F59E0B' }}
              value={contactBindingFilter}
              onChange={(e) => setContactBindingFilter(e.target.value)}
            >
              <option value="Primary">Primary Store Contact</option>
              <option value="Secondary">Secondary Fulfillment Hub</option>
              <option value="Tertiary">CUSTOMER_NUMBER (Masked Coordination)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedIds.length > 0 && (
        <div className="premium-card animate-fade-in" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111113', borderColor: '#3B82F6' }}>
          <span style={{ fontSize: '13.5px', color: '#FAFAFA', fontWeight: 600 }}>
            Selected {selectedIds.length} of {filteredOrders.length} orders
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleBulkGenerateLabels} 
              className="premium-btn premium-btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12.5px', borderColor: '#3B82F6', color: '#3B82F6' }}
              disabled={bulkProcessing}
            >
              Bulk Generate AWB
            </button>
            <button 
              onClick={handleBulkPrintLabels} 
              className="premium-btn premium-btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12.5px', borderColor: '#F59E0B', color: '#F59E0B' }}
              disabled={bulkProcessing}
            >
              Bulk Print Labels (4x6)
            </button>
            <button 
              onClick={handleBulkDispatch} 
              className="premium-btn premium-btn-primary" 
              style={{ padding: '6px 12px', fontSize: '12.5px', backgroundColor: '#10B981', borderColor: '#10B981' }}
              disabled={bulkProcessing}
            >
              Bulk Dispatch Packages
            </button>
          </div>
        </div>
      )}

      {/* Main Packing Table */}
      {loading ? (
        <div className="premium-card loading-overlay" style={{ minHeight: '200px' }}>
          <span className="spinner spinner-lg spinner-accent" />
          <span>Retrieving packaging queue...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
          No packages pending in the packaging queue for this selection. Good job! All orders are dispatched.
        </div>
      ) : (
        <div className="premium-table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th style={{ width: '40px', paddingLeft: '16px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0} 
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
                <th>Order ID</th>
                <th>Customer details</th>
                <th>Product Weight</th>
                <th>Courier & Primary Phone</th>
                <th>Fulfillment State</th>
                <th style={{ textAlign: 'right' }}>Operations Control</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const isProcessing = processingOrderId === o.id || bulkProcessing;
                const activeCourier = courierOverrides[o.id] || o.courier || 'DTDC';
                const hasMultiplePhones = o.phoneSecondary || o.phoneTertiary;
                const activePhone = phoneSelections[o.id] || o.phonePrimary;

                // Color highlights for partially paid amount
                const isPartiallyPaid = o.partiallyPaidAmount !== undefined && o.partiallyPaidAmount > 0;
                
                return (
                  <tr 
                    key={o.id}
                    style={{
                      borderLeft: isPartiallyPaid ? '3px solid #10B981' : 'none',
                      backgroundColor: isPartiallyPaid ? 'rgba(16,185,129,0.08)' : 'transparent'
                    }}
                  >
                    <td style={{ paddingLeft: '16px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(o.id)} 
                        onChange={() => handleSelectOrder(o.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
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
                      <span style={{ fontSize: '11px', color: '#737373' }}>
                        Weight: {o.weight} kg | Pay: {o.paymentType} {isPartiallyPaid && `(Paid ₹${o.partiallyPaidAmount}, Bal ₹${o.finalPayableAmount})`}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Courier Selection Dropdown */}
                        {o.status === 'Created' || o.status === 'Packing' ? (
                          <select
                            className="premium-input"
                            style={{ padding: '4px 8px', fontSize: '11.5px', width: '100%' }}
                            value={activeCourier}
                            onChange={(e) => handleCourierSelectChange(o.id, e.target.value as any)}
                            disabled={isProcessing}
                          >
                            <option value="DTDC">DTDC (Priority 1)</option>
                            <option value="XpressBees Air">XpressBees Air</option>
                            <option value="XpressBees Surface">XpressBees Surface</option>
                            <option value="Delhivery">Delhivery (Priority 3)</option>
                            <option value="Aggregator">Aggregator API</option>
                            <option value="Velocity">Velocity Aggregator</option>
                          </select>
                        ) : (
                          <span style={{ fontWeight: 500, fontSize: '12px' }}>{o.courier}</span>
                        )}

                        {/* Phone selection dropdown if multiple are available */}
                        {hasMultiplePhones && !o.awb ? (
                          <div>
                            <span style={{ fontSize: '9px', color: '#737373', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Select Contact:</span>
                            <select
                              className="premium-input"
                              style={{ padding: '2px 6px', fontSize: '11px', width: '100%', borderColor: '#F59E0B' }}
                              value={activePhone}
                              onChange={(e) => handlePhoneSelectChange(o.id, e.target.value)}
                              disabled={isProcessing}
                            >
                              <option value={o.phonePrimary}>{o.phonePrimary} (Prim)</option>
                              {o.phoneSecondary && <option value={o.phoneSecondary}>{o.phoneSecondary} (Sec)</option>}
                              {o.phoneTertiary && <option value={o.phoneTertiary}>CUSTOMER_NUMBER (Tert)</option>}
                            </select>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#8A8A8A', fontFamily: 'monospace' }}>
                            {activePhone === o.phoneTertiary ? 'CUSTOMER_NUMBER' : activePhone}
                          </span>
                        )}
                      </div>
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
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            disabled={isProcessing}
                          >
                            {isProcessing ? <span className="spinner spinner-sm" /> : <Tag size={12} />}
                            <span>{isProcessing ? 'Generating...' : 'Generate AWB'}</span>
                          </button>
                        )}

                        {/* Phase 2: AWB Generated, ready to Print Shipping Label & Dispatch */}
                        {o.awb && (
                          <>
                            <button
                              onClick={() => {
                                setPrintingOrders([o]);
                                setShowPrintLabel(true);
                              }}
                              className="premium-btn premium-btn-secondary animate-fade-in"
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              disabled={isProcessing}
                            >
                              <Printer size={12} />
                              <span>Print Label</span>
                            </button>

                            <button
                              onClick={() => handleDispatch(o)}
                              className="premium-btn premium-btn-primary animate-fade-in"
                              style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#10B981', borderColor: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              disabled={isProcessing}
                            >
                              {isProcessing ? <span className="spinner spinner-sm" /> : <Send size={12} />}
                              <span>Dispatch</span>
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

      {/* Shipping Label CSS Printing Modal - Configured for 4x6 inch format */}
      {showPrintLabel && printingOrders.length > 0 && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Header info */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', color: '#FAFAFA' }}>
                Print queue: {printingOrders.length} Shipping Labels (4 x 6 in)
              </h3>
              <button onClick={() => setShowPrintLabel(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            {/* Scrollable preview wrapper */}
            <div style={{ backgroundColor: '#1A1A1E', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              
              {/* Outer Printable boundary */}
              <div id="printable-labels-boundary">
                {printingOrders.map((order, idx) => (
                  <div 
                    key={order.id} 
                    style={{ 
                      marginBottom: idx < printingOrders.length - 1 ? '20px' : '0' // spacing only in dashboard preview
                    }}
                  >
                    <ShippingLabel order={order} phoneOverride={phoneSelections[order.id]} />
                  </div>
                ))}
              </div>
            </div>

            {/* Print operations bar */}
            <div style={{ padding: '16px 24px', backgroundColor: '#F4F4F5', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowPrintLabel(false)} 
                className="premium-btn premium-btn-secondary" 
                style={{ color: '#000', borderColor: '#000', padding: '6px 12px' }}
              >
                Close Queue
              </button>
              
              <button 
                onClick={handleSimulatePrint} 
                className="premium-btn premium-btn-primary" 
                style={{ backgroundColor: '#000', color: '#FFF', border: 'none', padding: '6px 12px' }}
              >
                <Printer size={14} />
                <span>Print thermal labels (4x6 in)</span>
              </button>
            </div>

          </div>
        </div>
      )}
      {bulkProcessing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }}>
            {/* Spinning Indicator */}
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '4px solid rgba(255, 255, 255, 0.05)',
                borderTopColor: '#E53E3E'
              }} className="animate-spin-custom" />
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--foreground)'
              }}>
                {bulkProgress.total > 0 ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0}%
              </div>
            </div>

            {/* Task Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>
                {bulkProgress.activeTask}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: 0 }}>
                Processing {bulkProgress.current} of {bulkProgress.total} orders...
              </p>
              {bulkProgress.currentOrder && (
                <div style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#E53E3E',
                  backgroundColor: 'rgba(229, 62, 62, 0.05)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  marginTop: '4px',
                  display: 'inline-block'
                }}>
                  Current: {bulkProgress.currentOrder}
                </div>
              )}
            </div>

            {/* Progress Bar Track */}
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '3px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                height: '100%',
                width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%`,
                backgroundColor: '#E53E3E',
                transition: 'width 0.3s ease',
                borderRadius: '3px'
              }} />
            </div>

            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
              Please do not close this tab or refresh the page.
            </span>
          </div>

          <style dangerouslySetInnerHTML={{__html: `
            .animate-spin-custom {
              animation: spin-custom 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
            }
            @keyframes spin-custom {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}} />
        </div>
      )}

      {/* Thermal printing css styles overrides */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-labels-boundary, 
          #printable-labels-boundary * {
            visibility: visible;
          }
          #printable-labels-boundary {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .thermal-shipping-label {
            margin-bottom: 0 !important;
            border: none !important;
            width: 4in !important;
            height: 6in !important;
            page-break-after: always !important;
          }
          @page {
            size: 4in 6in;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
