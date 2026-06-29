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
  Printer
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';

export default function AllShipments() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchShipmentsList();
  }, [search, statusFilter, courierFilter, sortField, sortOrder, page]);

  const fetchShipmentsList = async () => {
    setLoading(true);
    try {
      // Fetch all dispatches. We can query `/api/orders`
      // We pass filters and pagination parameters.
      const url = `/api/orders?page=${page}&limit=50&search=${encodeURIComponent(search)}&status=${statusFilter}&sortField=${sortField}&sortOrder=${sortOrder}`;
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

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
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

        <button onClick={fetchShipmentsList} className="premium-btn premium-btn-secondary" style={{ padding: '8px 14px' }}>
          <RefreshCcw size={14} />
          <span>Sync Feeds</span>
        </button>
      </div>

      {/* Global Search & Filters Toolboard */}
      <div className="premium-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#737373' }} />
          <input
            type="text"
            className="premium-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Search shipments by Name, Phone, AWB, Order ID, Pincode..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} style={{ color: '#737373' }} />
            <span style={{ fontSize: '12px', color: '#737373', textTransform: 'uppercase' }}>Filter criteria:</span>
          </div>

          {/* Status filter */}
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '130px', padding: '6px 12px' }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Statuses</option>
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

          {/* Courier filter */}
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '120px', padding: '6px 12px' }}
            value={courierFilter}
            onChange={(e) => { setCourierFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Couriers</option>
            <option value="DTDC">DTDC</option>
            <option value="XpressBees">XpressBees</option>
            <option value="Delhivery">Delhivery</option>
            <option value="Aggregator">Aggregator</option>
          </select>

          {/* Sort field */}
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '140px', padding: '6px 12px', marginLeft: 'auto' }}
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
          >
            <option value="createdAt">Sort: Created Date</option>
            <option value="orderValue">Sort: Order Value</option>
            <option value="weight">Sort: Package Weight</option>
          </select>

          {/* Sort order */}
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '100px', padding: '6px 12px' }}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
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
                            <div style={{ fontWeight: 500, fontSize: '12.5px' }}>{o.courier}</div>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#8A8A8A' }}>
                              {o.awb}
                            </span>
                            {o.feNumber && (
                              <div style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 'bold', marginTop: '2px' }}>
                                FE: {o.feNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#55555A' }}>AWB Pending</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className={`premium-badge ${isPrepaid ? 'badge-paid' : 'badge-cod'}`} style={{ width: 'fit-content' }}>
                            {o.paymentType}
                          </span>
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
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => openOrderDetail(o)}
                          className="premium-btn premium-btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>
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
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Primary Phone</span>
                  <span>{selectedOrder.phonePrimary}</span>
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
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Shipping Destination Address</span>
                  <span>{selectedOrder.address}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Product Description</span>
                  <span>{selectedOrder.productDetails}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Payment Details</span>
                  <span className={`premium-badge ${selectedOrder.paymentType === 'Paid' ? 'badge-paid' : 'badge-cod'}`} style={{ marginTop: '4px', width: 'fit-content' }}>
                    {selectedOrder.paymentType}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Total Value</span>
                  <span style={{ fontWeight: 'bold' }}>₹{selectedOrder.orderValue}</span>
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
                  <span>{selectedOrder.courier || 'Unassigned'} / <span style={{ fontFamily: 'monospace' }}>{selectedOrder.awb || 'N/A'}</span></span>
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
