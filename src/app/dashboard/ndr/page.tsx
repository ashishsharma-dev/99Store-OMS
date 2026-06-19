'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  RefreshCcw, 
  Calendar, 
  FileText, 
  Check, 
  MapPin, 
  Phone,
  ListFilter,
  User,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { NdrRecord, Order } from '@/lib/types';

export default function NdrManagement() {
  const [ndrRecords, setNdrRecords] = useState<NdrRecord[]>([]);
  const [ofdOrders, setOfdOrders] = useState<Order[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ndr' | 'ofd'>('ndr');
  
  // Selected NDR for scheduling/resolving
  const [selectedNdr, setSelectedNdr] = useState<NdrRecord | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // Form Resolve fields
  const [actionType, setActionType] = useState<'reattempt' | 'rto'>('reattempt');
  const [reattemptDate, setReattemptDate] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [escalationRemarks, setEscalationRemarks] = useState('');
  
  const [formLoading, setFormLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch NDR Records
      const ndrRes = await fetch('/api/ndr');
      const ndrData = await ndrRes.json();
      if (ndrRes.ok && ndrData.records) {
        setNdrRecords(ndrData.records);
      }

      // 2. Fetch Active Orders for OFD list
      const ordersRes = await fetch('/api/orders?limit=100');
      const ordersData = await ordersRes.json();
      if (ordersRes.ok && ordersData.orders) {
        // Filter only Out for Delivery (OFD) cases
        const ofdList = (ordersData.orders as Order[]).filter(o => o.status === 'OFD');
        setOfdOrders(ofdList);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleOpenResolve = (record: NdrRecord) => {
    setSelectedNdr(record);
    setActionType('reattempt');
    setReattemptDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // default tomorrow
    setInternalNotes(record.internalNotes || '');
    setEscalationRemarks('');
    setShowResolveModal(true);
  };

  const handleResolveNdr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNdr) return;

    setFormLoading(true);
    try {
      const isReattempt = actionType === 'reattempt';
      const status = isReattempt ? 'Re-attempt Scheduled' : 'Returned to Origin';

      const res = await fetch('/api/ndr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedNdr.id,
          status,
          reattemptDate: isReattempt ? reattemptDate : undefined,
          internalNotes,
          actionRemarks: escalationRemarks || (isReattempt ? `Customer approved delivery re-attempt on ${reattemptDate}.` : 'RTO authorized by Accounts/Tracking Team.'),
          updatedBy: currentUser?.username || 'escalations_manager'
        })
      });

      setFormLoading(false);
      if (res.ok) {
        setShowResolveModal(false);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update NDR status.');
      }
    } catch (err) {
      setFormLoading(false);
      alert('NDR Update network communication error.');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>NDR & OFD Exception Escalations</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Coordinate failed delivery exceptions, re-schedule package drops, and track Out-for-Delivery couriers.
          </p>
        </div>

        <button onClick={fetchData} className="premium-btn premium-btn-secondary">
          <RefreshCcw size={14} />
          <span>Reload Queue</span>
        </button>
      </div>

      {/* Tabs Switcher Row */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        gap: '24px',
        marginBottom: '8px'
      }}>
        <button
          onClick={() => setActiveTab('ndr')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 4px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'ndr' ? '#FAFAFA' : '#737373',
            borderBottom: activeTab === 'ndr' ? '2px solid #FAFAFA' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={15} style={{ color: activeTab === 'ndr' ? '#EF4444' : '#737373' }} />
          <span>NDR Exception Tickets ({ndrRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ofd')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 4px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'ofd' ? '#FAFAFA' : '#737373',
            borderBottom: activeTab === 'ofd' ? '2px solid #FAFAFA' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Calendar size={15} style={{ color: activeTab === 'ofd' ? '#F59E0B' : '#737373' }} />
          <span>Recent OFD Cases ({ofdOrders.length})</span>
        </button>
      </div>

      {/* Render Active Tab Views */}
      {loading ? (
        <div style={{ color: '#737373', fontSize: '14px' }}>Loading exception grids...</div>
      ) : activeTab === 'ndr' ? (
        /* NDR TAB */
        ndrRecords.length === 0 ? (
          <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
            Excellent! No failed delivery exceptions (NDR) are pending.
          </div>
        ) : (
          <div className="premium-table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer Contact</th>
                  <th>Courier / AWB</th>
                  <th>Exception Reason</th>
                  <th>Escalation State</th>
                  <th style={{ textAlign: 'right' }}>Action Control</th>
                </tr>
              </thead>
              <tbody>
                {ndrRecords.map((n) => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{n.orderId}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{n.customerName}</div>
                      <div style={{ fontSize: '11px', color: '#737373' }}>Primary Tel: {n.phonePrimary}</div>
                    </td>
                    <td>
                      <div>{n.courier}</div>
                      <div style={{ fontSize: '11.5px', color: '#737373', fontFamily: 'monospace' }}>{n.awb}</div>
                    </td>
                    <td style={{ color: '#EF6868', maxWidth: '220px', fontSize: '13px' }}>
                      {n.reason}
                    </td>
                    <td>
                      <span className={`premium-badge ${
                        n.status === 'Pending' ? 'status-ndr' : 
                        n.status === 'Re-attempt Scheduled' ? 'status-packing' : 'status-return'
                      }`}>
                        {n.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {n.status === 'Pending' ? (
                        <button
                          onClick={() => handleOpenResolve(n)}
                          className="premium-btn premium-btn-primary animate-fade-in"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Resolve Ticket
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#737373' }}>Escalated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* OFD TAB */
        ofdOrders.length === 0 ? (
          <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
            No packages are Out-for-Delivery (OFD) at this hub today.
          </div>
        ) : (
          <div className="premium-table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer Recipient</th>
                  <th>Logistics Courier</th>
                  <th>Destination Hub</th>
                  <th>AWB Number</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ofdOrders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.orderId}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                      <div style={{ fontSize: '11.5px', color: '#737373' }}>{o.phonePrimary}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{o.courier}</td>
                    <td>
                      <div>{o.area}</div>
                      <div style={{ fontSize: '11px', color: '#737373' }}>{o.state} ({o.pincode})</div>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{o.awb}</td>
                    <td>
                      <span className="premium-badge status-ofd">
                        🛵 OUT FOR DELIVERY
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* MODAL: Resolve NDR Ticket / Schedule Re-attempts */}
      {showResolveModal && selectedNdr && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '520px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Resolve NDR Exception: {selectedNdr.orderId}</h3>
              <button onClick={() => setShowResolveModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleResolveNdr} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Action type selection */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '8px', textTransform: 'uppercase' }}>Resolution Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setActionType('reattempt')}
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      background: actionType === 'reattempt' ? 'var(--primary)' : 'transparent',
                      color: actionType === 'reattempt' ? 'var(--primary-foreground)' : '#A1A1AA',
                      border: '1px solid ' + (actionType === 'reattempt' ? '#FFF' : 'var(--border)'),
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    📅 Schedule Re-attempt
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('rto')}
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      background: actionType === 'rto' ? 'var(--destructive)' : 'transparent',
                      color: '#FAFAFA',
                      border: '1px solid ' + (actionType === 'rto' ? 'var(--destructive)' : 'var(--border)'),
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    🔄 Return to Origin (RTO)
                  </button>
                </div>
              </div>

              {/* Conditional Fields */}
              {actionType === 'reattempt' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Re-attempt Delivery Date *</label>
                  <input
                    type="date"
                    className="premium-input"
                    value={reattemptDate}
                    onChange={(e) => setReattemptDate(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Remarks/Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Internal Escalation Notes (Persistent)</label>
                <textarea
                  className="premium-input"
                  placeholder="e.g. Spoke to alternate number, customer is available between 2pm-5pm..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  style={{ minHeight: '60px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Customer Resolution Comment (History Log)</label>
                <textarea
                  className="premium-input"
                  placeholder="e.g. Spoke to Rajesh, requested delivery tomorrow afternoon."
                  value={escalationRemarks}
                  onChange={(e) => setEscalationRemarks(e.target.value)}
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowResolveModal(false)} className="premium-btn premium-btn-secondary">Close</button>
                <button type="submit" className="premium-btn premium-btn-primary" disabled={formLoading}>
                  {formLoading ? 'Submitting resolution...' : 'Confirm Resolution'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
