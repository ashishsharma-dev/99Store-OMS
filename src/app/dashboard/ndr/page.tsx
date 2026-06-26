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
  ChevronRight,
  Eye,
  Settings
} from 'lucide-react';
import { NdrRecord, Order, User as DbUser } from '@/lib/types';

export default function NdrManagement() {
  const [ndrRecords, setNdrRecords] = useState<NdrRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ndr' | 'working_sheet'>('ndr');
  
  // Selection for bulk transfer
  const [selectedNdrIds, setSelectedNdrIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Selected NDR for scheduling/resolving
  const [selectedNdr, setSelectedNdr] = useState<NdrRecord | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // Form Resolve fields
  const [actionDropdown, setActionDropdown] = useState<'Arranged' | 'Arranged for Tomorrow' | 'Future Delivery'>('Arranged');
  const [futureDeliveryDate, setFutureDeliveryDate] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [escalationRemarks, setEscalationRemarks] = useState('');
  
  const [formLoading, setFormLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [systemUsers, setSystemUsers] = useState<DbUser[]>([]);
  const [targetHandler, setTargetHandler] = useState('');
  
  // Reassign modal states
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedOrderForReassign, setSelectedOrderForReassign] = useState<Order | null>(null);
  const [reassignHandler, setReassignHandler] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
    fetchData();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && data.users) {
        setSystemUsers(data.users);
        const active = (data.users as DbUser[]).filter(u => u.isActive);
        if (active.length > 0) {
          setTargetHandler(active[0].name);
          setReassignHandler(active[0].name);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setSelectedNdrIds([]);
    try {
      // 1. Fetch NDR Records
      const ndrRes = await fetch('/api/ndr');
      const ndrData = await ndrRes.json();
      if (ndrRes.ok && ndrData.records) {
        setNdrRecords(ndrData.records);
      }

      // 2. Fetch Orders to determine which are in working sheet
      const ordersRes = await fetch('/api/orders?limit=150');
      const ordersData = await ordersRes.json();
      if (ordersRes.ok && ordersData.orders) {
        setOrders(ordersData.orders);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSelectNdr = (ndrId: string) => {
    setSelectedNdrIds(prev => 
      prev.includes(ndrId) ? prev.filter(id => id !== ndrId) : [...prev, ndrId]
    );
  };

  const handleSelectAll = (filteredRecords: NdrRecord[]) => {
    if (selectedNdrIds.length === filteredRecords.length) {
      setSelectedNdrIds([]);
    } else {
      setSelectedNdrIds(filteredRecords.map(r => r.id));
    }
  };

  const handleTransferToWorkingSheet = async () => {
    if (selectedNdrIds.length === 0) return;
    setBulkLoading(true);

    let successCount = 0;
    for (const ndrId of selectedNdrIds) {
      const ndr = ndrRecords.find(n => n.id === ndrId);
      if (!ndr) continue;

      const order = orders.find(o => o.orderId.toLowerCase() === ndr.orderId.toLowerCase());
      if (!order) continue;

      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inNdrWorkingSheet: true,
            assignedTo: targetHandler,
            updatedBy: currentUser?.username || 'ndr_operator',
            remarks: `Transferred shipment to NDR Working Sheet and assigned to handler: ${targetHandler}.`
          })
        });

        if (res.ok) {
          successCount++;
        }
      } catch (err) {
        console.error(err);
      }
    }

    alert(`Successfully transferred ${successCount} of ${selectedNdrIds.length} exceptions to NDR Working Sheet.`);
    setBulkLoading(false);
    fetchData();
  };

  const handleOpenReassign = (order: Order) => {
    setSelectedOrderForReassign(order);
    const active = systemUsers.filter(u => u.isActive);
    setReassignHandler(order.assignedTo || (active.length > 0 ? active[0].name : ''));
    setShowReassignModal(true);
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForReassign) return;
    setFormLoading(true);

    try {
      const res = await fetch(`/api/orders/${selectedOrderForReassign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTo: reassignHandler,
          updatedBy: currentUser?.username || 'ndr_operator',
          remarks: `Reassigned NDR ticket handling from ${selectedOrderForReassign.assignedTo || 'Unassigned'} to ${reassignHandler}.`
        })
      });

      setFormLoading(false);
      if (res.ok) {
        setShowReassignModal(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update NDR handler.');
      }
    } catch (err) {
      setFormLoading(false);
      alert('NDR reassignment network error.');
    }
  };

  const handleOpenResolve = (record: NdrRecord) => {
    setSelectedNdr(record);
    setActionDropdown('Arranged');
    setFutureDeliveryDate('');
    setInternalNotes(record.internalNotes || '');
    setEscalationRemarks('');
    setShowResolveModal(true);
  };

  const handleResolveNdr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNdr) return;

    if (actionDropdown === 'Future Delivery' && !futureDeliveryDate) {
      alert('Delivery Date is mandatory for Future Delivery.');
      return;
    }

    setFormLoading(true);
    try {
      let targetReattemptDate = '';
      if (actionDropdown === 'Arranged') {
        targetReattemptDate = new Date().toISOString().split('T')[0]; // today
      } else if (actionDropdown === 'Arranged for Tomorrow') {
        targetReattemptDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // tomorrow
      } else if (actionDropdown === 'Future Delivery') {
        targetReattemptDate = futureDeliveryDate;
      }

      // First resolve the NDR ticket
      const res = await fetch('/api/ndr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedNdr.id,
          status: 'Re-attempt Scheduled',
          reattemptDate: targetReattemptDate,
          internalNotes,
          actionRemarks: escalationRemarks || `NDR Resolved: ${actionDropdown} on ${targetReattemptDate}.`,
          updatedBy: currentUser?.username || 'ndr_operator'
        })
      });

      if (res.ok) {
        // Also remove from working sheet in main order model
        const order = orders.find(o => o.orderId.toLowerCase() === selectedNdr.orderId.toLowerCase());
        if (order) {
          await fetch(`/api/orders/${order.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inNdrWorkingSheet: false,
              ndrAction: actionDropdown,
              futureDeliveryDate: actionDropdown === 'Future Delivery' ? futureDeliveryDate : undefined,
              updatedBy: currentUser?.username || 'ndr_operator',
              remarks: `NDR Action applied: ${actionDropdown}. Removed from NDR working queue.`
            })
          });
        }

        setShowResolveModal(false);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update NDR status.');
      }
      setFormLoading(false);
    } catch (err) {
      setFormLoading(false);
      alert('NDR Update network communication error.');
    }
  };

  // filter helper
  const getOrderForNdr = (orderId: string) => {
    return orders.find(o => o.orderId.toLowerCase() === orderId.toLowerCase());
  };

  const activeUsers = systemUsers.filter(u => u.isActive);

  // Tab 1 List: Active NDR tickets that are NOT in working sheet
  const activeNdrTickets = ndrRecords.filter(n => {
    const order = getOrderForNdr(n.orderId);
    return n.status === 'Pending' && (!order || !order.inNdrWorkingSheet);
  });

  // Tab 2 List: Active NDR tickets that are IN the working sheet
  const workingSheetTickets = ndrRecords.filter(n => {
    const order = getOrderForNdr(n.orderId);
    return order && order.inNdrWorkingSheet;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>NDR Exception Management</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Coordinate failed delivery exceptions, transfer cases to working sheet logs, and log customer re-schedule options.
          </p>
        </div>

        <button onClick={fetchData} className="premium-btn premium-btn-secondary" disabled={loading || bulkLoading}>
          <RefreshCcw size={14} />
          <span>Reload Queue</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        gap: '24px',
        marginBottom: '8px'
      }}>
        <button
          onClick={() => { setActiveTab('ndr'); setSelectedNdrIds([]); }}
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
          <span>All NDR Tickets ({activeNdrTickets.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('working_sheet'); setSelectedNdrIds([]); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 4px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'working_sheet' ? '#FAFAFA' : '#737373',
            borderBottom: activeTab === 'working_sheet' ? '2px solid #FAFAFA' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={15} style={{ color: activeTab === 'working_sheet' ? '#10B981' : '#737373' }} />
          <span>NDR Working Sheet ({workingSheetTickets.length})</span>
        </button>
      </div>

      {/* Bulk actions for NDR tab */}
      {activeTab === 'ndr' && selectedNdrIds.length > 0 && (
        <div className="premium-card animate-fade-in" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111113', borderColor: '#EF4444' }}>
          <span style={{ fontSize: '13.5px', color: '#FAFAFA', fontWeight: 600 }}>
            Selected {selectedNdrIds.length} NDR tickets
          </span>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#737373', textTransform: 'uppercase' }}>Assign Handler:</span>
            <select
              className="premium-input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '12px' }}
              value={targetHandler}
              onChange={(e) => setTargetHandler(e.target.value)}
            >
              {activeUsers.map(u => (
                <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
              ))}
            </select>
            <button 
              onClick={handleTransferToWorkingSheet} 
              className="premium-btn premium-btn-primary" 
              style={{ padding: '6px 12px', fontSize: '12.5px', backgroundColor: '#10B981', borderColor: '#10B981' }}
              disabled={bulkLoading}
            >
              Transfer to NDR Working Sheet
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <div style={{ color: '#737373', fontSize: '14px' }}>Loading NDR exceptions...</div>
      ) : activeTab === 'ndr' ? (
        /* Tab 1: All NDR Tickets */
        activeNdrTickets.length === 0 ? (
          <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
            No failed delivery exceptions (NDR) are pending. Good job!
          </div>
        ) : (
          <div className="premium-table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', paddingLeft: '16px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedNdrIds.length === activeNdrTickets.length && activeNdrTickets.length > 0} 
                      onChange={() => handleSelectAll(activeNdrTickets)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th>Order ID</th>
                  <th>Customer Contact</th>
                  <th>Courier / AWB</th>
                  <th>Exception Reason</th>
                  <th>Reported Date</th>
                </tr>
              </thead>
              <tbody>
                {activeNdrTickets.map((n) => {
                  const order = getOrderForNdr(n.orderId);
                  const isPartiallyPaid = order?.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0;
                  
                  return (
                    <tr 
                      key={n.id}
                      style={{
                        borderLeft: isPartiallyPaid ? '3px solid #10B981' : 'none',
                        backgroundColor: isPartiallyPaid ? 'rgba(16,185,129,0.08)' : 'transparent'
                      }}
                    >
                      <td style={{ paddingLeft: '16px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedNdrIds.includes(n.id)} 
                          onChange={() => handleSelectNdr(n.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{n.orderId}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{n.customerName}</div>
                        <div style={{ fontSize: '11px', color: '#737373' }}>Tel: {n.phonePrimary}</div>
                      </td>
                      <td>
                        <div>{n.courier}</div>
                        <div style={{ fontSize: '11.5px', color: '#737373', fontFamily: 'monospace' }}>{n.awb}</div>
                      </td>
                      <td style={{ color: '#EF6868', maxWidth: '240px', fontSize: '13px' }}>
                        {n.reason}
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#737373' }}>
                        {n.createdAt.split('T')[0]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Tab 2: NDR Working Sheet */
        workingSheetTickets.length === 0 ? (
          <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
            No shipments are currently transferred to the Working Sheet.
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
                  <th>Assigned Handler</th>
                  <th>Fulfillment Details</th>
                  <th style={{ textAlign: 'right' }}>Action Control</th>
                </tr>
              </thead>
              <tbody>
                {workingSheetTickets.map((n) => {
                  const order = getOrderForNdr(n.orderId);
                  const isPartiallyPaid = order?.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0;
                  
                  return (
                    <tr 
                      key={n.id}
                      style={{
                        borderLeft: isPartiallyPaid ? '3px solid #10B981' : 'none',
                        backgroundColor: isPartiallyPaid ? 'rgba(16,185,129,0.08)' : 'transparent'
                      }}
                    >
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{n.orderId}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{n.customerName}</div>
                        <div style={{ fontSize: '11px', color: '#737373' }}>Tel: {n.phonePrimary}</div>
                      </td>
                      <td>
                        <div>{n.courier}</div>
                        <div style={{ fontSize: '11.5px', color: '#737373', fontFamily: 'monospace' }}>{n.awb}</div>
                      </td>
                      <td style={{ color: '#EF6868', maxWidth: '240px', fontSize: '13px' }}>
                        {n.reason}
                      </td>
                      <td style={{ fontWeight: 'bold', color: '#FAFAFA' }}>
                        👤 {order?.assignedTo || 'Unassigned'}
                      </td>
                      <td>
                        <span className="premium-badge status-ndr" style={{ fontSize: '9px', padding: '2px 6px' }}>
                          WORKING SHEET ACTIVE
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => order && handleOpenReassign(order)}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            disabled={!order}
                          >
                            Reassign
                          </button>
                          <button
                            onClick={() => handleOpenResolve(n)}
                            className="premium-btn premium-btn-primary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            Schedule Action
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* MODAL: Resolve Working Sheet / Schedule Re-attempts */}
      {showResolveModal && selectedNdr && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '520px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Resolve NDR Working Sheet: {selectedNdr.orderId}</h3>
              <button onClick={() => setShowResolveModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleResolveNdr} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* NDR Action dropdown selector */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Select NDR Action *</label>
                <select
                  className="premium-input"
                  value={actionDropdown}
                  onChange={(e) => setActionDropdown(e.target.value as any)}
                  required
                >
                  <option value="Arranged">Arranged (Reattempt Today)</option>
                  <option value="Arranged for Tomorrow">Arranged for Tomorrow (Reattempt Tomorrow)</option>
                  <option value="Future Delivery">Future Delivery</option>
                </select>
              </div>

              {/* Conditional Future Delivery Date field */}
              {actionDropdown === 'Future Delivery' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Delivery Date *</label>
                  <input
                    type="date"
                    className="premium-input"
                    value={futureDeliveryDate}
                    onChange={(e) => setFutureDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              )}

              {/* Remarks/Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Internal Escalation Notes (Persistent)</label>
                <textarea
                  className="premium-input"
                  placeholder="e.g. Customer requested evening delivery, noted..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  style={{ minHeight: '60px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Customer Resolution Comment (History Log) *</label>
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

      {/* MODAL: Reassign Handler */}
      {showReassignModal && selectedOrderForReassign && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '440px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Reassign NDR: {selectedOrderForReassign.orderId}</h3>
              <button onClick={() => setShowReassignModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleReassignSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Select Handler *</label>
                <select
                  className="premium-input"
                  value={reassignHandler}
                  onChange={(e) => setReassignHandler(e.target.value)}
                  required
                >
                  {activeUsers.map(u => (
                    <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowReassignModal(false)} className="premium-btn premium-btn-secondary">Close</button>
                <button type="submit" className="premium-btn premium-btn-primary" disabled={formLoading}>
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
