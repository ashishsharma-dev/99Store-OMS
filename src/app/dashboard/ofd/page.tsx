'use client';

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  User, 
  RefreshCcw, 
  MapPin, 
  Phone,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ListFilter,
  MessageSquare,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { Order, OrderStatus, User as DbUser } from '@/lib/types';

export default function OfdManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all_ofd' | 'working_sheet'>('all_ofd');

  // Multi-select for assigning riders
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [targetRider, setTargetRider] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Selected Order for detail operations (e.g. transfer to NDR or reassign)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [modalAction, setModalAction] = useState<'reassign' | 'ndr'>('reassign');
  const [modalRider, setModalRider] = useState('');
  const [ndrRemarks, setNdrRemarks] = useState('');

  // Modules 6 & 7: Audited Temporal Remarks Timeline Modal state
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineOrder, setTimelineOrder] = useState<Order | null>(null);

  // Dedicated Add User Remark modal state
  const [showAddRemarkModal, setShowAddRemarkModal] = useState(false);
  const [selectedOrderForRemark, setSelectedOrderForRemark] = useState<Order | null>(null);
  const [newRemarkInput, setNewRemarkInput] = useState('');

  const handleAddOfdRemarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = selectedOrderForRemark || timelineOrder;
    if (!target || !newRemarkInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remarks: newRemarkInput,
          updatedBy: currentUser?.username || 'ofd_operator'
        })
      });
      setActionLoading(false);
      if (res.ok) {
        setShowAddRemarkModal(false);
        setNewRemarkInput('');
        fetchOfdOrders();
        if (showTimelineModal) {
          const updatedRes = await fetch(`/api/orders/${target.id}`);
          const data = await updatedRes.json();
          if (updatedRes.ok && data.order) setTimelineOrder(data.order);
        }
      } else {
        alert('Failed to add OFD remark');
      }
    } catch (err) {
      setActionLoading(false);
      alert('Network error adding remark');
    }
  };

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [systemUsers, setSystemUsers] = useState<DbUser[]>([]);

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
    fetchOfdOrders();
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
          setTargetRider(active[0].name);
          setModalRider(active[0].name);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOfdOrders = async () => {
    setLoading(true);
    setSelectedOrderIds([]);
    try {
      const res = await fetch('/api/orders?limit=150');
      const data = await res.json();
      if (res.ok && data.orders) {
        // Filter orders in OFD state and sort by latest remark timestamp
        const ofdList = (data.orders as Order[]).filter(o => o.status === 'OFD').sort((a, b) => {
          const tA = a.temporal_remarks && a.temporal_remarks.length > 0
            ? new Date(a.temporal_remarks[a.temporal_remarks.length - 1].created_at).getTime()
            : new Date(a.updatedAt || a.createdAt).getTime();
          const tB = b.temporal_remarks && b.temporal_remarks.length > 0
            ? new Date(b.temporal_remarks[b.temporal_remarks.length - 1].created_at).getTime()
            : new Date(b.updatedAt || b.createdAt).getTime();
          return tB - tA;
        });
        setOrders(ofdList);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAll = (list: Order[]) => {
    if (selectedOrderIds.length === list.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(list.map(o => o.id));
    }
  };

  const handleBulkAssign = async () => {
    if (selectedOrderIds.length === 0) return;
    setActionLoading(true);

    let successCount = 0;
    for (const orderId of selectedOrderIds) {
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignedTo: targetRider,
            updatedBy: currentUser?.username || 'ofd_operator',
            remarks: `Bulk assigned package to delivery agent: ${targetRider}.`
          })
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error(err);
      }
    }

    alert(`Successfully assigned ${successCount} of ${selectedOrderIds.length} packages to ${targetRider}.`);
    setActionLoading(false);
    fetchOfdOrders();
  };

  const handleOpenOperations = (order: Order, type: 'reassign' | 'ndr') => {
    setSelectedOrder(order);
    setModalAction(type);
    setModalRider(order.assignedTo || 'Vinay');
    setNdrRemarks('');
    setShowOperationModal(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setActionLoading(true);

    try {
      let payload: any = {
        updatedBy: currentUser?.username || 'ofd_operator'
      };

      if (modalAction === 'reassign') {
        payload.assignedTo = modalRider;
        payload.remarks = `Reassigned package to delivery agent ${modalRider} from ${selectedOrder.assignedTo || 'Unassigned'}.`;
      } else {
        // Transfer to NDR
        payload.status = 'NDR';
        payload.remarks = ndrRemarks || 'Delivery attempt failed: Transfer to NDR requested by OFD supervisor.';
      }

      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setActionLoading(false);
      if (res.ok) {
        setShowOperationModal(false);
        fetchOfdOrders();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update OFD record.');
      }
    } catch (err) {
      setActionLoading(false);
      alert('OFD Action network communication error.');
    }
  };

  // Tab filters
  const unassignedOfd = orders.filter(o => !o.assignedTo);
  const workingSheetOfd = orders.filter(o => o.assignedTo);
  const activeUsers = systemUsers.filter(u => u.isActive);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>OFD Dispatch Management</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Assign riders, distribute parcels, re-route dispatches, and trigger instant escalations to NDR.
          </p>
        </div>

        <button onClick={fetchOfdOrders} className="premium-btn premium-btn-secondary" disabled={loading || actionLoading}>
          <RefreshCcw size={14} />
          <span>Reload Feeds</span>
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
          onClick={() => { setActiveTab('all_ofd'); setSelectedOrderIds([]); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 4px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'all_ofd' ? '#FAFAFA' : '#737373',
            borderBottom: activeTab === 'all_ofd' ? '2px solid #FAFAFA' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Truck size={15} style={{ color: activeTab === 'all_ofd' ? '#3B82F6' : '#737373' }} />
          <span>All OFD - Unassigned ({unassignedOfd.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('working_sheet'); setSelectedOrderIds([]); }}
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
          <CheckCircle size={15} style={{ color: activeTab === 'working_sheet' ? '#10B981' : '#737373' }} />
          <span>OFD Working Sheet - Assigned ({workingSheetOfd.length})</span>
        </button>
      </div>

      {/* Bulk Assignment Panel (Tab 1 only) */}
      {activeTab === 'all_ofd' && selectedOrderIds.length > 0 && (
        <div className="premium-card animate-fade-in" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111113', borderColor: '#3B82F6' }}>
          <span style={{ fontSize: '13.5px', color: '#FAFAFA', fontWeight: 600 }}>
            Selected {selectedOrderIds.length} OFD shipments
          </span>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#737373', textTransform: 'uppercase' }}>Assign To:</span>
            <select
              className="premium-input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '12px' }}
              value={targetRider}
              onChange={(e) => setTargetRider(e.target.value)}
            >
              {activeUsers.map(u => (
                <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
              ))}
            </select>
            <button 
              onClick={handleBulkAssign} 
              className="premium-btn premium-btn-primary" 
              style={{ padding: '6px 12px', fontSize: '12.5px' }}
              disabled={actionLoading}
            >
              Assign Rider
            </button>
          </div>
        </div>
      )}

      {/* Lists */}
      {loading ? (
        <div style={{ color: '#737373', fontSize: '14px' }}>Loading OFD parcel logs...</div>
      ) : activeTab === 'all_ofd' ? (
        /* Tab 1: Unassigned OFD list */
        unassignedOfd.length === 0 ? (
          <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
            No unassigned Out-for-Delivery packages. Good job!
          </div>
        ) : (
          <div className="premium-table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', paddingLeft: '16px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedOrderIds.length === unassignedOfd.length && unassignedOfd.length > 0} 
                      onChange={() => handleSelectAll(unassignedOfd)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th>Order ID</th>
                  <th>Customer Recipient</th>
                  <th>Courier / AWB</th>
                  <th>Destination Hub</th>
                  <th>Latest Remark</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {unassignedOfd.map((o) => {
                  const isPartiallyPaid = o.partiallyPaidAmount !== undefined && o.partiallyPaidAmount > 0;
                  
                  let latestRemarkText = 'Initial OFD Dispatch';
                  let latestRemarkMeta = '';
                  if (o.temporal_remarks && o.temporal_remarks.length > 0) {
                    const last = o.temporal_remarks[o.temporal_remarks.length - 1];
                    latestRemarkText = last.remark_text;
                    latestRemarkMeta = `${last.author_user_id || 'User'} • ${new Date(last.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
                  } else if (o.history && o.history.length > 0) {
                    const last = o.history[o.history.length - 1];
                    latestRemarkText = last.remarks;
                    latestRemarkMeta = new Date(last.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                  }

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
                          checked={selectedOrderIds.includes(o.id)} 
                          onChange={() => handleSelectOrder(o.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.orderId}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                        <div style={{ fontSize: '11px', color: '#737373' }}>Primary Tel: {o.phonePrimary}</div>
                      </td>
                      <td>
                        <div>{o.courier}</div>
                        <div style={{ fontSize: '11.5px', color: '#737373', fontFamily: 'monospace' }}>{o.awb}</div>
                      </td>
                      <td>
                        <div>{o.area}</div>
                        <span style={{ fontSize: '11px', color: '#737373' }}>{o.state} ({o.pincode})</span>
                      </td>
                      <td style={{ maxWidth: '220px', fontSize: '12px' }}>
                        <div 
                          onClick={() => { setTimelineOrder(o); setShowTimelineModal(true); }}
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
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setSelectedOrderForRemark(o); setNewRemarkInput(''); setShowAddRemarkModal(true); }}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
                            title="Add Dispatch Remark"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenOperations(o, 'reassign')}
                            className="premium-btn premium-btn-primary"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            title="Assign Rider Agent"
                          >
                            <UserCheck size={13} />
                            <span>Assign</span>
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
        /* Tab 2: Assigned Working Sheet */
        workingSheetOfd.length === 0 ? (
          <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
            No packages currently assigned to any delivery riders.
          </div>
        ) : (
          <div className="premium-table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer Recipient</th>
                  <th>Courier / AWB</th>
                  <th>Assigned Rider</th>
                  <th>Fulfillment Details</th>
                  <th>Latest Remark</th>
                  <th style={{ textAlign: 'right' }}>Action Controls</th>
                </tr>
              </thead>
              <tbody>
                {workingSheetOfd.map((o) => {
                  const isPartiallyPaid = o.partiallyPaidAmount !== undefined && o.partiallyPaidAmount > 0;
                  
                  let latestRemarkText = 'Assigned to Rider';
                  let latestRemarkMeta = '';
                  if (o.temporal_remarks && o.temporal_remarks.length > 0) {
                    const last = o.temporal_remarks[o.temporal_remarks.length - 1];
                    latestRemarkText = last.remark_text;
                    latestRemarkMeta = `${last.author_user_id || 'User'} • ${new Date(last.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
                  } else if (o.history && o.history.length > 0) {
                    const last = o.history[o.history.length - 1];
                    latestRemarkText = last.remarks;
                    latestRemarkMeta = new Date(last.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                  }

                  return (
                    <tr 
                      key={o.id}
                      style={{
                        borderLeft: isPartiallyPaid ? '3px solid #10B981' : 'none',
                        backgroundColor: isPartiallyPaid ? 'rgba(16,185,129,0.08)' : 'transparent'
                      }}
                    >
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.orderId}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                        <div style={{ fontSize: '11px', color: '#737373' }}>Tel: {o.phonePrimary}</div>
                      </td>
                      <td>
                        <div>{o.courier}</div>
                        <div style={{ fontSize: '11.5px', color: '#737373', fontFamily: 'monospace' }}>{o.awb}</div>
                      </td>
                      <td style={{ fontWeight: 'bold', color: '#FAFAFA' }}>
                        👤 {o.assignedTo}
                      </td>
                      <td>
                        <div>{o.area} ({o.pincode})</div>
                      </td>
                      <td style={{ maxWidth: '220px', fontSize: '12px' }}>
                        <div 
                          onClick={() => { setTimelineOrder(o); setShowTimelineModal(true); }}
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
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setSelectedOrderForRemark(o); setNewRemarkInput(''); setShowAddRemarkModal(true); }}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
                            title="Add Dispatch Remark"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenOperations(o, 'reassign')}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            title="Reassign Rider Agent"
                          >
                            <UserCheck size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenOperations(o, 'ndr')}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.08)' }}
                            title="Report Failed Delivery (Transfer to NDR)"
                          >
                            <AlertCircle size={14} />
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

      {/* OPERATIONS MODAL: Reassign Rider or Transfer directly to NDR */}
      {showOperationModal && selectedOrder && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '480px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>
                OFD Action Board: {selectedOrder.orderId}
              </h3>
              <button onClick={() => setShowOperationModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleModalSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Type Switcher */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '16px' }}>
                <button
                  type="button"
                  onClick={() => setModalAction('reassign')}
                  style={{
                    background: 'none', border: 'none', padding: '8px 4px', fontSize: '13px', fontWeight: 600,
                    color: modalAction === 'reassign' ? '#FAFAFA' : '#737373',
                    borderBottom: modalAction === 'reassign' ? '2px solid #FAFAFA' : 'none', cursor: 'pointer'
                  }}
                >
                  👤 Reassign Rider
                </button>
                <button
                  type="button"
                  onClick={() => setModalAction('ndr')}
                  style={{
                    background: 'none', border: 'none', padding: '8px 4px', fontSize: '13px', fontWeight: 600,
                    color: modalAction === 'ndr' ? '#EF4444' : '#737373',
                    borderBottom: modalAction === 'ndr' ? '2px solid #EF4444' : 'none', cursor: 'pointer'
                  }}
                >
                  ⚠️ Transfer to NDR Exception
                </button>
              </div>

              {/* Action Fields */}
              {modalAction === 'reassign' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Select Delivery Agent *</label>
                  <select
                    className="premium-input"
                    value={modalRider}
                    onChange={(e) => setModalRider(e.target.value)}
                    required
                  >
                    {activeUsers.map(u => (
                      <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>NDR Exception Reason *</label>
                  <textarea
                    className="premium-input"
                    placeholder="e.g. Customer requested delivery postponement, phone out of reach..."
                    value={ndrRemarks}
                    onChange={(e) => setNdrRemarks(e.target.value)}
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    required
                  />
                  <span style={{ fontSize: '11px', color: '#737373', display: 'block', marginTop: '4px' }}>
                    This will immediately move the order to the NDR queue and record the failed attempt exception.
                  </span>
                </div>
              )}

              {/* Submits */}
              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowOperationModal(false)} className="premium-btn premium-btn-secondary">Close</button>
                <button 
                  type="submit" 
                  className="premium-btn premium-btn-primary" 
                  disabled={actionLoading}
                  style={{ 
                    backgroundColor: modalAction === 'ndr' ? '#E11D48' : 'var(--primary)',
                    borderColor: modalAction === 'ndr' ? '#E11D48' : 'var(--primary)'
                  }}
                >
                  {actionLoading ? 'Executing...' : 'Confirm Action'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: Dedicated Add User Remark */}
      {showAddRemarkModal && selectedOrderForRemark && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '460px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Add OFD User Remark: {selectedOrderForRemark.orderId}</h3>
              <button onClick={() => setShowAddRemarkModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleAddOfdRemarkSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>User Note / Dispatch Remark *</label>
                <textarea
                  className="premium-input"
                  placeholder="e.g. Spoke to customer, agreed for dispatch between 2 PM - 4 PM."
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
                <button type="submit" className="premium-btn premium-btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Add User Remark'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modules 6 & 7: Audited Temporal Remarks Timeline Modal */}
      {showTimelineModal && timelineOrder && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '580px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Audited Temporal Remarks Log</h3>
                <p style={{ fontSize: '12px', color: '#737373', margin: 0 }}>Order #{timelineOrder.orderId} - Chronological Life Cycle</p>
              </div>
              <button onClick={() => setShowTimelineModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>
            <div style={{ padding: '24px', maxHeight: '420px', overflowY: 'auto' }}>
              {(!timelineOrder.temporal_remarks || timelineOrder.temporal_remarks.length === 0) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {timelineOrder.history && [...timelineOrder.history].reverse().map((h, idx) => (
                    <div key={idx} style={{ padding: '12px', backgroundColor: '#161619', borderRadius: '8px', borderLeft: '3px solid #3B82F6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAFAFA' }}>Author: {h.updatedBy}</span>
                        <span style={{ fontSize: '10px', color: '#737373' }}>{new Date(h.timestamp).toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: '12.5px', color: '#A1A1AA', margin: 0 }}>{h.remarks}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[...timelineOrder.temporal_remarks].reverse().map((t, idx) => (
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
            <form onSubmit={handleAddOfdRemarkSubmit} style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border)', backgroundColor: '#121214', display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="premium-input"
                placeholder="Type new user remark with timestamp..."
                value={newRemarkInput}
                onChange={(e) => setNewRemarkInput(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <button type="submit" className="premium-btn premium-btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={actionLoading}>
                {actionLoading ? 'Adding...' : 'Post Remark'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
