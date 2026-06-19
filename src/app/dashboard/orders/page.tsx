'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Star, 
  Check, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Printer,
  Barcode
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Printing label popup state
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [showPrintLabel, setShowPrintLabel] = useState(false);

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [phonePrimary, setPhonePrimary] = useState('');
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [phoneTertiary, setPhoneTertiary] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [area, setArea] = useState('');
  const [productDetails, setProductDetails] = useState('');
  const [paymentType, setPaymentType] = useState<'COD' | 'Paid'>('Paid');
  const [orderValue, setOrderValue] = useState('');
  const [weight, setWeight] = useState('');
  const [internalRemarks, setInternalRemarks] = useState('');
  const [isVip, setIsVip] = useState(false);
  
  const [pincodeFetching, setPincodeFetching] = useState(false);
  const [pincodeSuccess, setPincodeSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [vipFilter, setVipFilter] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Current session user
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
  }, []);

  useEffect(() => {
    fetchOrdersList();
  }, [search, statusFilter, paymentFilter, vipFilter, sortField, sortOrder, page]);

  // Autofetch State/Area via Pincode API when 6 digits are typed
  useEffect(() => {
    if (pincode.length === 6 && /^\d+$/.test(pincode)) {
      fetchPincodeData(pincode);
    } else {
      setPincodeSuccess(false);
    }
  }, [pincode]);

  const fetchPincodeData = async (pin: string) => {
    setPincodeFetching(true);
    try {
      const res = await fetch(`/api/integrations/pincode?pincode=${pin}`);
      const data = await res.json();
      setPincodeFetching(false);
      if (res.ok && data.state) {
        setState(data.state);
        setArea(data.area);
        setPincodeSuccess(true);
      }
    } catch (err) {
      setPincodeFetching(false);
      console.error('Failed to fetch pincode:', err);
    }
  };

  const fetchOrdersList = async () => {
    setLoading(true);
    try {
      const url = `/api/orders?page=${page}&limit=50&search=${encodeURIComponent(search)}&status=${statusFilter}&payment=${paymentFilter}&vip=${vipFilter}&sortField=${sortField}&sortOrder=${sortOrder}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.totalCount || 0);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customerName || !phonePrimary || !address || !pincode || !productDetails || !orderValue || !weight) {
      setFormError('Please enter all required fields.');
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          phonePrimary,
          phoneSecondary,
          phoneTertiary,
          address,
          pincode,
          state,
          area,
          productDetails,
          paymentType,
          orderValue: parseFloat(orderValue),
          weight: parseFloat(weight),
          internalRemarks,
          isVip,
          createdBy: currentUser?.username || 'admin'
        })
      });

      const data = await res.json();
      setFormLoading(false);

      if (!res.ok) {
        setFormError(data.error || 'Failed to create order.');
        return;
      }

      // Reset Form and refresh
      setShowAddModal(false);
      resetForm();
      fetchOrdersList();
    } catch (err) {
      setFormLoading(false);
      setFormError('Network connection failure.');
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setPhonePrimary('');
    setPhoneSecondary('');
    setPhoneTertiary('');
    setAddress('');
    setPincode('');
    setState('');
    setArea('');
    setProductDetails('');
    setPaymentType('Paid');
    setOrderValue('');
    setWeight('');
    setInternalRemarks('');
    setIsVip(false);
    setFormError('');
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const handleExportCsv = () => {
    const url = `/api/reports?status=${statusFilter}&payment=${paymentFilter}&vip=${vipFilter}`;
    window.open(url);
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
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>Manual Order Management</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Manual order additions, bulk filters sorting and reports download.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExportCsv} className="premium-btn premium-btn-secondary">
            <Download size={14} />
            <span>Download CSV (Filtered)</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="premium-btn premium-btn-primary">
            <Plus size={14} />
            <span>Create Manual Order</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar Card */}
      <div className="premium-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Row 1: Global Search */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#737373' }} />
            <input
              type="text"
              className="premium-input"
              style={{ paddingLeft: '38px' }}
              placeholder="Global Search: Name, Phone, Order ID, AWB, Address..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Row 2: Dropdown Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} style={{ color: '#737373' }} />
            <span style={{ fontSize: '12px', color: '#737373', textTransform: 'uppercase' }}>Filters:</span>
          </div>

          {/* Filter Status */}
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
            <option value="OFD">OFD (Out for Delivery)</option>
            <option value="Delivered">Delivered</option>
            <option value="Undelivered">Undelivered</option>
            <option value="Return">Returned</option>
            <option value="RDC">RDC Update</option>
            <option value="NDR">NDR Failure</option>
          </select>

          {/* Filter Payment */}
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '120px', padding: '6px 12px' }}
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Payments</option>
            <option value="Paid">Prepaid (Paid)</option>
            <option value="COD">Cash on Delivery (COD)</option>
          </select>

          {/* Filter VIP */}
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '120px', padding: '6px 12px' }}
            value={vipFilter}
            onChange={(e) => { setVipFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All VIP Tags</option>
            <option value="true">⭐ VIP Only</option>
            <option value="false">Non-VIP</option>
          </select>

          {/* Sort By Field */}
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

          {/* Sort Direction */}
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

      {/* Main Table Listing */}
      {loading ? (
        <div style={{ color: '#737373', fontSize: '14px', padding: '20px 0' }}>Retrieving order lists...</div>
      ) : orders.length === 0 ? (
        <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
          No records match the active query. Try broadening your filter selections or search terms.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="premium-table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer Details</th>
                  <th>Products</th>
                  <th>Payment Type</th>
                  <th>Order Value</th>
                  <th>Status</th>
                  <th>Tracking</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const isOrderPaid = o.paymentType === 'Paid';
                  return (
                    <tr 
                      key={o.id}
                      style={{
                        // 🟢 Paid Orders Highlight
                        borderLeft: isOrderPaid ? '3px solid var(--color-paid)' : 'none',
                        // Subtle highlight
                        backgroundColor: isOrderPaid ? 'rgba(16,185,129,0.01)' : 'transparent'
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.orderId}</span>
                          {/* ⭐ VIP Indicator */}
                          {o.isVip && (
                            <span title="VIP Customer" style={{ color: 'var(--color-vip)', display: 'inline-flex' }}>
                              <Star size={12} fill="var(--color-vip)" />
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#737373' }}>{o.createdAt.split('T')[0]}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                        <div style={{ fontSize: '11.5px', color: '#737373' }}>
                          {o.phonePrimary} | {o.area}, {o.state}
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.productDetails}
                        </div>
                        <span style={{ fontSize: '11px', color: '#737373' }}>Weight: {o.weight} kg</span>
                      </td>
                      <td>
                        <span className={`premium-badge ${isOrderPaid ? 'badge-paid' : 'badge-cod'}`}>
                          {o.paymentType}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{o.orderValue.toFixed(2)}</td>
                      <td>
                        <span className={`premium-badge status-${o.status.toLowerCase().replace(' ', '')}`}>
                          {o.status}
                        </span>
                      </td>
                      <td>
                        {o.awb ? (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 500 }}>{o.courier}</div>
                            <div style={{ fontSize: '11px', color: '#737373', fontFamily: 'monospace' }}>{o.awb}</div>
                            <button
                              onClick={() => handlePrintLabel(o)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#3B82F6',
                                fontSize: '11px',
                                padding: 0,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                display: 'block',
                                marginTop: '2px',
                                textAlign: 'left'
                              }}
                            >
                              Print Label
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#55555A' }}>AWB Pending</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => openOrderDetail(o)}
                          className="premium-btn premium-btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        >
                          <Eye size={12} />
                          <span>View Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Custom Pagination Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#737373' }}>
              Showing {orders.length} of {totalCount} records (Page {page} of {totalPages})
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

      {/* MODAL 1: Create Manual Order */}
      {showAddModal && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', color: '#FAFAFA' }}>Create New Manual Order</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {formError && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF6868', borderRadius: '6px', padding: '10px 14px', fontSize: '13px' }}>
                  {formError}
                </div>
              )}

              {/* Sub-section: Customer Details */}
              <div>
                <h4 style={{ fontSize: '13px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid #1C1C21', paddingBottom: '6px' }}>
                  1. Customer Shipping Details
                </h4>

                <div className="premium-grid-2" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Full Name *</label>
                    <input type="text" className="premium-input" placeholder="Aditya Birla" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Primary Phone *</label>
                    <input type="tel" className="premium-input" placeholder="9876543210" value={phonePrimary} onChange={(e) => setPhonePrimary(e.target.value.replace(/\D/g, ''))} required />
                  </div>
                </div>

                <div className="premium-grid-2" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Secondary Phone</label>
                    <input type="tel" className="premium-input" placeholder="9876543211" value={phoneSecondary} onChange={(e) => setPhoneSecondary(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Third Phone</label>
                    <input type="tel" className="premium-input" placeholder="9876543212" value={phoneTertiary} onChange={(e) => setPhoneTertiary(e.target.value.replace(/\D/g, ''))} />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Complete Address *</label>
                  <input type="text" className="premium-input" placeholder="Flat 402, Sunset Heights, Bandra West" value={address} onChange={(e) => setAddress(e.target.value)} required />
                </div>

                <div className="premium-grid-3">
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Pincode (6 Digits) *</label>
                    <input type="text" maxLength={6} className="premium-input" placeholder="400050" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))} required />
                    {pincodeFetching && <span style={{ fontSize: '10px', color: '#737373' }}>Validating pin...</span>}
                    {pincodeSuccess && <span style={{ fontSize: '10px', color: 'var(--color-paid)' }}>🟢 Autofetch active</span>}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>State (Autofill)</label>
                    <input type="text" className="premium-input" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Area/District</label>
                    <input type="text" className="premium-input" placeholder="Area" value={area} onChange={(e) => setArea(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Sub-section: Order Details */}
              <div>
                <h4 style={{ fontSize: '13px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid #1C1C21', paddingBottom: '6px' }}>
                  2. Product & Value Details
                </h4>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Product Description *</label>
                  <input type="text" className="premium-input" placeholder="e.g. 99Store Premium Ceramic Coffee Mug - Matte Black" value={productDetails} onChange={(e) => setProductDetails(e.target.value)} required />
                </div>

                <div className="premium-grid-3" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Payment Type *</label>
                    <select className="premium-input" value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)}>
                      <option value="Paid">Prepaid (Paid)</option>
                      <option value="COD">Cash on Delivery (COD)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Value (INR) *</label>
                    <input type="number" className="premium-input" placeholder="999" value={orderValue} onChange={(e) => setOrderValue(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Weight (kg) *</label>
                    <input type="number" step="0.01" className="premium-input" placeholder="0.6" value={weight} onChange={(e) => setWeight(e.target.value)} required />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Internal Fulfillment Remarks</label>
                  <textarea className="premium-input" placeholder="e.g. Handle with care, fragile item..." style={{ minHeight: '60px', resize: 'vertical' }} value={internalRemarks} onChange={(e) => setInternalRemarks(e.target.value)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="vip_tag" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--color-vip)' }} />
                  <label htmlFor="vip_tag" style={{ fontSize: '13px', color: '#FAFAFA', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <span>Mark as ⭐ VIP Order (VIP Badge indicator applied)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="premium-btn premium-btn-secondary">Cancel</button>
                <button type="submit" className="premium-btn premium-btn-primary" disabled={formLoading}>
                  {formLoading ? 'Creating order...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Order Detail Summary & Timelines */}
      {showDetailModal && selectedOrder && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', color: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Order Details: {selectedOrder.orderId}</span>
                {selectedOrder.isVip && <Star size={14} fill="var(--color-vip)" style={{ color: 'var(--color-vip)' }} />}
              </h3>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Order Info Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13.5px' }}>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Customer Name</span>
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
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Shipping Address</span>
                  <span>{selectedOrder.address}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Product Description</span>
                  <span>{selectedOrder.productDetails}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Payment Type</span>
                  <span className={`premium-badge ${selectedOrder.paymentType === 'Paid' ? 'badge-paid' : 'badge-cod'}`} style={{ marginTop: '4px' }}>
                    {selectedOrder.paymentType}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Order Value</span>
                  <span style={{ fontWeight: 'bold' }}>₹{selectedOrder.orderValue}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Fulfillment Courier</span>
                  <span>{selectedOrder.courier || 'Unassigned'}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>AWB / Tracking</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'monospace' }}>{selectedOrder.awb || 'N/A'}</span>
                    {selectedOrder.awb && (
                      <button
                        onClick={() => handlePrintLabel(selectedOrder)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3B82F6',
                          fontSize: '11.5px',
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

              {/* Order History Timeline */}
              <div>
                <h4 style={{ fontSize: '13px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', borderBottom: '1px solid #1C1C21', paddingBottom: '6px' }}>
                  Fulfillment History Log
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px' }}>
                  {selectedOrder.history.map((hist, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                      {/* Timeline Connector Line */}
                      {idx < selectedOrder.history.length - 1 && (
                        <div style={{ position: 'absolute', left: '6px', top: '16px', bottom: '-16px', width: '1px', backgroundColor: 'var(--border)' }} />
                      )}
                      
                      {/* Timeline Dot */}
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
    </div>
  );
}
