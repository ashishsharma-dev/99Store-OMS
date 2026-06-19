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
import { Order } from '@/lib/types';

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    cod: 0,
    paid: 0,
    pendingPacking: 0,
    dispatched: 0,
    delivered: 0,
    ndr: 0,
    returns: 0,
    codValue: 0,
    paidValue: 0
  });

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?limit=100');
      const data = await res.json();
      if (res.ok && data.orders) {
        const allOrders: Order[] = data.orders;
        setOrders(allOrders);

        // Compute metrics
        let cod = 0;
        let paid = 0;
        let pendingPacking = 0;
        let dispatched = 0;
        let delivered = 0;
        let ndr = 0;
        let returns = 0;
        let codValue = 0;
        let paidValue = 0;

        allOrders.forEach(o => {
          if (o.paymentType === 'COD') {
            cod++;
            codValue += o.orderValue;
          } else {
            paid++;
            paidValue += o.orderValue;
          }

          if (o.status === 'Created' || o.status === 'Packing') {
            pendingPacking++;
          } else if (['Courier Selected', 'Label Generated', 'Dispatched', 'OFD'].includes(o.status)) {
            dispatched++;
          } else if (o.status === 'Delivered') {
            delivered++;
          } else if (o.status === 'NDR') {
            ndr++;
          } else if (o.status === 'Return' || o.status === 'RDC') {
            returns++;
          }
        });

        setStats({
          total: allOrders.length,
          cod,
          paid,
          pendingPacking,
          dispatched,
          delivered,
          ndr,
          returns,
          codValue,
          paidValue
        });

        // Set top 5 recent orders
        setRecentOrders(allOrders.slice(0, 5));
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    window.open('/api/reports');
  };

  if (loading) {
    return (
      <div style={{ padding: '20px 0', color: '#737373', fontSize: '14px' }}>
        Retrieving real-time analytics stream...
      </div>
    );
  }

  // Pure CSS bar chart data for Courier performance
  const courierStats = [
    { name: 'DTDC', count: orders.filter(o => o.courier === 'DTDC').length, color: '#FFFFFF' },
    { name: 'XpressBees', count: orders.filter(o => o.courier === 'XpressBees').length, color: '#888888' },
    { name: 'Delhivery', count: orders.filter(o => o.courier === 'Delhivery').length, color: '#444444' },
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

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchOrders} className="premium-btn premium-btn-secondary" style={{ padding: '8px 12px' }}>
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
                      <span className={`premium-badge ${o.paymentType === 'Paid' ? 'badge-paid' : 'badge-cod'}`}>
                        {o.paymentType}
                      </span>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: '#FAFAFA', fontWeight: 500 }}>{c.name}</span>
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
        @media (max-width: 1024px) {
          .desktop-analytics-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
