'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  RefreshCcw,
  Award,
  TrendingUp,
  Package,
  Truck,
  CheckCircle2,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { Order, NdrRecord, User as DbUser, OrderStatus } from '@/lib/types';
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter';
import { CourierLogo } from '@/components/CourierLogo';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { getUserDisplayName } from '@/lib/utils';

const BOOKED_STATUSES = new Set([
  'Dispatched',
  'Call Placed Notification',
  'RDC',
  'OFD',
  'Delivered',
  'Undelivered',
  'NDR',
  'Return',
]);

const ALL_STATUSES: OrderStatus[] = [
  'Created',
  'Packing',
  'Courier Selected',
  'Label Generated',
  'Dispatched',
  'Call Placed Notification',
  'RDC',
  'OFD',
  'Delivered',
  'Undelivered',
  'NDR',
  'Return',
];

function toLocalDateKey(isoStr: string): string {
  const dt = new Date(isoStr);
  if (Number.isNaN(dt.getTime())) return String(isoStr || '').slice(0, 10) || 'Unknown';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  const clean = str.replace(/"/g, '""');
  return clean.includes(',') || clean.includes('\n') || clean.includes('"') ? `"${clean}"` : clean;
}

function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const content = '\uFEFF' + [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(',')),
  ].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReportsAndPerformancePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ndrRecords, setNdrRecords] = useState<NdrRecord[]>([]);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'performance'>('daily');

  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'last_30_days',
    startDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    })(),
    endDate: (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.toISOString();
    })(),
  });
  const [courierFilter, setCourierFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
  }, []);

  const currentUserRole = currentUser?.role;

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const baseParams = new URLSearchParams({
        limit: '1000',
        sortField: 'createdAt',
        sortOrder: 'desc',
        courier: courierFilter,
        payment: paymentFilter,
      });
      if (dateRange.startDate) baseParams.set('startDate', dateRange.startDate);
      if (dateRange.endDate) baseParams.set('endDate', dateRange.endDate);

      const firstRes = await fetch(`/api/orders?page=1&${baseParams.toString()}`, { cache: 'no-store' });
      const firstData = await firstRes.json();
      const collected: Order[] = firstRes.ok && Array.isArray(firstData.orders) ? [...firstData.orders] : [];
      const totalPages = Math.max(1, Number(firstData.pagination?.totalPages || 1));

      for (let page = 2; page <= totalPages; page++) {
        const res = await fetch(`/api/orders?page=${page}&${baseParams.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && Array.isArray(data.orders)) {
          collected.push(...data.orders);
        }
      }
      setOrders(collected);

      if (currentUserRole === 'Super Admin') {
        const ndrParams = new URLSearchParams();
        if (dateRange.startDate) ndrParams.set('startDate', dateRange.startDate);
        if (dateRange.endDate) ndrParams.set('endDate', dateRange.endDate);

        const [usersRes, ndrRes] = await Promise.all([
          fetch('/api/users', { cache: 'no-store' }),
          fetch(`/api/ndr${ndrParams.toString() ? `?${ndrParams.toString()}` : ''}`, { cache: 'no-store' }),
        ]);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          if (usersData.success && Array.isArray(usersData.users)) setUsers(usersData.users);
        }
        if (ndrRes.ok) {
          const ndrData = await ndrRes.json();
          if (ndrData.success && Array.isArray(ndrData.records)) setNdrRecords(ndrData.records);
        }
      }
    } catch (error) {
      console.error('Failed to load report data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, courierFilter, paymentFilter, currentUserRole]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const statusMetrics = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    for (const status of ALL_STATUSES) {
      map[status] = { count: 0, value: 0 };
    }
    let bookedCount = 0;
    let printedCount = 0;
    let settledCount = 0;
    let totalRevenue = 0;

    for (const o of orders) {
      const val = Number(o.orderValue || 0);
      totalRevenue += val;
      if (!map[o.status]) map[o.status] = { count: 0, value: 0 };
      map[o.status].count += 1;
      map[o.status].value += val;
      if (o.isBooked || BOOKED_STATUSES.has(o.status)) bookedCount += 1;
      if (o.labelPrinted) printedCount += 1;
      if (o.isPaymentSettled || o.paymentType === 'Paid') settledCount += 1;
    }

    return { map, bookedCount, printedCount, settledCount, totalRevenue };
  }, [orders]);

  const dailyRows = useMemo(() => {
    const byDate = new Map<string, {
      date: string;
      total: number;
      created: number;
      packing: number;
      labelGenerated: number;
      booked: number;
      dispatched: number;
      rdc: number;
      ofd: number;
      delivered: number;
      undelivered: number;
      ndr: number;
      returned: number;
      paid: number;
      cod: number;
      partial: number;
      revenue: number;
    }>();

    for (const o of orders) {
      const date = toLocalDateKey(o.createdAt);
      if (!byDate.has(date)) {
        byDate.set(date, {
          date,
          total: 0,
          created: 0,
          packing: 0,
          labelGenerated: 0,
          booked: 0,
          dispatched: 0,
          rdc: 0,
          ofd: 0,
          delivered: 0,
          undelivered: 0,
          ndr: 0,
          returned: 0,
          paid: 0,
          cod: 0,
          partial: 0,
          revenue: 0,
        });
      }
      const row = byDate.get(date)!;
      const val = Number(o.orderValue || 0);
      const partialAmt = Number(o.partiallyPaidAmount || 0);
      const isPartial = partialAmt > 0 && val > partialAmt;

      row.total += 1;
      row.revenue += val;
      if (o.status === 'Created') row.created += 1;
      if (o.status === 'Packing' || o.status === 'Courier Selected') row.packing += 1;
      if (o.status === 'Label Generated') row.labelGenerated += 1;
      if (o.isBooked || BOOKED_STATUSES.has(o.status)) row.booked += 1;
      if (o.status === 'Dispatched' || o.status === 'Call Placed Notification') row.dispatched += 1;
      if (o.status === 'RDC') row.rdc += 1;
      if (o.status === 'OFD') row.ofd += 1;
      if (o.status === 'Delivered') row.delivered += 1;
      if (o.status === 'Undelivered') row.undelivered += 1;
      if (o.status === 'NDR') row.ndr += 1;
      if (o.status === 'Return') row.returned += 1;
      if (o.paymentType === 'Paid') row.paid += 1;
      else if (isPartial) row.partial += 1;
      else row.cod += 1;
    }

    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [orders]);

  const courierRows = useMemo(() => {
    const names = ['DTDC', 'XpressBees', 'Delhivery', 'Shadowfax', 'Unassigned'];
    return names.map(name => {
      const subset = orders.filter(o => (name === 'Unassigned' ? !o.courier : o.courier === name));
      const booked = subset.filter(o => o.isBooked || BOOKED_STATUSES.has(o.status)).length;
      const inTransit = subset.filter(o => ['Dispatched', 'Call Placed Notification', 'RDC', 'OFD'].includes(o.status)).length;
      const delivered = subset.filter(o => o.status === 'Delivered').length;
      const ndr = subset.filter(o => o.status === 'NDR' || o.status === 'Undelivered').length;
      const returned = subset.filter(o => o.status === 'Return').length;
      const revenue = subset.reduce((s, o) => s + Number(o.orderValue || 0), 0);
      const deliveryRate = subset.length > 0 ? ((delivered / subset.length) * 100).toFixed(1) : '0.0';
      return { name, total: subset.length, booked, inTransit, delivered, ndr, returned, revenue, deliveryRate };
    });
  }, [orders]);

  // Super Admin Performance Checker Metrics
  const performanceMetrics = useMemo(() => {
    const userRoleMap = new Map<string, { name: string; role: string }>();
    for (const u of users) {
      userRoleMap.set(u.username.toLowerCase(), { name: u.name, role: u.role });
      userRoleMap.set(u.name.toLowerCase(), { name: u.name, role: u.role });
    }
    const resolveStaff = (identifier: string) => {
      const key = identifier.trim().toLowerCase();
      const found = userRoleMap.get(key);
      if (found) return { displayName: found.name, role: found.role };
      return { displayName: getUserDisplayName(identifier), role: 'Team Member' };
    };

    // 1. Order Team (by createdBy)
    const orderTeamMap = new Map<string, {
      username: string;
      name: string;
      role: string;
      created: number;
      revenue: number;
      paid: number;
      cod: number;
      partial: number;
      vip: number;
      delivered: number;
      ndrOrReturn: number;
    }>();

    // 2. Packing & Dispatch Team
    const packingTeamMap = new Map<string, {
      username: string;
      name: string;
      role: string;
      awbsGenerated: number;
      labelsPrinted: number;
      bookedScanned: number;
      dispatched: number;
    }>();

    // 3. Tracking / OFD / NDR Team
    const trackingTeamMap = new Map<string, {
      username: string;
      name: string;
      role: string;
      assigned: number;
      delivered: number;
      remarksAdded: number;
      ndrActions: number;
    }>();

    const ensurePacking = (uname: string) => {
      const key = uname.toLowerCase();
      if (!packingTeamMap.has(key)) {
        const info = resolveStaff(uname);
        packingTeamMap.set(key, {
          username: uname,
          name: info.displayName,
          role: info.role,
          awbsGenerated: 0,
          labelsPrinted: 0,
          bookedScanned: 0,
          dispatched: 0,
        });
      }
      return packingTeamMap.get(key)!;
    };

    const ensureTracking = (uname: string) => {
      const key = uname.toLowerCase();
      if (!trackingTeamMap.has(key)) {
        const info = resolveStaff(uname);
        trackingTeamMap.set(key, {
          username: uname,
          name: info.displayName,
          role: info.role,
          assigned: 0,
          delivered: 0,
          remarksAdded: 0,
          ndrActions: 0,
        });
      }
      return trackingTeamMap.get(key)!;
    };

    for (const o of orders) {
      const creator = (o.createdBy || 'system').trim();
      const cKey = creator.toLowerCase();
      if (!orderTeamMap.has(cKey)) {
        const info = resolveStaff(creator);
        orderTeamMap.set(cKey, {
          username: creator,
          name: info.displayName,
          role: info.role,
          created: 0,
          revenue: 0,
          paid: 0,
          cod: 0,
          partial: 0,
          vip: 0,
          delivered: 0,
          ndrOrReturn: 0,
        });
      }
      const oRow = orderTeamMap.get(cKey)!;
      const val = Number(o.orderValue || 0);
      const partialAmt = Number(o.partiallyPaidAmount || 0);
      const isPartial = partialAmt > 0 && val > partialAmt;
      oRow.created += 1;
      oRow.revenue += val;
      if (o.paymentType === 'Paid') oRow.paid += 1;
      else if (isPartial) oRow.partial += 1;
      else oRow.cod += 1;
      if (o.isVip) oRow.vip += 1;
      if (o.status === 'Delivered') oRow.delivered += 1;
      if (['NDR', 'Return', 'Undelivered'].includes(o.status)) oRow.ndrOrReturn += 1;

      if (o.labelPrintedBy) ensurePacking(o.labelPrintedBy).labelsPrinted += 1;
      if (o.bookedBy) ensurePacking(o.bookedBy).bookedScanned += 1;

      const labelActors = new Set<string>();
      const dispatchActors = new Set<string>();
      for (const h of o.history || []) {
        const actor = (h.updatedBy || '').trim();
        if (!actor || actor === 'system' || actor === 'courier_webhook') continue;
        if (h.status === 'Label Generated' && !labelActors.has(actor.toLowerCase())) {
          labelActors.add(actor.toLowerCase());
          ensurePacking(actor).awbsGenerated += 1;
        }
        if (h.status === 'Dispatched' && !dispatchActors.has(actor.toLowerCase())) {
          dispatchActors.add(actor.toLowerCase());
          ensurePacking(actor).dispatched += 1;
        }
        if (['NDR', 'OFD', 'Delivered', 'Undelivered'].includes(h.status)) {
          ensureTracking(actor).ndrActions += 1;
        }
      }

      if (o.assignedTo) {
        const tRow = ensureTracking(o.assignedTo);
        tRow.assigned += 1;
        if (o.status === 'Delivered') tRow.delivered += 1;
      }
      for (const rem of o.temporal_remarks || []) {
        if (rem.author_user_id) {
          ensureTracking(rem.author_user_id).remarksAdded += 1;
        }
      }
    }

    for (const ndr of ndrRecords) {
      for (const rem of ndr.temporal_remarks || []) {
        if (rem.author_user_id) {
          ensureTracking(rem.author_user_id).remarksAdded += 1;
        }
      }
    }

    return {
      orderTeam: [...orderTeamMap.values()].sort((a, b) => b.created - a.created),
      packingTeam: [...packingTeamMap.values()].sort((a, b) => (b.awbsGenerated + b.dispatched) - (a.awbsGenerated + a.dispatched)),
      trackingTeam: [...trackingTeamMap.values()].sort((a, b) => (b.assigned + b.remarksAdded + b.ndrActions) - (a.assigned + a.remarksAdded + a.ndrActions)),
    };
  }, [orders, ndrRecords, users]);

  const handleExportFullOrdersCsv = () => {
    let url = `/api/reports?courier=${encodeURIComponent(courierFilter)}&payment=${encodeURIComponent(paymentFilter)}`;
    if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
    if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
    window.open(url);
  };

  const handleExportDailySummaryCsv = () => {
    const headers = [
      'Date',
      'Total Orders',
      'Created',
      'Packing / Courier Selected',
      'Label Generated',
      'Booked (Scanned)',
      'Dispatched',
      'RDC',
      'OFD',
      'Delivered',
      'Undelivered',
      'NDR',
      'Return (RTO)',
      'Prepaid (Paid)',
      'COD',
      'Partially Paid',
      'Total Revenue (INR)',
    ];
    const rows = dailyRows.map(r => [
      r.date,
      r.total,
      r.created,
      r.packing,
      r.labelGenerated,
      r.booked,
      r.dispatched,
      r.rdc,
      r.ofd,
      r.delivered,
      r.undelivered,
      r.ndr,
      r.returned,
      r.paid,
      r.cod,
      r.partial,
      r.revenue.toFixed(2),
    ]);
    downloadCsvFile('99store_daily_status_report.csv', headers, rows);
  };

  const handleExportPerformanceCsv = () => {
    const headers = [
      'Team',
      'Staff Name',
      'Username / ID',
      'Role',
      'Primary Volume (Created / AWBs / Assigned)',
      'Secondary Metric (Revenue / Printed / Remarks)',
      'Dispatched / Booked / NDR Actions',
      'Delivered Count',
    ];
    const rows: Array<Array<string | number>> = [
      ...performanceMetrics.orderTeam.map(m => [
        'Order Team',
        m.name,
        m.username,
        m.role,
        m.created,
        `INR ${m.revenue.toFixed(2)}`,
        `Paid:${m.paid} COD:${m.cod} Partial:${m.partial}`,
        m.delivered,
      ]),
      ...performanceMetrics.packingTeam.map(m => [
        'Packing & Dispatch',
        m.name,
        m.username,
        m.role,
        m.awbsGenerated,
        `Printed:${m.labelsPrinted}`,
        `Booked:${m.bookedScanned} Dispatched:${m.dispatched}`,
        m.dispatched,
      ]),
      ...performanceMetrics.trackingTeam.map(m => [
        'Tracking / OFD / NDR',
        m.name,
        m.username,
        m.role,
        m.assigned,
        `Remarks:${m.remarksAdded}`,
        `NDR/Status Actions:${m.ndrActions}`,
        m.delivered,
      ]),
    ];
    downloadCsvFile('99store_staff_performance_report.csv', headers, rows);
  };

  const isSuperAdmin = currentUser?.role === 'Super Admin';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={26} style={{ color: '#3B82F6' }} />
            <span>Reporting &amp; Performance Analytics</span>
          </h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Per-day dispatch, delivery, and status breakdowns with Excel-ready customer contact exports and team performance tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button onClick={fetchReportData} className="premium-btn premium-btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCcw size={14} />
            <span>Refresh</span>
          </button>
          <button onClick={handleExportFullOrdersCsv} className="premium-btn premium-btn-primary" style={{ padding: '8px 14px' }}>
            <Download size={14} />
            <span>Export Excel/CSV (With Contacts)</span>
          </button>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div
        className="premium-card"
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          backgroundColor: '#09090B',
          borderColor: '#27272A',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`premium-btn ${activeTab === 'daily' ? 'premium-btn-primary' : 'premium-btn-secondary'}`}
            style={{ padding: '7px 14px', fontSize: '13px' }}
          >
            <TrendingUp size={14} />
            <span>Daily Status Report</span>
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={`premium-btn ${activeTab === 'performance' ? 'premium-btn-primary' : 'premium-btn-secondary'}`}
              style={{
                padding: '7px 14px',
                fontSize: '13px',
                backgroundColor: activeTab === 'performance' ? '#3B82F6' : undefined,
                borderColor: activeTab === 'performance' ? '#3B82F6' : undefined,
              }}
            >
              <Award size={14} />
              <span>Super Admin Performance Checker</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={14} style={{ color: '#737373' }} />
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              className="premium-input"
              style={{ width: 'auto', minWidth: '135px', padding: '6px 28px 6px 12px', height: '34px', fontSize: '13px', backgroundColor: '#18181B', borderColor: '#27272A', appearance: 'none', cursor: 'pointer' }}
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

          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              className="premium-input"
              style={{ width: 'auto', minWidth: '140px', padding: '6px 28px 6px 12px', height: '34px', fontSize: '13px', backgroundColor: '#18181B', borderColor: '#27272A', appearance: 'none', cursor: 'pointer' }}
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="all">Payment (All)</option>
              <option value="Paid">Prepaid (Paid)</option>
              <option value="COD">COD (All COD)</option>
              <option value="Pure COD">COD (Unpaid Only)</option>
              <option value="Partially Paid">Partially Paid</option>
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
          </div>

          {activeTab === 'daily' ? (
            <button
              type="button"
              onClick={handleExportDailySummaryCsv}
              className="premium-btn premium-btn-secondary"
              style={{ height: '34px', padding: '0 12px', fontSize: '12.5px' }}
            >
              <Download size={13} />
              <span>Export Daily Summary CSV</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportPerformanceCsv}
              className="premium-btn premium-btn-secondary"
              style={{ height: '34px', padding: '0 12px', fontSize: '12.5px' }}
            >
              <Download size={13} />
              <span>Export Team Performance CSV</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton variant="dashboard" />
      ) : activeTab === 'daily' ? (
        <>
          {/* Overall Summary Row */}
          <div className="premium-grid-4" style={{ gap: '16px' }}>
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase', fontWeight: 600 }}>Total Orders &amp; Value</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#FAFAFA' }}>{orders.length} Orders</div>
              <div style={{ fontSize: '12px', color: '#34D399' }}>₹{statusMetrics.totalRevenue.toLocaleString('en-IN')}</div>
            </div>
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase', fontWeight: 600 }}>Booked &amp; Dispatched Flow</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#60A5FA' }}>{statusMetrics.bookedCount} Booked</div>
              <div style={{ fontSize: '12px', color: '#A1A1AA' }}>
                Labels Printed: {statusMetrics.printedCount} / {orders.length}
              </div>
            </div>
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase', fontWeight: 600 }}>Delivered &amp; Rate</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#10B981' }}>{statusMetrics.map.Delivered?.count || 0} Delivered</div>
              <div style={{ fontSize: '12px', color: '#A1A1AA' }}>
                Delivery Rate: {orders.length > 0 ? (((statusMetrics.map.Delivered?.count || 0) / orders.length) * 100).toFixed(1) : '0.0'}%
              </div>
            </div>
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase', fontWeight: 600 }}>NDR / Returns / Settled</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#F87171' }}>
                {(statusMetrics.map.NDR?.count || 0) + (statusMetrics.map.Return?.count || 0)} NDR/RTO
              </div>
              <div style={{ fontSize: '12px', color: '#34D399' }}>
                Marked Paid / Prepaid: {statusMetrics.settledCount}
              </div>
            </div>
          </div>

          {/* Every Status Breakdown Pills */}
          <div className="premium-card" style={{ padding: '16px 20px' }}>
            <h3 style={{ fontSize: '14px', color: '#FAFAFA', marginBottom: '12px', fontWeight: 600 }}>
              Every Status Breakdown (Selected Range)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: '10px' }}>
              {ALL_STATUSES.map(status => {
                const entry = statusMetrics.map[status] || { count: 0, value: 0 };
                return (
                  <div
                    key={status}
                    style={{
                      backgroundColor: '#111114',
                      border: '1px solid #222227',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <span className={`premium-badge status-${status.toLowerCase().replace(' ', '')}`} style={{ width: 'fit-content', fontSize: '10px' }}>
                      {status}
                    </span>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#FAFAFA' }}>{entry.count}</div>
                    <div style={{ fontSize: '11px', color: '#737373' }}>₹{entry.value.toLocaleString('en-IN')}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day-by-Day Status Matrix */}
          <div className="premium-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600 }}>
                Per-Day Dispatch, Delivery &amp; Every Status Report
              </h3>
              <span style={{ fontSize: '12px', color: '#737373' }}>{dailyRows.length} day(s)</span>
            </div>

            {dailyRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#737373' }}>
                No orders found for the selected date range and filters.
              </div>
            ) : (
              <div className="premium-table-container" style={{ overflowX: 'auto' }}>
                <table className="premium-table" style={{ minWidth: '1180px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Created</th>
                      <th>Packing</th>
                      <th>Label Gen</th>
                      <th>Booked</th>
                      <th>Dispatched</th>
                      <th>RDC</th>
                      <th>OFD</th>
                      <th>Delivered</th>
                      <th>Undelivered</th>
                      <th>NDR</th>
                      <th>Return</th>
                      <th>Paid / COD / Partial</th>
                      <th>Revenue (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map(row => (
                      <tr key={row.date}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.date}</td>
                        <td style={{ fontWeight: 700, color: '#FAFAFA' }}>{row.total}</td>
                        <td>{row.created}</td>
                        <td>{row.packing}</td>
                        <td>{row.labelGenerated}</td>
                        <td style={{ color: '#60A5FA', fontWeight: 600 }}>{row.booked}</td>
                        <td style={{ color: '#A78BFA', fontWeight: 600 }}>{row.dispatched}</td>
                        <td>{row.rdc}</td>
                        <td style={{ color: '#FBBF24', fontWeight: 600 }}>{row.ofd}</td>
                        <td style={{ color: '#34D399', fontWeight: 700 }}>{row.delivered}</td>
                        <td>{row.undelivered}</td>
                        <td style={{ color: '#F87171', fontWeight: 600 }}>{row.ndr}</td>
                        <td style={{ color: '#FB7185' }}>{row.returned}</td>
                        <td style={{ fontSize: '11.5px', color: '#A1A1AA' }}>
                          {row.paid} / {row.cod} / {row.partial}
                        </td>
                        <td style={{ fontWeight: 600 }}>₹{row.revenue.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Courier Summary Table */}
          <div className="premium-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600, marginBottom: '14px' }}>
              Courier-Wise Fulfillment Breakdown
            </h3>
            <div className="premium-table-container">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Courier</th>
                    <th>Total Shipments</th>
                    <th>Booked (Scanned)</th>
                    <th>In Transit / OFD</th>
                    <th>Delivered</th>
                    <th>NDR / Undelivered</th>
                    <th>Return (RTO)</th>
                    <th>Delivery %</th>
                    <th>Order Value (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {courierRows.map(c => (
                    <tr key={c.name}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {c.name !== 'Unassigned' ? <CourierLogo courier={c.name} size={14} /> : <span style={{ color: '#737373' }}>Unassigned</span>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{c.total}</td>
                      <td style={{ color: '#60A5FA' }}>{c.booked}</td>
                      <td>{c.inTransit}</td>
                      <td style={{ color: '#34D399', fontWeight: 700 }}>{c.delivered}</td>
                      <td style={{ color: '#F87171' }}>{c.ndr}</td>
                      <td style={{ color: '#FB7185' }}>{c.returned}</td>
                      <td style={{ fontWeight: 600 }}>{c.deliveryRate}%</td>
                      <td style={{ fontWeight: 600 }}>₹{c.revenue.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Tab 2: Super Admin Performance Checker */
        !isSuperAdmin ? (
          <div className="premium-card" style={{ padding: '40px', textAlign: 'center', color: '#F87171' }}>
            Super Admin access is required to view staff performance metrics.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 1. Order Team Performance */}
            <div className="premium-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Package size={18} style={{ color: '#10B981' }} />
                <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600, margin: 0 }}>
                  Order Team Performance (By Order Creator)
                </h3>
              </div>
              {performanceMetrics.orderTeam.length === 0 ? (
                <div style={{ color: '#737373', fontSize: '13px' }}>No order creation activity in the selected range.</div>
              ) : (
                <div className="premium-table-container">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Role</th>
                        <th>Orders Created</th>
                        <th>Revenue (₹)</th>
                        <th>Avg Value</th>
                        <th>Paid / COD / Partial</th>
                        <th>VIP</th>
                        <th>Delivered (Rate)</th>
                        <th>NDR / RTO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceMetrics.orderTeam.map(row => {
                        const avg = row.created > 0 ? row.revenue / row.created : 0;
                        const delivRate = row.created > 0 ? ((row.delivered / row.created) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={row.username}>
                            <td>
                              <div style={{ fontWeight: 600, color: '#FAFAFA' }}>{row.name}</div>
                              <div style={{ fontSize: '11px', color: '#737373', fontFamily: 'monospace' }}>@{row.username}</div>
                            </td>
                            <td><span style={{ fontSize: '11.5px', color: '#A1A1AA' }}>{row.role}</span></td>
                            <td style={{ fontWeight: 700, fontSize: '15px', color: '#FAFAFA' }}>{row.created}</td>
                            <td style={{ fontWeight: 600, color: '#34D399' }}>₹{row.revenue.toLocaleString('en-IN')}</td>
                            <td>₹{avg.toFixed(0)}</td>
                            <td style={{ fontSize: '12px' }}>
                              <span style={{ color: '#34D399' }}>{row.paid}</span> / <span style={{ color: '#FBBF24' }}>{row.cod}</span> / <span style={{ color: '#A78BFA' }}>{row.partial}</span>
                            </td>
                            <td>{row.vip}</td>
                            <td style={{ color: '#10B981', fontWeight: 600 }}>{row.delivered} ({delivRate}%)</td>
                            <td style={{ color: '#F87171' }}>{row.ndrOrReturn}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Packing & Dispatch Team Performance */}
            <div className="premium-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <CheckCircle2 size={18} style={{ color: '#3B82F6' }} />
                <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600, margin: 0 }}>
                  Packing &amp; Dispatch Team Performance
                </h3>
              </div>
              {performanceMetrics.packingTeam.length === 0 ? (
                <div style={{ color: '#737373', fontSize: '13px' }}>No packing or barcode scan actions recorded in the selected range.</div>
              ) : (
                <div className="premium-table-container">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Operator</th>
                        <th>Role</th>
                        <th>AWBs / Labels Generated</th>
                        <th>Thermal Labels Printed</th>
                        <th>Barcode Scans (Booked)</th>
                        <th>Dispatches Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceMetrics.packingTeam.map(row => (
                        <tr key={row.username}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#FAFAFA' }}>{row.name}</div>
                            <div style={{ fontSize: '11px', color: '#737373', fontFamily: 'monospace' }}>@{row.username}</div>
                          </td>
                          <td><span style={{ fontSize: '11.5px', color: '#A1A1AA' }}>{row.role}</span></td>
                          <td style={{ fontWeight: 700, color: '#60A5FA' }}>{row.awbsGenerated}</td>
                          <td style={{ fontWeight: 600, color: '#34D399' }}>{row.labelsPrinted}</td>
                          <td style={{ fontWeight: 600, color: '#A78BFA' }}>{row.bookedScanned}</td>
                          <td style={{ fontWeight: 700, color: '#FAFAFA' }}>{row.dispatched}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Tracking, OFD & NDR Team Performance */}
            <div className="premium-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Truck size={18} style={{ color: '#F59E0B' }} />
                <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600, margin: 0 }}>
                  Tracking, OFD &amp; NDR Escalation Performance
                </h3>
              </div>
              {performanceMetrics.trackingTeam.length === 0 ? (
                <div style={{ color: '#737373', fontSize: '13px' }}>No tracking assignments, remarks, or NDR actions recorded in the selected range.</div>
              ) : (
                <div className="premium-table-container">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Agent / Handler</th>
                        <th>Role</th>
                        <th>Assigned Shipments</th>
                        <th>Delivered Conversions</th>
                        <th>Delivery Rate %</th>
                        <th>Remarks Logged</th>
                        <th>NDR / Status Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceMetrics.trackingTeam.map(row => {
                        const rate = row.assigned > 0 ? ((row.delivered / row.assigned) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={row.username}>
                            <td>
                              <div style={{ fontWeight: 600, color: '#FAFAFA' }}>{row.name}</div>
                              <div style={{ fontSize: '11px', color: '#737373', fontFamily: 'monospace' }}>@{row.username}</div>
                            </td>
                            <td><span style={{ fontSize: '11.5px', color: '#A1A1AA' }}>{row.role}</span></td>
                            <td style={{ fontWeight: 700 }}>{row.assigned}</td>
                            <td style={{ color: '#34D399', fontWeight: 700 }}>{row.delivered}</td>
                            <td>{rate}%</td>
                            <td style={{ color: '#60A5FA', fontWeight: 600 }}>{row.remarksAdded}</td>
                            <td style={{ color: '#FBBF24', fontWeight: 600 }}>{row.ndrActions}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
