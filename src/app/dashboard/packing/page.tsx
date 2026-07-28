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
  Barcode,
  Calendar
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';
import { HealvitaShippingLabel } from '@/components/HealvitaShippingLabel';
import { CourierLogo } from '@/components/CourierLogo';
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter';
import { checkCourierServiceability } from '@/lib/utils';

export default function Packing() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'all',
    startDate: '',
    endDate: ''
  });
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
  const [bulkProgress, setBulkProgress] = useState({
    total: 0,
    current: 0,
    success: 0,
    failed: 0,
    activeOrder: '',
    completedList: [] as { orderId: string; success: boolean; message: string }[]
  });

  // Module 4: Bulk Logistics header dropdown filters
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [contactBindingFilter, setContactBindingFilter] = useState<string>('Primary');

  // Reschedule Modal States
  const [rescheduleOrder, setRescheduleOrder] = useState<Order | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleRemark, setRescheduleRemark] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
  }, []);

  useEffect(() => {
    fetchPackingQueue();
  }, [dateRange]);

  const fetchPackingQueue = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      let url = '/api/orders?limit=100';
      if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
      if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.orders) {
        const todayStr = new Date().toISOString().split('T')[0];
        const queue = (data.orders as Order[]).filter(o => {
          const isCorrectStatus = o.status === 'Created' || o.status === 'Packing' || o.status === 'Label Generated';
          if (!isCorrectStatus) return false;
          if (o.futureDeliveryDate && o.futureDeliveryDate > todayStr) return false;
          return true;
        });
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

    setBulkProgress({
      total: pendingAWB.length,
      current: 0,
      success: 0,
      failed: 0,
      activeOrder: '',
      completedList: []
    });
    setBulkProcessing(true);

    let currentIdx = 0;
    let successCount = 0;
    let failedCount = 0;
    const completedList: { orderId: string; success: boolean; message: string }[] = [];

    const CONCURRENCY_LIMIT = 4;

    const worker = async () => {
      while (currentIdx < pendingAWB.length) {
        const idx = currentIdx++;
        const order = pendingAWB[idx];
        if (!order) continue;

        setBulkProgress(prev => ({
          ...prev,
          activeOrder: order.orderId
        }));

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

          if (res.ok) {
            successCount++;
            completedList.push({
              orderId: order.orderId,
              success: true,
              message: `AWB generated successfully via ${selectedCourier}.`
            });
          } else {
            failedCount++;
            const data = await res.json().catch(() => ({}));
            completedList.push({
              orderId: order.orderId,
              success: false,
              message: data.error || `Transition error ${res.status}.`
            });
          }
        } catch (err: any) {
          failedCount++;
          completedList.push({
            orderId: order.orderId,
            success: false,
            message: err.message || 'Network connectivity error.'
          });
        }

        setBulkProgress(prev => ({
          ...prev,
          current: idx + 1,
          success: successCount,
          failed: failedCount,
          completedList: [...completedList]
        }));
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY_LIMIT, pendingAWB.length) },
      () => worker()
    );
    await Promise.all(workers);

    await new Promise(resolve => setTimeout(resolve, 800));
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
    setBulkProcessing(true);

    const dispatchable = orders.filter(o => selectedIds.includes(o.id) && o.status === 'Label Generated' && o.awb);
    if (dispatchable.length === 0) {
      alert('No selected orders are ready for dispatch (must be "Label Generated" with AWB).');
      setBulkProcessing(false);
      return;
    }

    let successCount = 0;
    for (const order of dispatchable) {
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
        if (res.ok) successCount++;
      } catch (err) {
        console.error(err);
      }
    }

    alert(`Bulk Dispatch complete. Successfully dispatched ${successCount} of ${dispatchable.length} packages.`);
    setBulkProcessing(false);
    fetchPackingQueue();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenReschedule = (order: Order) => {
    const activeCourier = courierOverrides[order.id] || order.courier || 'DTDC';
    setRescheduleOrder(order);
    
    // Set tomorrow as default date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRescheduleDate(tomorrow.toISOString().split('T')[0]);
    
    setRescheduleRemark(`Pincode ${order.pincode} is not serviceable with ${activeCourier}. Rescheduled order.`);
    setShowRescheduleModal(true);
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleOrder || !rescheduleDate || !rescheduleRemark) return;

    setRescheduleLoading(true);
    try {
      const res = await fetch(`/api/orders/${rescheduleOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          futureDeliveryDate: rescheduleDate,
          remarks: rescheduleRemark,
          updatedBy: currentUser?.username || 'packing_operator'
        })
      });

      if (res.ok) {
        setShowRescheduleModal(false);
        setRescheduleOrder(null);
        fetchPackingQueue();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reschedule order.');
      }
    } catch (err) {
      alert('Network error when rescheduling.');
    } finally {
      setRescheduleLoading(false);
    }
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

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button onClick={fetchPackingQueue} className="premium-btn premium-btn-secondary" disabled={loading || bulkProcessing}>
            <RefreshCcw size={14} />
            <span>Reload Queue</span>
          </button>
        </div>
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
                
                // Courier serviceability check
                const isServiceable = checkCourierServiceability(o.pincode, activeCourier);
                
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
                        Weight: {o.weight} kg | Pay: {isPartiallyPaid ? 'Partially Paid' : o.paymentType} {isPartiallyPaid && `(Paid ₹${o.partiallyPaidAmount}, Bal ₹${o.finalPayableAmount})`}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Courier Selection Dropdown */}
                        {o.status === 'Created' || o.status === 'Packing' ? (
                          <>
                            <select
                              className="premium-input"
                              style={{ padding: '4px 8px', fontSize: '11.5px', width: '100%', borderColor: !isServiceable ? '#EF4444' : 'var(--border)' }}
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
                            {!isServiceable && (
                              <span style={{ color: '#EF4444', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                ⚠️ Unserviceable with {activeCourier}
                              </span>
                            )}
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CourierLogo courier={o.courier} size={14} />
                          </div>
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
                        {/* Phase 1: Generated AWB Label or Reschedule */}
                        {!o.awb && (
                          isServiceable ? (
                            <button
                              onClick={() => handleGenerateLabel(o)}
                              className="premium-btn premium-btn-primary animate-fade-in"
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              disabled={isProcessing}
                            >
                              {isProcessing ? <span className="spinner spinner-sm" /> : <Tag size={12} />}
                              <span>{isProcessing ? 'Generating...' : 'Generate AWB'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenReschedule(o)}
                              className="premium-btn animate-fade-in"
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '12px', 
                                borderColor: '#EF4444', 
                                color: '#EF4444', 
                                backgroundColor: 'rgba(239, 68, 68, 0.05)', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px' 
                              }}
                              disabled={isProcessing}
                            >
                              <Calendar size={12} />
                              <span>Reschedule</span>
                            </button>
                          )
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
                    className="thermal-shipping-label"
                    style={{ 
                      width: '4in', // matches target dimensions closely (4in)
                      backgroundColor: '#FFFFFF',
                      pageBreakAfter: 'always',
                      marginBottom: idx < printingOrders.length - 1 ? '20px' : '0'
                    }}
                  >
                    <HealvitaShippingLabel order={order} phoneSelection={phoneSelections[order.id]} />
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
                onClick={handlePrint} 
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

      {/* Fullscreen Bulk Processing Progress Modal */}
      {bulkProcessing && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(5, 5, 8, 0.92)',
            backdropFilter: 'blur(16px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FAFAFA',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#0E0E11',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Glowing radial gradient backdrop */}
            <div 
              style={{
                position: 'absolute',
                top: '-20%',
                left: '-20%',
                width: '140%',
                height: '140%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 60%)',
                pointerEvents: 'none',
                zIndex: 0
              }}
            />

            {/* Circular Progress Section */}
            <div style={{ position: 'relative', width: '130px', height: '130px', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                <circle 
                  cx="65" 
                  cy="65" 
                  r="54" 
                  stroke="rgba(255, 255, 255, 0.03)" 
                  strokeWidth="8" 
                  fill="transparent" 
                />
                <circle 
                  cx="65" 
                  cy="65" 
                  r="54" 
                  stroke="#10B981" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray="339.29"
                  strokeDashoffset={339.29 - (339.29 * (bulkProgress.current / (bulkProgress.total || 1)))}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </svg>
              <div 
                style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#FAFAFA', letterSpacing: '-0.5px' }}>
                  {Math.round((bulkProgress.current / (bulkProgress.total || 1)) * 100)}%
                </span>
                <span style={{ fontSize: '10.5px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                  Complete
                </span>
              </div>
            </div>

            {/* Heading Details */}
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#FAFAFA' }}>
                Generating Bulk AWB Labels
              </h3>
              <p style={{ fontSize: '13px', color: '#8A8A8A', margin: '6px 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {bulkProgress.activeOrder ? (
                  <>
                    <span>Processing:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10B981' }}>{bulkProgress.activeOrder}</span>
                  </>
                ) : (
                  <span>Preparing pipeline...</span>
                )}
              </p>
            </div>

            {/* Processing Stats Cards */}
            <div 
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                zIndex: 1
              }}
            >
              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px 8px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#737373', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queue</span>
                <span style={{ fontSize: '18px', fontWeight: 750, color: '#FAFAFA', marginTop: '4px', display: 'block' }}>
                  {bulkProgress.current} / {bulkProgress.total}
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.02)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '12px 8px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#10B981', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success</span>
                <span style={{ fontSize: '18px', fontWeight: 750, color: '#10B981', marginTop: '4px', display: 'block' }}>
                  {bulkProgress.success}
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '10px', padding: '12px 8px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#EF4444', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed</span>
                <span style={{ fontSize: '18px', fontWeight: 750, color: '#EF4444', marginTop: '4px', display: 'block' }}>
                  {bulkProgress.failed}
                </span>
              </div>
            </div>

            {/* Time Remaining Counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#A1A1AA', zIndex: 1 }}>
              <span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.2) rgba(255,255,255,0.2) #10B981 #10B981' }} />
              <span>
                {bulkProgress.current === bulkProgress.total ? (
                  'Wrapping up...'
                ) : (
                  <>
                    Estimated time remaining:{' '}
                    <strong style={{ color: '#FAFAFA' }}>
                      {Math.max(0, Math.ceil(((bulkProgress.total - bulkProgress.current) * 1.5) / 4))}s
                    </strong>
                  </>
                )}
              </span>
            </div>

            {/* Console Log Log Output */}
            <div 
              style={{
                width: '100%',
                height: '140px',
                backgroundColor: '#050507',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '10px',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '11px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                zIndex: 1,
                scrollBehavior: 'smooth'
              }}
              ref={(el) => {
                if (el) el.scrollTop = el.scrollHeight;
              }}
            >
              {bulkProgress.completedList.length === 0 ? (
                <div style={{ color: '#55555A' }}>&gt;_ Awaiting dispatcher signals...</div>
              ) : (
                bulkProgress.completedList.map((logItem, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', lineHeight: '1.4' }}>
                    <span style={{ color: logItem.success ? '#10B981' : '#EF4444', fontWeight: 'bold' }}>
                      {logItem.success ? '✓' : '✗'}
                    </span>
                    <span style={{ color: '#88888D' }}>[{logItem.orderId}]</span>
                    <span style={{ color: logItem.success ? '#E4E4E7' : '#EF6868' }}>{logItem.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reschedule Order (Unserviceable Pincode) */}
      {showRescheduleModal && rescheduleOrder && (
        <div className="premium-modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="premium-modal" style={{ maxWidth: '520px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Reschedule Order: {rescheduleOrder.orderId}</h3>
              <button onClick={() => { setShowRescheduleModal(false); setRescheduleOrder(null); }} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleConfirmReschedule} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Selected Reschedule Date *</label>
                <input
                  type="date"
                  className="premium-input"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Reschedule Reason / Remark *</label>
                <textarea
                  className="premium-input"
                  placeholder="Enter details explaining why this order is rescheduled..."
                  value={rescheduleRemark}
                  onChange={(e) => setRescheduleRemark(e.target.value)}
                  style={{ minHeight: '80px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowRescheduleModal(false); setRescheduleOrder(null); }} className="premium-btn premium-btn-secondary">Close</button>
                <button type="submit" className="premium-btn premium-btn-primary" disabled={rescheduleLoading}>
                  {rescheduleLoading ? 'Scheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
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
