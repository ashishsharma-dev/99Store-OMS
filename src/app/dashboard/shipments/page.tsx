'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Truck, 
  MapPin, 
  ChevronLeft, 
  ChevronRight, 
  Eye,
  Star,
  RefreshCcw,
  Clock,
  Printer,
  ChevronDown,
  ArrowUpDown,
  MessageSquare,
  Copy
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';
import { InspectTooltipButton } from '@/components/InspectTooltipButton';
import { CourierLogo } from '@/components/CourierLogo';
import { AddressRatingIndicator } from '@/components/AddressRatingIndicator';
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter';
import { getUserDisplayName } from '@/lib/utils';

export default function AllShipments() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'all',
    startDate: '',
    endDate: ''
  });
  const [search, setSearch] = useState('');
  
  // Selected Order for detailing
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
  }, []);

  const handleToggleVip = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isVip: !order.isVip,
          updatedBy: currentUser?.username || 'admin'
        })
      });

      if (res.ok) {
        fetchShipmentsList(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update VIP status.');
      }
    } catch (err) {
      console.error('Error toggling VIP status:', err);
    }
  };

  const handleOnDemandWhatsAppTrack = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/whatsapp-track`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('On-Demand WhatsApp Tracking alert successfully dispatched to customer!');
      } else {
        alert(data.error || 'Failed to send WhatsApp update.');
      }
    } catch (err) {
      alert('Failed to connect to WhatsApp dispatch API.');
    }
  };

  const handleCloneOrder = (order: Order) => {
    window.location.href = `/dashboard/orders?clone=${order.id}`;
  };

  useEffect(() => {
    fetchShipmentsList();
  }, [search, statusFilter, courierFilter, sortField, sortOrder, page, dateRange]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchShipmentsList(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [search, statusFilter, courierFilter, sortField, sortOrder, page, dateRange]);

  const fetchShipmentsList = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      // Fetch all dispatches. We can query `/api/orders`
      // We pass filters and pagination parameters.
      let url = `/api/orders?page=${page}&limit=50&search=${encodeURIComponent(search)}&status=${statusFilter}&sortField=${sortField}&sortOrder=${sortOrder}`;
      if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
      if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (res.ok && data.orders) {
        let filtered = data.orders as Order[];
        
        // Filter by courier if requested
        if (courierFilter !== 'all') {
          filtered = filtered.filter(o => o.courier === courierFilter);
        }

        setOrders(filtered);
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.totalCount || 0);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSortChange = (combinedValue: string) => {
    const [field, order] = combinedValue.split('-');
    setSortField(field);
    setSortOrder(order);
    setPage(1);
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);

    if (order.awb) {
      const courierParam = order.courier ? `&courier=${order.courier}` : '';
      fetch(`/api/integrations/courier?action=track&waybill=${order.awb}${courierParam}`)
        .then(res => {
          if (res.ok) {
            fetchShipmentsList(true);
            return fetch(`/api/orders/${order.id}`);
          }
        })
        .then(res => res?.json())
        .then(data => {
          if (data && data.success && data.order) {
            setSelectedOrder(data.order);
          }
        })
        .catch(err => console.error('Failed to trigger single parcel sync:', err));
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>All Shipments Directory</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Global dispatches console: inspect real-time logs, search shipments by customer name, mobile numbers, AWB tracking, or pincodes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DateRangeFilter value={dateRange} onChange={(range) => { setDateRange(range); setPage(1); }} />
          <button onClick={() => fetchShipmentsList()} className="premium-btn premium-btn-secondary" style={{ padding: '8px 14px' }}>
            <RefreshCcw size={14} />
            <span>Sync Feeds</span>
          </button>
        </div>
      </div>

      {/* Global Search & Filters Toolboard */}
      <div 
        className="premium-card" 
        style={{ 
          padding: '8px 12px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          flexWrap: 'wrap',
          backgroundColor: '#09090B',
          borderColor: '#27272A',
          minHeight: '50px'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '240px', maxWidth: '300px', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#737373' }} />
          <input
            type="text"
            className="premium-input"
            style={{ 
              paddingLeft: '32px', 
              height: '34px', 
              fontSize: '13px', 
              backgroundColor: '#18181B', 
              borderColor: '#27272A' 
            }}
            placeholder="Search shipments by Name, Phone, AWB, Order ID, Pincode..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Filter size={14} style={{ color: '#737373', flexShrink: 0 }} />

        {/* Status filter */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{ 
              width: 'auto', 
              minWidth: '120px', 
              padding: '6px 28px 6px 12px',
              height: '34px',
              fontSize: '13px',
              backgroundColor: '#18181B',
              borderColor: '#27272A',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none'
            }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Status (All)</option>
            <option value="Created">Created</option>
            <option value="Packing">Packing</option>
            <option value="Courier Selected">Courier Selected</option>
            <option value="Label Generated">Label Generated</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Call Placed Notification">📞 Call Placed</option>
            <option value="OFD">OFD (Out for Delivery)</option>
            <option value="Delivered">Delivered</option>
            <option value="Undelivered">Undelivered</option>
            <option value="Return">Returned</option>
            <option value="RDC">RDC Update</option>
            <option value="NDR">NDR Failure</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        {/* Courier filter */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{ 
              width: 'auto', 
              minWidth: '120px', 
              padding: '6px 28px 6px 12px',
              height: '34px',
              fontSize: '13px',
              backgroundColor: '#18181B',
              borderColor: '#27272A',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none'
            }}
            value={courierFilter}
            onChange={(e) => { setCourierFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Courier (All)</option>
            <option value="DTDC">DTDC</option>
            <option value="XpressBees">XpressBees</option>
            <option value="Delhivery">Delhivery</option>
            <option value="Aggregator">Aggregator</option>
            <option value="Velocity">Velocity</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        {/* Sort Select (Icon Only) */}
        <div 
          style={{ 
            position: 'relative', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginLeft: 'auto',
            width: '34px',
            height: '34px',
            backgroundColor: '#18181B',
            border: '1px solid #27272A',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
          title="Sort Options"
        >
          <ArrowUpDown size={14} style={{ color: '#FAFAFA' }} />
          <select
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none'
            }}
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            <option value="createdAt-desc">Created Date: Descending</option>
            <option value="createdAt-asc">Created Date: Ascending</option>
            <option value="orderValue-desc">Order Value: High to Low</option>
            <option value="orderValue-asc">Order Value: Low to High</option>
            <option value="weight-desc">Package Weight: Heavy to Light</option>
            <option value="weight-asc">Package Weight: Light to Heavy</option>
          </select>
        </div>
      </div>

      {/* Grid listing */}
      {loading ? (
        <div className="premium-card loading-overlay" style={{ minHeight: '220px' }}>
          <span className="spinner spinner-lg spinner-accent" />
          <span>Querying shipments database...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
          No shipments found matching search criteria.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="premium-table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer Recipient</th>
                  <th>Products</th>
                  <th>Courier & AWB</th>
                  <th>Billing details</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const isPartiallyPaid = o.partiallyPaidAmount !== undefined && o.partiallyPaidAmount > 0;
                  const isPrepaid = o.paymentType === 'Paid';
                  
                  return (
                    <tr 
                      key={o.id}
                      style={{
                        borderLeft: isPartiallyPaid ? '3px solid #10B981' : 'none',
                        backgroundColor: isPartiallyPaid ? 'rgba(16,185,129,0.08)' : 'transparent'
                      }}
                    >
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{o.orderId}</span>
                          {o.isVip && <span style={{ color: 'var(--color-vip)' }}>⭐</span>}
                        </div>
                        <span style={{ fontSize: '11px', color: '#737373', fontWeight: 'normal' }}>
                          {o.createdAt.split('T')[0]}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                        <div style={{ fontSize: '11.5px', color: '#737373' }}>
                          {o.phonePrimary} | {o.pincode} ({o.state})
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.productDetails}
                        </div>
                        <span style={{ fontSize: '11px', color: '#737373' }}>Weight: {o.weight} kg</span>
                      </td>
                      <td>
                        {o.awb ? (
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                               <CourierLogo courier={o.courier} size={14} />
                             </div>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#8A8A8A' }}>
                              {o.awb}
                            </span>
                            {o.eta && (
                              <div style={{ fontSize: '11px', color: '#10B981', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} />
                                <span>EDT: {o.eta}</span>
                              </div>
                            )}
                            {o.current_status && (
                              <div style={{ fontSize: '10.5px', color: '#A1A1AA', marginTop: '2px' }}>
                                Status: {o.current_status}
                              </div>
                            )}
                            {o.feNumber && (
                              <div style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 'bold', marginTop: '2px' }}>
                                FE: {o.feNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontSize: '11px', color: '#55555A' }}>AWB Pending</span>
                            {o.eta && (
                              <div style={{ fontSize: '11px', color: '#10B981', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} />
                                <span>EDT: {o.eta}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {isPartiallyPaid ? (
                            <span className="premium-badge badge-partial" style={{ width: 'fit-content' }}>Partially Paid</span>
                          ) : (
                            <span className={`premium-badge ${isPrepaid ? 'badge-paid' : 'badge-cod'}`} style={{ width: 'fit-content' }}>
                              {o.paymentType}
                            </span>
                          )}
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>
                            ₹{o.orderValue}
                          </span>
                          {isPartiallyPaid && (
                            <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 'bold' }}>
                              Paid: ₹{o.partiallyPaidAmount} | Bal: ₹{o.finalPayableAmount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`premium-badge status-${o.status.toLowerCase().replace(' ', '')}`}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleOnDemandWhatsAppTrack(o.id)}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.08)' }}
                            title="Send On-Demand WhatsApp Alert"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleVip(o)}
                            className="premium-btn premium-btn-secondary"
                            style={{ 
                              padding: '6px 8px', 
                              fontSize: '12px', 
                              borderColor: 'rgba(16, 185, 129, 0.4)', 
                              color: '#10B981', 
                              backgroundColor: o.isVip ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.04)' 
                            }}
                            title={o.isVip ? "Remove VIP Status" : "Mark as VIP"}
                          >
                            <Star size={14} fill={o.isVip ? "#10B981" : "none"} />
                          </button>
                          <button
                            onClick={() => handleCloneOrder(o)}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
                            title="Clone Order Information"
                          >
                            <Copy size={14} />
                          </button>
                          <InspectTooltipButton order={o} onClick={() => openOrderDetail(o)} iconSize={12} padding="6px 10px" showText={true} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#737373' }}>
              Showing {orders.length} of {totalCount} dispatches (Page {page} of {totalPages})
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="premium-btn premium-btn-secondary"
                style={{ padding: '6px 10px' }}
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="premium-btn premium-btn-secondary"
                style={{ padding: '6px 10px' }}
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipment Inspect Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', color: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Shipment: {selectedOrder.orderId}</span>
                {selectedOrder.isVip && <Star size={14} fill="var(--color-vip)" style={{ color: 'var(--color-vip)' }} />}
              </h3>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Order Info Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13.5px' }}>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Customer Recipient</span>
                  <span style={{ fontWeight: 600, color: '#FAFAFA' }}>{selectedOrder.customerName}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Phone Numbers</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>{selectedOrder.phonePrimary || 'N/A'} (Primary)</span>
                    <span>{selectedOrder.phoneSecondary || 'N/A'} (Secondary)</span>
                    <span>{selectedOrder.phoneTertiary || 'N/A'} (Tertiary)</span>
                  </div>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>State / Area</span>
                  <span>{selectedOrder.area}, {selectedOrder.state}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Pincode</span>
                  <span>{selectedOrder.pincode}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ color: '#737373', fontSize: '11px', textTransform: 'uppercase' }}>Shipping Destination Address</span>
                    <AddressRatingIndicator address={selectedOrder.address} />
                  </div>
                  <span>{selectedOrder.address}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Product Description</span>
                  <span>{selectedOrder.productDetails}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Payment Details</span>
                  {selectedOrder.partiallyPaidAmount !== undefined && selectedOrder.partiallyPaidAmount > 0 && selectedOrder.orderValue > selectedOrder.partiallyPaidAmount ? (
                    <span className="premium-badge badge-partial" style={{ marginTop: '4px', width: 'fit-content' }}>Partially Paid</span>
                  ) : (
                    <span className={`premium-badge ${selectedOrder.paymentType === 'Paid' ? 'badge-paid' : 'badge-cod'}`} style={{ marginTop: '4px', width: 'fit-content' }}>
                      {selectedOrder.paymentType}
                    </span>
                  )}
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Total Value</span>
                  <span style={{ fontWeight: 'bold' }}>₹{selectedOrder.orderValue}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Created By</span>
                  <span style={{ fontWeight: 600, color: '#FAFAFA' }}>{getUserDisplayName(selectedOrder.createdBy)}</span>
                </div>

                {selectedOrder.partiallyPaidAmount !== undefined && selectedOrder.partiallyPaidAmount > 0 && (
                  <>
                    <div>
                      <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Partially Paid Amount</span>
                      <span style={{ color: '#10B981', fontWeight: 600 }}>₹{selectedOrder.partiallyPaidAmount}</span>
                    </div>
                    <div>
                      <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Payable Balance</span>
                      <span style={{ color: '#10B981', fontWeight: 'bold' }}>₹{selectedOrder.finalPayableAmount}</span>
                    </div>
                  </>
                )}

                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Fulfillment Courier / AWB</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <CourierLogo courier={selectedOrder.courier} size={14} />
                    <span>/</span>
                    <span style={{ fontFamily: 'monospace' }}>{selectedOrder.awb || 'N/A'}</span>
                  </div>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Delivery Agent contact (FE)</span>
                  <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>{selectedOrder.feNumber || 'N/A'}</span>
                </div>

                {selectedOrder.assignedTo && (
                  <div>
                    <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Rider Ownership Assignment</span>
                    <span style={{ fontWeight: 'bold' }}>{selectedOrder.assignedTo}</span>
                  </div>
                )}
              </div>

              {/* History Timeline */}
              <div>
                <h4 style={{ fontSize: '13px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', borderBottom: '1px solid #1C1C21', paddingBottom: '6px' }}>
                  Fulfillment History Log
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px' }}>
                  {selectedOrder.history.map((hist, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                      {idx < selectedOrder.history.length - 1 && (
                        <div style={{ position: 'absolute', left: '6px', top: '16px', bottom: '-16px', width: '1px', backgroundColor: 'var(--border)' }} />
                      )}
                      
                      <div style={{
                        width: '13px',
                        height: '13px',
                        borderRadius: '50%',
                        backgroundColor: '#1E1E24',
                        border: '2px solid var(--border-focus)',
                        marginTop: '3px',
                        zIndex: 1
                      }} />

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA' }}>{hist.status}</span>
                          <span style={{ fontSize: '11px', color: '#737373' }}>
                            {new Date(hist.timestamp).toLocaleString()} | by {hist.updatedBy}
                          </span>
                        </div>
                        <p style={{ fontSize: '12.5px', color: '#8A8A8A', marginTop: '4px', lineHeight: '1.4' }}>
                          {hist.remarks}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
