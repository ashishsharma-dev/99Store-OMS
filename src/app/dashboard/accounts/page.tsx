'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Check,
  Clock,
  Download,
  RefreshCcw,
  ChevronDown,
  DollarSign,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Order } from '@/lib/types';
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter';
import { CourierLogo } from '@/components/CourierLogo';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { getUserDisplayName } from '@/lib/utils';

function getOrderCollectibleBalance(order: Order): number {
  const total = Number(order.orderValue || 0);
  if (order.paymentType === 'Paid' || order.isPaymentSettled) return 0;
  const partial = Number(order.partiallyPaidAmount || 0);
  return Math.max(0, total - partial);
}

function getOrderCollectedAmount(order: Order): number {
  const total = Number(order.orderValue || 0);
  if (order.paymentType === 'Paid' || order.isPaymentSettled) return total;
  return Math.max(0, Number(order.partiallyPaidAmount || 0));
}

export default function AccountsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'all',
    startDate: '',
    endDate: '',
  });
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [settlementFilter, setSettlementFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [displayLimit, setDisplayLimit] = useState(50);

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      let url = `/api/orders?limit=500&search=${encodeURIComponent(search)}&payment=${encodeURIComponent(paymentFilter)}&paymentSettled=${encodeURIComponent(settlementFilter)}&status=${encodeURIComponent(statusFilter)}&courier=${encodeURIComponent(courierFilter)}&sortField=createdAt&sortOrder=desc`;
      if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
      if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
        setTotalCount(data.pagination?.totalCount ?? data.orders.length);
      }
    } catch (error) {
      console.error('Failed to fetch accounts orders:', error);
    } finally {
      setLoading(false);
    }
  }, [search, paymentFilter, settlementFilter, statusFilter, courierFilter, dateRange]);

  useEffect(() => {
    setDisplayLimit(50);
    setSelectedIds([]);
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 350) {
        setDisplayLimit(prev => Math.min(prev + 30, orders.length));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [orders.length]);

  const handleToggleMarkPaid = async (order: Order) => {
    if (order.paymentType === 'Paid') return;
    setUpdatingId(order.id);
    try {
      const nextSettled = !order.isPaymentSettled;
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaymentSettled: nextSettled }),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setOrders(prev => prev.map(item => (item.id === data.order.id ? data.order : item)));
      } else {
        alert(data?.error || 'Failed to update payment status.');
      }
    } catch {
      alert('Network error updating payment settlement.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBulkSettlement = async (markPaid: boolean) => {
    const targetOrders = orders.filter(o => selectedIds.includes(o.id) && o.paymentType !== 'Paid');
    if (targetOrders.length === 0) {
      alert('Select at least one COD or Partially Paid order to update settlement status.');
      return;
    }

    setBulkUpdating(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: targetOrders.map(o => o.id),
          isPaymentSettled: markPaid,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedIds([]);
        await fetchOrders();
      } else {
        alert(data?.error || 'Failed to execute bulk settlement update.');
      }
    } catch {
      alert('Network error executing bulk payment update.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === orders.length && orders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map(o => o.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleExportCsv = () => {
    let url = `/api/reports?status=${encodeURIComponent(statusFilter)}&payment=${encodeURIComponent(paymentFilter)}&paymentSettled=${encodeURIComponent(settlementFilter)}&courier=${encodeURIComponent(courierFilter)}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
    if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
    window.open(url);
  };

  const handleResetFilters = () => {
    setSearch('');
    setPaymentFilter('all');
    setSettlementFilter('all');
    setStatusFilter('all');
    setCourierFilter('all');
    setDateRange({ preset: 'all', startDate: '', endDate: '' });
  };

  if (currentUser && !['Super Admin', 'Accounts Team'].includes(currentUser.role)) {
    return (
      <div className="premium-card" style={{ padding: '40px', textAlign: 'center', color: '#F87171' }}>
        Access denied. Accounts &amp; Payment Tracking is restricted to Super Admin and Accounts Team.
      </div>
    );
  }

  const totalValue = orders.reduce((sum, o) => sum + Number(o.orderValue || 0), 0);
  const settledOrders = orders.filter(o => o.paymentType === 'Paid' || o.isPaymentSettled);
  const settledValue = orders.reduce((sum, o) => sum + getOrderCollectedAmount(o), 0);
  const unsettledOrders = orders.filter(o => o.paymentType !== 'Paid' && !o.isPaymentSettled);
  const pendingCollectibleValue = orders.reduce((sum, o) => sum + getOrderCollectibleBalance(o), 0);
  const partialOrders = orders.filter(o => Number(o.partiallyPaidAmount || 0) > 0 && Number(o.orderValue || 0) > Number(o.partiallyPaidAmount || 0));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={26} style={{ color: '#10B981' }} />
            <span>Accounts &amp; Payment Reconciliation</span>
          </h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Track Prepaid, COD, and Partially Paid orders. Use the Mark Paid checkboxes to reconcile received payments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button onClick={fetchOrders} className="premium-btn premium-btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCcw size={14} />
            <span>Refresh</span>
          </button>
          <button onClick={handleExportCsv} className="premium-btn premium-btn-primary" style={{ padding: '8px 12px' }}>
            <Download size={14} />
            <span>Export Accounts CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="premium-grid-4" style={{ gap: '16px' }}>
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase' }}>Total Orders Value</span>
            <DollarSign size={16} style={{ color: '#3B82F6' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '26px', color: '#FAFAFA', fontWeight: 700 }}>
              ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
            <p style={{ fontSize: '11.5px', color: '#737373', marginTop: '4px' }}>
              {totalCount} matching orders ({orders.length} loaded)
            </p>
          </div>
        </div>

        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase' }}>Paid / Settled Amount</span>
            <CheckCircle2 size={16} style={{ color: '#10B981' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '26px', color: '#34D399', fontWeight: 700 }}>
              ₹{settledValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
            <p style={{ fontSize: '11.5px', color: '#737373', marginTop: '4px' }}>
              {settledOrders.length} orders marked Paid / Prepaid
            </p>
          </div>
        </div>

        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase' }}>Pending Collection</span>
            <AlertCircle size={16} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '26px', color: '#FBBF24', fontWeight: 700 }}>
              ₹{pendingCollectibleValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
            <p style={{ fontSize: '11.5px', color: '#737373', marginTop: '4px' }}>
              {unsettledOrders.length} unsettled COD / Partial orders
            </p>
          </div>
        </div>

        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase' }}>Partially Paid</span>
            <Clock size={16} style={{ color: '#A78BFA' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '26px', color: '#FAFAFA', fontWeight: 700 }}>
              {partialOrders.length} Orders
            </h3>
            <p style={{ fontSize: '11.5px', color: '#737373', marginTop: '4px' }}>
              Advance collected: ₹{partialOrders.reduce((s, o) => s + Number(o.partiallyPaidAmount || 0), 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div
        className="premium-card"
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          backgroundColor: '#09090B',
          borderColor: '#27272A',
        }}
      >
        <div style={{ position: 'relative', minWidth: '220px', maxWidth: '300px', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#737373' }} />
          <input
            type="text"
            className="premium-input"
            style={{ paddingLeft: '32px', height: '34px', fontSize: '13px', backgroundColor: '#18181B', borderColor: '#27272A' }}
            placeholder="Search Order ID, Customer, Phone, AWB..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Filter size={14} style={{ color: '#737373', flexShrink: 0 }} />

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '140px', padding: '6px 28px 6px 12px', height: '34px', fontSize: '13px', backgroundColor: '#18181B', borderColor: '#10B981', appearance: 'none', cursor: 'pointer' }}
            value={settlementFilter}
            onChange={(e) => setSettlementFilter(e.target.value)}
          >
            <option value="all">Settlement (All)</option>
            <option value="settled">Marked Paid / Prepaid</option>
            <option value="unsettled">Payment Pending</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '135px', padding: '6px 28px 6px 12px', height: '34px', fontSize: '13px', backgroundColor: '#18181B', borderColor: '#27272A', appearance: 'none', cursor: 'pointer' }}
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">Payment Type (All)</option>
            <option value="Paid">Prepaid (Paid)</option>
            <option value="COD">COD (All COD)</option>
            <option value="Pure COD">COD (Unpaid Only)</option>
            <option value="Partially Paid">Partially Paid</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '130px', padding: '6px 28px 6px 12px', height: '34px', fontSize: '13px', backgroundColor: '#18181B', borderColor: '#27272A', appearance: 'none', cursor: 'pointer' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Status (All)</option>
            <option value="Created">Created</option>
            <option value="Packing">Packing</option>
            <option value="Label Generated">Label Generated</option>
            <option value="Dispatched">Dispatched</option>
            <option value="OFD">OFD</option>
            <option value="Delivered">Delivered</option>
            <option value="Undelivered">Undelivered</option>
            <option value="NDR">NDR</option>
            <option value="Return">Return</option>
            <option value="RDC">RDC</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{ width: 'auto', minWidth: '130px', padding: '6px 28px 6px 12px', height: '34px', fontSize: '13px', backgroundColor: '#18181B', borderColor: '#27272A', appearance: 'none', cursor: 'pointer' }}
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
          >
            <option value="all">Courier (All)</option>
            <option value="DTDC">DTDC</option>
            <option value="XpressBees">XpressBees</option>
            <option value="Delhivery">Delhivery</option>
            <option value="Shadowfax">Shadowfax</option>
            <option value="Unassigned">Unassigned</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        {(search || paymentFilter !== 'all' || settlementFilter !== 'all' || statusFilter !== 'all' || courierFilter !== 'all' || dateRange.preset !== 'all') && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="premium-btn premium-btn-secondary"
            style={{ height: '34px', padding: '0 10px', fontSize: '12px', color: '#F87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Bulk Settlement Bar */}
      {selectedIds.length > 0 && (
        <div
          className="premium-card animate-fade-in"
          style={{
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#111113',
            borderColor: '#10B981',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#FAFAFA', fontWeight: 600 }}>
            {selectedIds.length} order(s) selected
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleBulkSettlement(true)}
              disabled={bulkUpdating}
              className="premium-btn premium-btn-primary"
              style={{ padding: '6px 14px', fontSize: '12.5px', backgroundColor: '#10B981', borderColor: '#10B981' }}
            >
              <Check size={14} />
              <span>{bulkUpdating ? 'Updating...' : 'Mark Paid (Selected)'}</span>
            </button>
            <button
              onClick={() => handleBulkSettlement(false)}
              disabled={bulkUpdating}
              className="premium-btn premium-btn-secondary"
              style={{ padding: '6px 14px', fontSize: '12.5px', borderColor: '#F59E0B', color: '#FBBF24' }}
            >
              Mark Pending
            </button>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      {loading ? (
        <DashboardSkeleton variant="table" rows={8} />
      ) : orders.length === 0 ? (
        <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
          No orders match the current accounting filters.
        </div>
      ) : (
        <div className="premium-table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th style={{ width: '40px', paddingLeft: '14px' }}>
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedIds.length === orders.length}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                </th>
                <th>Order ID &amp; Date</th>
                <th>Customer &amp; Contact</th>
                <th>Status &amp; Courier</th>
                <th>Payment Mode</th>
                <th>Order Value / Balance</th>
                <th>Mark Paid (Payment Track)</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, displayLimit).map((o) => {
                const isPaid = o.paymentType === 'Paid';
                const isSettled = isPaid || Boolean(o.isPaymentSettled);
                const partial = Number(o.partiallyPaidAmount || 0);
                const isPartial = partial > 0 && Number(o.orderValue || 0) > partial;
                const collectible = getOrderCollectibleBalance(o);
                const contactPhone = o.phoneTertiary || o.phoneWhatsApp || o.phonePrimary;

                return (
                  <tr
                    key={o.id}
                    style={{
                      borderLeft: isSettled ? '3px solid #10B981' : isPartial ? '3px solid #A78BFA' : '3px solid transparent',
                      backgroundColor: isSettled ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                    }}
                  >
                    <td style={{ paddingLeft: '14px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(o.id)}
                        onChange={() => handleSelectOne(o.id)}
                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.orderId}</div>
                      <div style={{ fontSize: '11px', color: '#737373' }}>{o.createdAt.split('T')[0]}</div>
                      {o.createdBy && (
                        <div style={{ fontSize: '10.5px', color: '#A1A1AA' }}>By: {getUserDisplayName(o.createdBy)}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#FAFAFA' }}>{o.customerName}</div>
                      <div style={{ fontSize: '11.5px', color: '#A1A1AA', fontFamily: 'monospace' }}>{contactPhone}</div>
                      <div style={{ fontSize: '11px', color: '#737373' }}>{o.area}, {o.state} - {o.pincode}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span className={`premium-badge status-${o.status.toLowerCase().replace(' ', '')}`}>
                          {o.status}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#A1A1AA' }}>
                          {o.courier ? <CourierLogo courier={o.courier} size={12} /> : <span>Unassigned</span>}
                          {o.awb && <span style={{ fontFamily: 'monospace', color: '#737373' }}>{o.awb}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {isPartial ? (
                        <span className="premium-badge badge-partial">Partially Paid</span>
                      ) : (
                        <span className={`premium-badge ${isPaid ? 'badge-paid' : 'badge-cod'}`}>
                          {o.paymentType}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#FAFAFA' }}>₹{Number(o.orderValue || 0).toFixed(2)}</div>
                      {isPartial && (
                        <div style={{ fontSize: '10.5px', color: '#A78BFA' }}>
                          Adv: ₹{partial.toFixed(2)}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: collectible > 0 ? '#FBBF24' : '#34D399', fontWeight: 600 }}>
                        {collectible > 0 ? `Due: ₹${collectible.toFixed(2)}` : 'Settled: ₹0.00 due'}
                      </div>
                    </td>
                    <td>
                      {isPaid ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#34D399', fontSize: '12px', fontWeight: 600 }}>
                          <input type="checkbox" checked readOnly disabled style={{ accentColor: '#10B981', width: '16px', height: '16px' }} />
                          <span>Prepaid (Paid)</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: updatingId === o.id ? 'wait' : 'pointer',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              color: o.isPaymentSettled ? '#34D399' : '#E4E4E7',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(o.isPaymentSettled)}
                              disabled={updatingId === o.id}
                              onChange={() => handleToggleMarkPaid(o)}
                              style={{ accentColor: '#10B981', width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span>{updatingId === o.id ? 'Saving...' : o.isPaymentSettled ? 'Marked Paid ✓' : 'Mark Paid'}</span>
                          </label>
                          {o.isPaymentSettled && o.paymentSettledBy && (
                            <span style={{ fontSize: '10.5px', color: '#737373' }}>
                              By {getUserDisplayName(o.paymentSettledBy).split(' (')[0]}
                              {o.paymentSettledAt ? ` · ${o.paymentSettledAt.split('T')[0]}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
