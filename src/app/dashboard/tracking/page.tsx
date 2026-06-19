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

export default function Tracking() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (selectedOrder && (selectedOrder.courier === 'Delhivery' || selectedOrder.courier === 'XpressBees') && selectedOrder.awb) {
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
    fetchActiveShipments();
  }, []);

  const fetchActiveShipments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?limit=100');
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

  const handleSimulatePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>Fulfillment & Dispatch Logistics</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Live courier tracking console, simulated status overrides, and automated customer updates.
          </p>
        </div>

        <button onClick={fetchActiveShipments} className="premium-btn premium-btn-secondary">
          <RefreshCcw size={14} />
          <span>Sync Tracking API</span>
        </button>
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
              <span style={{ fontSize: '13px', color: '#737373' }}>Refreshing shipments feeds...</span>
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
                      
                      <div style={{ fontSize: '12px', color: '#737373', marginTop: '6px' }}>
                        {o.customerName} | {o.courier}: <span style={{ fontFamily: 'monospace' }}>{o.awb}</span>
                      </div>
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
                    Recipient: {selectedOrder.customerName} | Phone: {selectedOrder.phonePrimary}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#8A8A8A', marginTop: '2px' }}>
                    Shipping Address: {selectedOrder.address}, {selectedOrder.pincode}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`premium-badge status-${selectedOrder.status.toLowerCase().replace(' ', '')}`}>
                    {selectedOrder.status}
                  </span>
                  <div style={{ fontSize: '11px', color: '#737373', marginTop: '6px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                    <span>AWB: {selectedOrder.awb || 'N/A'} ({selectedOrder.courier})</span>
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
                      <div style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>Auto-routed to {selectedOrder.courier || 'assigned courier'}</div>
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
                    <div style={{ fontSize: '12px', color: '#737373' }}>Contacting {selectedOrder.courier} live servers...</div>
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

              {/* Simulation Action Console Board */}
              <div style={{
                marginTop: '16px',
                borderTop: '1px solid var(--border)',
                paddingTop: '20px'
              }}>
                <h4 style={{ fontSize: '12px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={12} />
                  <span>Interactive Courier Simulation Commands Console</span>
                </h4>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {/* Dispatched state triggers */}
                  {selectedOrder.status === 'Label Generated' && (
                    <button
                      onClick={() => handleUpdateStatus('Dispatched', 'Handed over to pickup agent.')}
                      className="premium-btn premium-btn-primary"
                      disabled={actionLoading}
                      style={{ fontSize: '12.5px', padding: '6px 12px' }}
                    >
                      🚚 Set Dispatched
                    </button>
                  )}

                  {['Dispatched', 'NDR'].includes(selectedOrder.status) && (
                    <button
                      onClick={() => handleUpdateStatus('OFD', 'Package out for delivery. Alternate contact updated.')}
                      className="premium-btn premium-btn-primary"
                      disabled={actionLoading}
                      style={{ fontSize: '12.5px', padding: '6px 12px', backgroundColor: 'var(--color-vip)', borderColor: 'var(--color-vip)', color: '#000' }}
                    >
                      🛵 Set Out for Delivery (OFD)
                    </button>
                  )}

                  {selectedOrder.status === 'OFD' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus('Delivered', 'Delivered. Cash reconciled.')}
                        className="premium-btn premium-btn-primary"
                        disabled={actionLoading}
                        style={{ fontSize: '12.5px', padding: '6px 12px', backgroundColor: 'var(--color-paid)', borderColor: 'var(--color-paid)' }}
                      >
                        ✅ Set Delivered
                      </button>

                      <button
                        onClick={() => setShowNdrReasonSelect(true)}
                        className="premium-btn premium-btn-danger"
                        disabled={actionLoading}
                        style={{ fontSize: '12.5px', padding: '6px 12px' }}
                      >
                        ⚠️ Set NDR Exception (Fail)
                      </button>
                    </>
                  )}

                  {/* Return trigger */}
                  {['NDR', 'Dispatched', 'OFD'].includes(selectedOrder.status) && (
                    <button
                      onClick={() => handleUpdateStatus('Return', 'Initiating RTO back to warehouse.')}
                      className="premium-btn premium-btn-secondary"
                      disabled={actionLoading}
                      style={{ fontSize: '12.5px', padding: '6px 12px', color: '#EF6868', borderColor: '#EF6868' }}
                    >
                      🔄 Set Return to Origin (RTO)
                    </button>
                  )}
                </div>

                {/* Select NDR Reason Modal block */}
                {showNdrReasonSelect && (
                  <div style={{
                    marginTop: '16px',
                    backgroundColor: '#111113',
                    border: '1px solid #E11D48',
                    borderRadius: '6px',
                    padding: '16px',
                    animation: 'fadeIn 0.2s ease'
                  }}>
                    <h5 style={{ fontSize: '12.5px', color: '#FAFAFA', fontWeight: 600, marginBottom: '10px' }}>
                      Select NDR Exception Reason Code
                    </h5>
                    
                    <select
                      className="premium-input"
                      style={{ padding: '6px 12px', fontSize: '13px', marginBottom: '12px' }}
                      value={ndrReason}
                      onChange={(e) => setNdrReason(e.target.value)}
                    >
                      <option value="Customer phone out of reach / Switched off">Customer phone out of reach / Switched off</option>
                      <option value="Customer refused delivery of COD package">Customer refused delivery of COD package</option>
                      <option value="Incorrect delivery address provided">Incorrect delivery address provided</option>
                      <option value="Door locked / Nobody home at address">Door locked / Nobody home at address</option>
                      <option value="Customer requested delivery postponement">Customer requested delivery postponement</option>
                    </select>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowNdrReasonSelect(false)} className="premium-btn premium-btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>Cancel</button>
                      <button 
                        onClick={() => handleUpdateStatus('NDR', `Courier report: Failed delivery attempt. Reason: ${ndrReason}`)} 
                        className="premium-btn premium-btn-primary" 
                        style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#E11D48', borderColor: '#E11D48' }}
                      >
                        Confirm NDR Exception
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Informative block showing automation side effects */}
              <div style={{
                backgroundColor: '#111113',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '12px 14px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                color: '#8A8A8A'
              }}>
                <Clock size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#FAFAFA' }} />
                <div>
                  <strong>Automated Triggers:</strong> Modifying status above immediately sends simulated WhatsApp messages to the customer primary and secondary numbers, logs courier events, and registers NDR exception files.
                </div>
              </div>

            </div>
          ) : (
            <div className="premium-card" style={{ textAlign: 'center', padding: '60px', color: '#737373', position: 'sticky', top: '76px' }}>
              <Truck size={36} style={{ color: 'var(--border-focus)', marginBottom: '14px' }} />
              <h3>No Shipment Selected</h3>
              <p style={{ fontSize: '12.5px', marginTop: '6px' }}>
                Select a shipment from the left queue list to examine its fulfillment timeline and trigger courier simulations commands.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Shipping Label CSS Printing Mock Modal */}
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
