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
  Settings,
  PlusCircle,
  UserCheck,
  MessageSquare,
  Trash2
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

  // Modules 6 & 7: Audited Temporal Remarks Timeline Modal state
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineNdr, setTimelineNdr] = useState<NdrRecord | null>(null);

  // Dedicated Add User Remark modal state
  const [showAddRemarkModal, setShowAddRemarkModal] = useState(false);
  const [selectedNdrForRemark, setSelectedNdrForRemark] = useState<NdrRecord | null>(null);
  const [newRemarkInput, setNewRemarkInput] = useState('');

  const handleAddRemarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = selectedNdrForRemark || timelineNdr;
    if (!target || !newRemarkInput.trim()) return;
    setFormLoading(true);
    try {
      const res = await fetch('/api/ndr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: target.id,
          addRemarkOnly: true,
          actionRemarks: newRemarkInput,
          updatedBy: currentUser?.username || 'user'
        })
      });
      setFormLoading(false);
      if (res.ok) {
        setShowAddRemarkModal(false);
        setNewRemarkInput('');
        fetchData();
        if (showTimelineModal) {
          // Refresh timeline modal data
          const updatedRecordsRes = await fetch('/api/ndr');
          const data = await updatedRecordsRes.json();
          if (updatedRecordsRes.ok && data.records) {
            const updated = data.records.find((r: any) => r.id === target.id);
            if (updated) setTimelineNdr(updated);
          }
        }
      } else {
        alert('Failed to add remark');
      }
    } catch (err) {
      setFormLoading(false);
      alert('Network error adding remark');
    }
  };

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
        const sorted = [...(ndrData.records as NdrRecord[])].sort((a, b) => {
          const tA = a.temporal_remarks && a.temporal_remarks.length > 0
            ? new Date(a.temporal_remarks[a.temporal_remarks.length - 1].created_at).getTime()
            : new Date(a.updatedAt || a.createdAt).getTime();
          const tB = b.temporal_remarks && b.temporal_remarks.length > 0
            ? new Date(b.temporal_remarks[b.temporal_remarks.length - 1].created_at).getTime()
            : new Date(b.updatedAt || b.createdAt).getTime();
          return tB - tA;
        });
        setNdrRecords(sorted);
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

  const handleDeleteNdr = async (record: NdrRecord) => {
    if (!currentUser) return;
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Tracking Team') {
      alert(`Role '${currentUser.role}' is not authorized to delete NDR records.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete NDR ticket for Order #${record.orderId}?`)) {
      return;
    }
    try {
      const res = await fetch('/api/ndr', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          deletedBy: currentUser.username,
          role: currentUser.role
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to delete NDR record.');
      }
    } catch (err) {
      alert('Network error deleting NDR record.');
    }
  };

  const handleBulkDeleteNdrs = async () => {
    if (!currentUser || selectedNdrIds.length === 0) return;
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Tracking Team') {
      alert(`Role '${currentUser.role}' is not authorized to bulk delete NDR records.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedNdrIds.length} selected NDR records?`)) {
      return;
    }
    try {
      const res = await fetch('/api/ndr', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedNdrIds,
          deletedBy: currentUser.username,
          role: currentUser.role
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedNdrIds([]);
        fetchData();
      } else {
        alert(data.error || 'Failed bulk deletion.');
      }
    } catch (err) {
      alert('Network error executing bulk deletion.');
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
            <button
              onClick={handleBulkDeleteNdrs}
              className="premium-btn premium-btn-danger"
              style={{ padding: '6px 12px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={14} />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <div className="premium-card loading-overlay" style={{ minHeight: '220px' }}>
          <span className="spinner spinner-lg spinner-accent" />
          <span>Retrieving NDR exception records...</span>
        </div>
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
                  <th>Latest Remark</th>
                  <th>Reported Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeNdrTickets.map((n) => {
                  const order = getOrderForNdr(n.orderId);
                  const isPartiallyPaid = order?.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0;
                  
                  let latestRemarkText = n.reason;
                  let latestRemarkMeta = '';
                  if (n.temporal_remarks && n.temporal_remarks.length > 0) {
                    const last = n.temporal_remarks[n.temporal_remarks.length - 1];
                    latestRemarkText = last.remark_text;
                    latestRemarkMeta = `${last.author_user_id || 'User'} • ${new Date(last.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
                  } else if (n.history && n.history.length > 0) {
                    const last = n.history[n.history.length - 1];
                    latestRemarkText = last.remarks;
                    latestRemarkMeta = new Date(last.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                  }

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
                      <td style={{ color: '#EF6868', maxWidth: '200px', fontSize: '13px' }}>
                        {n.reason}
                      </td>
                      <td style={{ maxWidth: '220px', fontSize: '12px' }}>
                        <div 
                          onClick={() => { setTimelineNdr(n); setShowTimelineModal(true); }}
                          style={{ color: '#3B82F6', cursor: 'pointer' }}
                          title="Click to view temporal remarks timeline"
                        >
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            💬 {latestRemarkText}
                          </div>
                          {latestRemarkMeta && (
                            <div style={{ fontSize: '10px', color: '#A1A1AA', marginTop: '2px' }}>
                              🕒 {latestRemarkMeta}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#737373' }}>
                        {n.createdAt.split('T')[0]}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setSelectedNdrForRemark(n); setNewRemarkInput(''); setShowAddRemarkModal(true); }}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
                            title="Add User Remark"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteNdr(n)}
                            className="premium-btn premium-btn-danger"
                            style={{ padding: '6px 8px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444', color: '#EF4444' }}
                            title="Delete NDR Record (Role Restricted)"
                          >
                            <Trash2 size={14} />
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
                  <th>Latest Remark</th>
                  <th>Fulfillment Details</th>
                  <th style={{ textAlign: 'right' }}>Action Control</th>
                </tr>
              </thead>
              <tbody>
                {workingSheetTickets.map((n) => {
                  const order = getOrderForNdr(n.orderId);
                  const isPartiallyPaid = order?.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0;
                  
                  let latestRemarkText = n.reason;
                  let latestRemarkMeta = '';
                  if (n.temporal_remarks && n.temporal_remarks.length > 0) {
                    const last = n.temporal_remarks[n.temporal_remarks.length - 1];
                    latestRemarkText = last.remark_text;
                    latestRemarkMeta = `${last.author_user_id || 'User'} • ${new Date(last.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
                  } else if (n.history && n.history.length > 0) {
                    const last = n.history[n.history.length - 1];
                    latestRemarkText = last.remarks;
                    latestRemarkMeta = new Date(last.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                  }
                  
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
                      <td style={{ color: '#EF6868', maxWidth: '200px', fontSize: '13px' }}>
                        {n.reason}
                      </td>
                      <td style={{ fontWeight: 'bold', color: '#FAFAFA' }}>
                        👤 {order?.assignedTo || 'Unassigned'}
                      </td>
                      <td style={{ maxWidth: '220px', fontSize: '12px' }}>
                        <div 
                          onClick={() => { setTimelineNdr(n); setShowTimelineModal(true); }}
                          style={{ color: '#3B82F6', cursor: 'pointer' }}
                          title="Click to view temporal remarks timeline"
                        >
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            💬 {latestRemarkText}
                          </div>
                          {latestRemarkMeta && (
                            <div style={{ fontSize: '10px', color: '#A1A1AA', marginTop: '2px' }}>
                              🕒 {latestRemarkMeta}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="premium-badge status-ndr" style={{ fontSize: '9px', padding: '2px 6px' }}>
                          WORKING SHEET ACTIVE
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setSelectedNdrForRemark(n); setNewRemarkInput(''); setShowAddRemarkModal(true); }}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
                            title="Add User Remark"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={() => order && handleOpenReassign(order)}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            disabled={!order}
                            title="Reassign Handler"
                          >
                            <UserCheck size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenResolve(n)}
                            className="premium-btn premium-btn-primary"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            title="Schedule NDR Action"
                          >
                            <Calendar size={13} />
                            <span>Action</span>
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
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Schedule Action: {selectedNdr.orderId}</h3>
              <button onClick={() => setShowResolveModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleResolveNdr} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Select NDR Action Type *</label>
                <select
                  className="premium-input"
                  value={actionDropdown}
                  onChange={(e) => setActionDropdown(e.target.value as any)}
                  required
                >
                  <option value="Arranged">Arranged (Re-attempt Delivery Today)</option>
                  <option value="Arranged for Tomorrow">Arranged for Tomorrow</option>
                  <option value="Future Delivery">Future Delivery Date</option>
                </select>
              </div>

              {actionDropdown === 'Future Delivery' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Select Future Delivery Date *</label>
                  <input
                    type="date"
                    className="premium-input"
                    value={futureDeliveryDate}
                    onChange={(e) => setFutureDeliveryDate(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Escalation Remarks / Notes *</label>
                <textarea
                  className="premium-input"
                  placeholder="Enter details from customer conversation..."
                  value={escalationRemarks}
                  onChange={(e) => setEscalationRemarks(e.target.value)}
                  style={{ minHeight: '80px' }}
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

      {/* MODAL: Dedicated Add User Remark */}
      {showAddRemarkModal && selectedNdrForRemark && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '460px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Add User Remark: {selectedNdrForRemark.orderId}</h3>
              <button onClick={() => setShowAddRemarkModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleAddRemarkSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>User Note / Escalation Detail *</label>
                <textarea
                  className="premium-input"
                  placeholder="e.g. Spoke to Rajesh, customer requested evening delivery after 6 PM."
                  value={newRemarkInput}
                  onChange={(e) => setNewRemarkInput(e.target.value)}
                  style={{ minHeight: '100px' }}
                  required
                />
                <span style={{ fontSize: '11px', color: '#737373', marginTop: '6px', display: 'block' }}>
                  This remark will be fed with your username and live timestamp.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddRemarkModal(false)} className="premium-btn premium-btn-secondary">Cancel</button>
                <button type="submit" className="premium-btn premium-btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Add User Remark'}
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

      {/* Modules 6 & 7: Audited Temporal Remarks Timeline Modal */}
      {showTimelineModal && timelineNdr && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '580px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Audited Temporal Remarks Log</h3>
                <p style={{ fontSize: '12px', color: '#737373', margin: 0 }}>NDR Ticket #{timelineNdr.orderId} - Chronological Exception Life Cycle</p>
              </div>
              <button onClick={() => setShowTimelineModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>
            <div style={{ padding: '24px', maxHeight: '420px', overflowY: 'auto' }}>
              {(!timelineNdr.temporal_remarks || timelineNdr.temporal_remarks.length === 0) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {timelineNdr.history && [...timelineNdr.history].reverse().map((h, idx) => (
                    <div key={idx} style={{ padding: '12px', backgroundColor: '#161619', borderRadius: '8px', borderLeft: '3px solid #EF4444' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAFAFA' }}>Action: {h.action}</span>
                        <span style={{ fontSize: '10px', color: '#737373' }}>{new Date(h.timestamp).toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: '12.5px', color: '#A1A1AA', margin: 0 }}>{h.remarks}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[...timelineNdr.temporal_remarks].reverse().map((t, idx) => (
                    <div key={idx} style={{ padding: '12px', backgroundColor: '#161619', borderRadius: '8px', borderLeft: '3px solid #10B981' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAFAFA' }}>Author User: {t.author_user_id}</span>
                        <span style={{ fontSize: '10px', color: '#737373' }}>{new Date(t.created_at).toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: '12.5px', color: '#E4E4E7', margin: 0 }}>{t.remark_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inline add remark form inside timeline */}
            <form onSubmit={handleAddRemarkSubmit} style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border)', backgroundColor: '#121214', display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="premium-input"
                placeholder="Type new user remark with timestamp..."
                value={newRemarkInput}
                onChange={(e) => setNewRemarkInput(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <button type="submit" className="premium-btn premium-btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={formLoading}>
                {formLoading ? 'Adding...' : 'Post Remark'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
