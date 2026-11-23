'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package, 
  Truck, 
  CheckCircle, 
  AlertCircle, 
  RefreshCcw, 
  Download, 
  Search,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { Order, OrderStats } from '@/lib/types';
import { CourierLogo } from '@/components/CourierLogo';
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'all',
    startDate: '',
    endDate: ''
  });
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    cod: 0,
    paid: 0,
    pendingPacking: 0,
    dispatched: 0,
    delivered: 0,
    ndr: 0,
    returns: 0,
    codValue: 0,
    paidValue: 0,
    courierCounts: {
      DTDC: 0,
      XpressBees: 0,
      Delhivery: 0,
      Shadowfax: 0,
      Velocity: 0,
    }
  });

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchOrders(dateRange.startDate, dateRange.endDate);
  }, [dateRange]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(dateRange.startDate, dateRange.endDate, true);
    }, 20000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const fetchOrders = async (start?: string, end?: string, isBackground = false) => {
    try {
      let statsUrl = '/api/orders/stats';
      let ordersUrl = '/api/orders?limit=10&sortField=createdAt&sortOrder=desc';
      const params: string[] = [];
      if (start) params.push(`startDate=${encodeURIComponent(start)}`);
      if (end) params.push(`endDate=${encodeURIComponent(end)}`);
      if (params.length > 0) {
        const query = `?${params.join('&')}`;
        statsUrl += query;
        ordersUrl += query;
      }

      const [statsRes, ordersRes] = await Promise.all([
        fetch(statsUrl),
        fetch(ordersUrl)
      ]);

      const [statsData, ordersData] = await Promise.all([
        statsRes.json(),
        ordersRes.json()
      ]);

      if (statsRes.ok && statsData.stats) {
        setStats(statsData.stats);
      }

      if (ordersRes.ok && ordersData.orders) {
        setRecentOrders(ordersData.orders.slice(0, 5));
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    let url = '/api/reports';
    const params: string[] = [];
    if (dateRange.startDate) params.push(`startDate=${encodeURIComponent(dateRange.startDate)}`);
    if (dateRange.endDate) params.push(`endDate=${encodeURIComponent(dateRange.endDate)}`);
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    window.open(url);
  };

  if (loading) {
    return <DashboardSkeleton variant="dashboard" />;
  }

  // Pure CSS bar chart data for Courier performance
  const courierStats = [
    { name: 'DTDC', count: stats.courierCounts?.DTDC ?? 0, color: '#FFFFFF' },
    { name: 'XpressBees', count: stats.courierCounts?.XpressBees ?? 0, color: '#888888' },
    { name: 'Delhivery', count: stats.courierCounts?.Delhivery ?? 0, color: '#444444' },
    { name: 'Shadowfax', count: stats.courierCounts?.Shadowfax ?? 0, color: '#FF6B00' },
    { name: 'Velocity', count: stats.courierCounts?.Velocity ?? 0, color: '#0066FF' }
  ];
  const maxCourierCount = Math.max(...courierStats.map(c => c.count), 1);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Welcome Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA', fontWeight: 700 }}>
            System Terminal Dashboard
          </h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Real-time fulfillment metrics, courier routing efficiency and logs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button onClick={() => fetchOrders(dateRange.startDate, dateRange.endDate)} className="premium-btn premium-btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCcw size={14} />
            <span>Reload Stream</span>
          </button>
          <button onClick={handleExportCsv} className="premium-btn premium-btn-primary" style={{ padding: '8px 12px' }}>
            <Download size={14} />
            <span>Export Orders (CSV)</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="premium-grid-4" style={{ gap: '16px' }}>
        {/* Card 1 */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Orders</span>
            <TrendingUp size={16} style={{ color: '#10B981' }} />
          </div>
          <div style={{ marginTop: 'auto' }}>
            <h3 style={{ fontSize: '32px', color: '#FAFAFA', fontWeight: 700 }}>{stats.total}</h3>
            <p style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>
              COD: {stats.cod} | Paid: {stats.paid}
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Packing</span>
            <Package size={16} style={{ color: '#3B82F6' }} />
          </div>
          <div style={{ marginTop: 'auto' }}>
            <h3 style={{ fontSize: '32px', color: '#FAFAFA', fontWeight: 700 }}>{stats.pendingPacking}</h3>
            <p style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>
              Awaiting packaging queue
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Dispatches</span>
            <Truck size={16} style={{ color: '#8B5CF6' }} />
          </div>
          <div style={{ marginTop: 'auto' }}>
            <h3 style={{ fontSize: '32px', color: '#FAFAFA', fontWeight: 700 }}>{stats.dispatched}</h3>
            <p style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>
              AWB allocated / Handed to courier
            </p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivered Packages</span>
            <CheckCircle size={16} style={{ color: '#10B981' }} />
          </div>
          <div style={{ marginTop: 'auto' }}>
            <h3 style={{ fontSize: '32px', color: '#FAFAFA', fontWeight: 700 }}>{stats.delivered}</h3>
            <p style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>
              Fulfillment Rate: {stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(0) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Sub Stats Row: Financials, NDRs and Returns */}
      <div className="premium-grid-3">
        <div className="premium-card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
            <TrendingUp size={20} style={{ margin: 'auto' }} />
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid Revenue Stream</p>
            <h4 style={{ fontSize: '20px', color: '#FAFAFA', fontWeight: 700, marginTop: '2px' }}>₹{stats.paidValue.toLocaleString('en-IN')}.00</h4>
          </div>
        </div>

        <div className="premium-card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
            <AlertCircle size={20} style={{ margin: 'auto' }} />
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NDR Escales Pending</p>
            <h4 style={{ fontSize: '20px', color: '#FAFAFA', fontWeight: 700, marginTop: '2px' }}>{stats.ndr} Exception Cases</h4>
          </div>
        </div>

        <div className="premium-card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(244, 63, 94, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F43F5E' }}>
            <TrendingDown size={20} style={{ margin: 'auto' }} />
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Returns & RTO (RDC)</p>
            <h4 style={{ fontSize: '20px', color: '#FAFAFA', fontWeight: 700, marginTop: '2px' }}>{stats.returns} Return Parcels</h4>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Split Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '7fr 5fr',
        gap: '24px'
      }} className="desktop-analytics-split">
        {/* Left Card: Recent activity lists */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#FAFAFA' }}>Recent Orders Stream</h3>
            <a href="/dashboard/orders" style={{ fontSize: '12px', color: '#8A8A8A', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View all</span>
              <ArrowRight size={12} />
            </a>
          </div>

          <div className="premium-table-container" style={{ border: 'none' }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.orderId}</td>
                    <td>
                      <div>
                        <div>{o.customerName}</div>
                        <div style={{ fontSize: '11px', color: '#737373' }}>{o.pincode} | {o.state}</div>
                      </div>
                    </td>
                    <td>₹{o.orderValue}</td>
                    <td>
                      {o.partiallyPaidAmount !== undefined && o.partiallyPaidAmount > 0 && o.orderValue > o.partiallyPaidAmount ? (
                        <span className="premium-badge badge-partial">Partially Paid</span>
                      ) : (
                        <span className={`premium-badge ${o.paymentType === 'Paid' ? 'badge-paid' : 'badge-cod'}`}>
                          {o.paymentType}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`premium-badge status-${o.status.toLowerCase().replace(' ', '')}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Card: High fidelity pure-CSS graph representation for Courier Analytics */}
        <div className="premium-card">
          <h3 style={{ fontSize: '16px', color: '#FAFAFA', marginBottom: '24px' }}>
            Courier Performance Allocation
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {courierStats.map((c) => {
              const pct = (c.count / maxCourierCount) * 100;
              return (
                <div key={c.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', alignItems: 'center' }}>
                    <span style={{ color: '#FAFAFA', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CourierLogo courier={c.name} size={14} />
                    </span>
                    <span style={{ color: '#737373' }}>{c.count} shipments</span>
                  </div>
                  <div style={{
                    height: '8px',
                    width: '100%',
                    backgroundColor: '#161619',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      backgroundColor: c.color,
                      borderRadius: '4px',
                      transition: 'width 0.8s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: '32px',
            backgroundColor: '#0A0A0A',
            border: '1px solid #1C1C21',
            borderRadius: '6px',
            padding: '16px',
            fontSize: '12px'
          }}>
            <h4 style={{ fontWeight: 600, color: '#FAFAFA', marginBottom: '6px' }}>Fulfillment Engine Insights</h4>
            <p style={{ color: '#737373', lineHeight: '1.6' }}>
              The auto-courier selection allocates DTDC for shipments under 1kg to optimize logistics overhead. Delhivery operates the heavy parcel routes (+2kg).
            </p>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @media screen and (max-width: 1024px) {
          .desktop-analytics-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
