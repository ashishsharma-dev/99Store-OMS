'use client';

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  MapPin, 
  ChevronRight, 
  RefreshCcw,
  CheckCircle,
  AlertTriangle,
  ArrowLeftRight,
  User,
  Clock,
  ExternalLink,
  Printer,
  Barcode
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';
import { HealvitaShippingLabel } from '@/components/HealvitaShippingLabel';
import { CourierLogo } from '@/components/CourierLogo';
import { AddressRatingIndicator } from '@/components/AddressRatingIndicator';
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter';
import { getUserDisplayName } from '@/lib/utils';

export default function Tracking() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'all',
    startDate: '',
    endDate: ''
  });
  const [syncLoading, setSyncLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Selected Order for detailing and logistics control
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showControlDrawer, setShowControlDrawer] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Printing label popup state
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [showPrintLabel, setShowPrintLabel] = useState(false);
  
  // NDR Mock Reasons
  const [ndrReason, setNdrReason] = useState('Customer Phone Unreachable / Switched Off');
  const [showNdrReasonSelect, setShowNdrReasonSelect] = useState(false);

  // User session
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Live Delhivery API tracking state
  const [liveTrackingData, setLiveTrackingData] = useState<any>(null);
  const [liveTrackingLoading, setLiveTrackingLoading] = useState(false);
  const [liveTrackingError, setLiveTrackingError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOrder && (selectedOrder.courier === 'Delhivery' || selectedOrder.courier === 'XpressBees' || selectedOrder.courier === 'DTDC') && selectedOrder.awb) {
      fetchLiveTracking(selectedOrder.awb, selectedOrder.courier);
    } else {
      setLiveTrackingData(null);
      setLiveTrackingError(null);
    }
  }, [selectedOrder]);

  const fetchLiveTracking = async (awb: string, courierName?: string) => {
    setLiveTrackingLoading(true);
    setLiveTrackingError(null);
    try {
      const courierParam = courierName ? `&courier=${courierName}` : '';
      const res = await fetch(`/api/integrations/courier?action=track&waybill=${awb}${courierParam}`);
      const data = await res.json();
      if (res.ok) {
        setLiveTrackingData(data);
      } else {
        setLiveTrackingError(data.error || 'Failed to fetch live tracking.');
      }
    } catch (err) {
      setLiveTrackingError('Failed to communicate with live tracking API.');
    } finally {
      setLiveTrackingLoading(false);
    }
  };

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
  }, []);

  useEffect(() => {
    fetchActiveShipments();
  }, [dateRange]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveShipments(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const fetchActiveShipments = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      let url = '/api/orders?limit=100';
      if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
      if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.orders) {
        // Show only active shipments that have been generated labels/dispatched
        const shipments = (data.orders as Order[]).filter(o => 
          ['Label Generated', 'Dispatched', 'OFD', 'Delivered', 'Undelivered', 'Return', 'RDC', 'NDR'].includes(o.status)
        );
        setOrders(shipments);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleBulkSync = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('/api/integrations/courier/sync', {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Sync Complete!\nChecked: ${data.totalChecked} packages\nUpdated: ${data.totalUpdated} statuses`);
        // Refresh local orders
        await fetchActiveShipments();

        // If the selected order is active, reload it to reflect changes
        if (selectedOrder) {
          const freshRes = await fetch(`/api/orders/${selectedOrder.id}`);
          const freshData = await freshRes.json();
          if (freshRes.ok && freshData.success && freshData.order) {
            setSelectedOrder(freshData.order);
          }
        }
      } else {
        alert(data.error || 'Failed to sync courier statuses.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error when syncing courier statuses.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleUpdateStatus = async (status: OrderStatus, customRemarks?: string) => {
    if (!selectedOrder) return;

    setActionLoading(true);
    try {
      const payload: any = {
        status,
        updatedBy: currentUser?.username || 'tracking_team',
        remarks: customRemarks || `Package status updated to ${status} via tracking command dashboard.`
      };

      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setActionLoading(false);

      if (res.ok && data.success) {
        setSelectedOrder(data.order);
        setShowNdrReasonSelect(false);
        // Refresh tables
        fetchActiveShipments();
      } else {
        alert(data.error || 'Failed to update package tracking state.');
      }
    } catch (err) {
      setActionLoading(false);
      alert('Tracking API communication failed.');
    }
  };

  const filteredOrders = orders.filter(o => 
    o.orderId.toLowerCase().includes(search.toLowerCase()) ||
    (o.awb && o.awb.toLowerCase().includes(search.toLowerCase())) ||
    o.customerName.toLowerCase().includes(search.toLowerCase())
  );

  const openLogisticsControl = (order: Order) => {
    setSelectedOrder(order);
    setShowControlDrawer(true);
  };

  const handlePrintLabel = (order: Order) => {
    setPrintingOrder(order);
    setShowPrintLabel(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>Fulfillment & Dispatch Logistics</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Live courier tracking console and automated customer status updates.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button 
            onClick={handleBulkSync} 
            className="premium-btn premium-btn-secondary"
            disabled={syncLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {syncLoading ? <span className="spinner spinner-sm" /> : <RefreshCcw size={14} />}
            <span>{syncLoading ? 'Syncing...' : 'Sync Tracking API'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Search and Main lists */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '24px' }} className="desktop-tracking-grid">
        
        {/* Left Side: Shipment list and AWB search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="premium-card" style={{ padding: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#737373' }} />
              <input
                type="text"
                className="premium-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Search AWB or Order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="premium-card" style={{ padding: '16px', flex: 1, overflowY: 'auto', maxHeight: '70vh' }}>
            <h3 style={{ fontSize: '14px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              Active Courier Shipments
            </h3>

            {loading ? (
              <div className="loading-overlay" style={{ padding: '20px 0' }}>
                <span className="spinner spinner-accent" />
                <span>Refreshing shipments feeds...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <span style={{ fontSize: '13px', color: '#737373' }}>No active dispatches found.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredOrders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => openLogisticsControl(o)}
                    style={{
                      width: '100%',
                      backgroundColor: selectedOrder?.id === o.id ? 'rgba(255,255,255,0.03)' : '#0A0A0B',
                      border: '1px solid ' + (selectedOrder?.id === o.id ? 'var(--border-focus)' : 'var(--border)'),
                      borderRadius: '6px',
                      padding: '12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#FAFAFA', fontSize: '13.5px', fontFamily: 'monospace' }}>
                          {o.orderId}
                        </span>
                        <span className={`premium-badge status-${o.status.toLowerCase().replace(' ', '')}`} style={{ fontSize: '9px', padding: '2px 5px' }}>
                          {o.status}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '12px', color: '#737373', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span>{o.customerName}</span>
                        <span>|</span>
                        <CourierLogo courier={o.courier} size={14} />
                        <span>:</span>
                        <span style={{ fontFamily: 'monospace' }}>{o.awb}</span>
                      </div>

                      {(o.eta || o.current_status) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                          {o.current_status && (
                            <span className="premium-badge" style={{ fontSize: '9px', padding: '1px 4px', backgroundColor: '#1C1C21', color: '#A1A1AA', border: '1px solid var(--border)' }}>
                              {o.current_status}
                            </span>
                          )}
                          {o.eta && (
                            <span style={{ fontSize: '10.5px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <Clock size={10} />
                              <span>EDT: {o.eta}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <ChevronRight size={16} style={{ color: '#737373' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Visual Timeline & Logistics Actions Override Board */}
        <div>
          {selectedOrder ? (
            <div className="premium-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '76px' }}>
              
              {/* Drawer Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '18px', color: '#FAFAFA' }}>
                    Shipment: {selectedOrder.orderId}
                  </h3>
                  <div style={{ fontSize: '12.5px', color: '#8A8A8A', marginTop: '4px' }}>
                    Recipient: {selectedOrder.customerName} | Phone: {selectedOrder.phonePrimary} | Created By: {getUserDisplayName(selectedOrder.createdBy)}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#8A8A8A', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>Shipping Address: {selectedOrder.address}, {selectedOrder.pincode}</span>
                    <AddressRatingIndicator address={selectedOrder.address} style={{ fontSize: '9px', padding: '1px 4px' }} />
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`premium-badge status-${selectedOrder.status.toLowerCase().replace(' ', '')}`}>
                      {selectedOrder.status}
                    </span>
                    {selectedOrder.current_status && (
                      <span className="premium-badge" style={{ backgroundColor: '#1E1E24', color: '#E4E4E7', border: '1px solid var(--border)' }}>
                        {selectedOrder.current_status}
                      </span>
                    )}
                    {selectedOrder.eta && (
                      <span style={{ fontSize: '12px', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Estimated Delivery Date (EDT)">
                        <Clock size={11} />
                        <span>EDT: {selectedOrder.eta}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#737373', marginTop: '6px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>AWB: {selectedOrder.awb || 'N/A'}</span>
                      <span>(</span>
                      <CourierLogo courier={selectedOrder.courier} size={12} />
                      <span>)</span>
                    </span>
                    {selectedOrder.awb && (
                      <button
                        onClick={() => handlePrintLabel(selectedOrder)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3B82F6',
                          fontSize: '11px',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0
                        }}
                      >
                        Print Label
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic Interactive Tracking Timeline Chart */}
              <div>
                <h4 style={{ fontSize: '12px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>
                  Live Logistics Timeline
                </h4>

                {/* Vertical Timeline Component */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingLeft: '8px' }}>
                  {/* Step 1: Created */}
                  <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '6px', top: '16px', bottom: '-24px', width: '1px', backgroundColor: 'var(--color-paid)' }} />
                    <div style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: 'var(--color-paid)', border: '2px solid #000', zIndex: 1 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA' }}>Order Created & Verified</div>
                      <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Auto-routed to</span>
                        <CourierLogo courier={selectedOrder.courier} size={12} />
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Packed */}
                  {/* Checked if Label Generated, Dispatched, etc */}
                  {(() => {
                    const isCompleted = ['Label Generated', 'Dispatched', 'OFD', 'Delivered', 'NDR', 'Return', 'RDC'].includes(selectedOrder.status);
                    const lineColor = isCompleted ? 'var(--color-paid)' : 'var(--border)';
                    const dotColor = isCompleted ? 'var(--color-paid)' : 'transparent';
                    
                    return (
                      <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '6px', top: '16px', bottom: '-24px', width: '1px', backgroundColor: lineColor }} />
                        <div style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: dotColor, border: '2px solid ' + (isCompleted ? '#000' : 'var(--border-focus)'), zIndex: 1 }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isCompleted ? '#FAFAFA' : '#55555A' }}>Packed & AWB Label Attached</div>
                          {isCompleted && <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px', fontFamily: 'monospace' }}>AWB: {selectedOrder.awb}</div>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 3: Dispatched */}
                  {(() => {
                    const isCompleted = ['Dispatched', 'OFD', 'Delivered', 'NDR', 'Return', 'RDC'].includes(selectedOrder.status);
                    const lineColor = isCompleted ? 'var(--color-paid)' : 'var(--border)';
                    const dotColor = isCompleted ? 'var(--color-paid)' : 'transparent';
                    
                    return (
                      <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '6px', top: '16px', bottom: '-24px', width: '1px', backgroundColor: lineColor }} />
                        <div style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: dotColor, border: '2px solid ' + (isCompleted ? '#000' : 'var(--border-focus)'), zIndex: 1 }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isCompleted ? '#FAFAFA' : '#55555A' }}>Handed to Courier (In-Transit)</div>
                          {isCompleted && <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>Departed from Warehouse Delhi NCR Hub</div>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 4: OFD */}
                  {(() => {
                    const isCompleted = ['OFD', 'Delivered'].includes(selectedOrder.status);
                    const isNdr = selectedOrder.status === 'NDR';
                    const lineColor = isCompleted ? 'var(--color-paid)' : 'var(--border)';
                    const dotColor = isCompleted ? 'var(--color-paid)' : isNdr ? 'var(--destructive)' : 'transparent';
                    
                    return (
                      <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '6px', top: '16px', bottom: '-24px', width: '1px', backgroundColor: lineColor }} />
                        <div style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: dotColor, border: '2px solid ' + (isCompleted ? '#000' : isNdr ? '#000' : 'var(--border-focus)'), zIndex: 1 }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isCompleted ? '#FAFAFA' : isNdr ? 'var(--destructive)' : '#55555A' }}>
                            Out for Delivery (OFD)
                          </div>
                          {isCompleted && <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>Assigned to local delivery associate</div>}
                          {isNdr && <div style={{ fontSize: '11px', color: '#EF6868', marginTop: '2px' }}>⚠️ Exceptions logged: delivery reattempt pending</div>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 5: Delivered */}
                  {(() => {
                    const isCompleted = selectedOrder.status === 'Delivered';
                    const isReturned = ['Return', 'RDC'].includes(selectedOrder.status);
                    const dotColor = isCompleted ? 'var(--color-paid)' : isReturned ? '#F43F5E' : 'transparent';
                    
                    return (
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: dotColor, border: '2px solid ' + (isCompleted || isReturned ? '#000' : 'var(--border-focus)'), zIndex: 1 }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isCompleted ? '#FAFAFA' : isReturned ? '#F43F5E' : '#55555A' }}>
                            {isReturned ? 'Returned to Origin (RTO/RDC)' : 'Fulfillment Complete (Delivered)'}
                          </div>
                          {isCompleted && <div style={{ fontSize: '11px', color: 'var(--color-paid)', marginTop: '2px' }}>🟢 Package delivered successfully</div>}
                          {isReturned && <div style={{ fontSize: '11px', color: '#F43F5E', marginTop: '2px' }}>Returned. Packages stored in return center hub</div>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Live Delhivery / XpressBees scan history */}
              {(selectedOrder.courier === 'Delhivery' || selectedOrder.courier === 'XpressBees') && selectedOrder.awb && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                  <h4 style={{ fontSize: '12.5px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} style={{ color: '#10B981' }} />
                    <span>{selectedOrder.courier} Real-Time API Scans</span>
                  </h4>
                  {liveTrackingLoading ? (
                    <div style={{ fontSize: '12px', color: '#737373', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="spinner spinner-sm spinner-accent" />
                      <span>Contacting {selectedOrder.courier} live servers...</span>
                    </div>
                  ) : liveTrackingError ? (
                    <div style={{ fontSize: '11.5px', color: '#EF6868', backgroundColor: 'rgba(239, 104, 104, 0.05)', padding: '8px 10px', borderRadius: '4px' }}>
                      ℹ️ {liveTrackingError}
                    </div>
                  ) : liveTrackingData && liveTrackingData.ShipmentData && liveTrackingData.ShipmentData.length > 0 ? (
                    (() => {
                      const shipment = liveTrackingData.ShipmentData[0].Shipment;
                      const scans = shipment.Scans || [];
                      if (scans.length === 0) {
                        return <div style={{ fontSize: '12px', color: '#737373' }}>No scans recorded yet. Package is awaiting logistics pickup.</div>;
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--color-paid)', marginBottom: '4px' }}>
                            <strong>Current Status:</strong> {shipment.Status?.Status || 'Awaiting Scan'} ({shipment.Status?.StatusLocation || 'Origin'})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                            {scans.map((scan: any, idx: number) => {
                              const s = scan.ScanDetail || scan;
                              return (
                                <div key={idx} style={{ backgroundColor: '#0A0A0B', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', fontSize: '11px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373', marginBottom: '2px' }}>
                                    <span>📍 {s.ScannedLocation || s.location || 'Hub'}</span>
                                    <span>{new Date(s.ScanDateTime || s.scanDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div style={{ color: '#FAFAFA', fontWeight: 600 }}>{s.Scan || s.scan}</div>
                                  {s.Instructions && <div style={{ color: '#737373', fontSize: '10px', marginTop: '2px' }}>{s.Instructions}</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ fontSize: '12px', color: '#737373' }}>No live tracking status available.</div>
                  )}
                </div>
              )}



            </div>
          ) : (
            <div className="premium-card" style={{ textAlign: 'center', padding: '60px', color: '#737373', position: 'sticky', top: '76px' }}>
              <Truck size={36} style={{ color: 'var(--border-focus)', marginBottom: '14px' }} />
              <h3>No Shipment Selected</h3>
              <p style={{ fontSize: '12.5px', marginTop: '6px' }}>
                Select a shipment from the left queue list to examine its fulfillment timeline.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Shipping Label CSS Printing Mock Modal */}
      {showPrintLabel && printingOrder && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '520px', backgroundColor: '#FFFFFF', color: '#000000', border: '2px solid #000000' }}>
            {/* Real Visual Shipping Invoice Label Card */}
            <div id="printable-shipping-label" className="thermal-shipping-label" style={{ padding: '0', backgroundColor: '#FFFFFF', width: '4in', margin: '0 auto' }}>
              <HealvitaShippingLabel order={printingOrder} />
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
                onClick={handlePrint} 
                className="premium-btn premium-btn-primary" 
                style={{ backgroundColor: '#000', color: '#FFF', border: 'none', padding: '6px 12px' }}
              >
                <Printer size={14} />
                <span>Print Label</span>
              </button>
            </div>

          </div>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 1024px) {
          .desktop-tracking-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
