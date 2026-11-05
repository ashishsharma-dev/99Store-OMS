'use client';

import { useEffect, useState } from 'react';
import { Activity, CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { ActivityLogEntry, ActivityLogType } from '@/lib/types';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';

const PAGE_SIZE = 50;

const typeLabels: Record<ActivityLogType | 'all', string> = {
  all: 'All activity',
  order: 'Order activity',
  ofd: 'OFD activity',
  ndr: 'NDR activity',
  call_placed: 'Call placed',
};

const typeColors: Record<ActivityLogType, string> = {
  order: '#3B82F6',
  ofd: '#10B981',
  ndr: '#EF4444',
  call_placed: '#F59E0B',
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ActivityLogType | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (search.trim()) params.set('search', search.trim());
        if (type !== 'all') params.set('type', type);
        if (startDate) params.set('startDate', new Date(`${startDate}T00:00:00`).toISOString());
        if (endDate) params.set('endDate', new Date(`${endDate}T23:59:59.999`).toISOString());
        const response = await fetch(`/api/activity-logs?${params}`, { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load activity logs.');
        setLogs(data.logs || []);
        setTotalPages(Math.max(1, data.pagination?.totalPages || 1));
        setTotalCount(data.pagination?.totalCount || 0);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') console.error(error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [page, search, type, startDate, endDate]);

  useEffect(() => setPage(1), [search, type, startDate, endDate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '28px', color: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={26} style={{ color: '#3B82F6' }} /> Activity Logs
        </h1>
        <p style={{ color: '#8A8A8A', fontSize: '13px', marginTop: '6px' }}>
          Complete notification and order activity history. Showing {totalCount.toLocaleString()} matching entries.
        </p>
      </div>

      <div className="premium-card" style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 180px 160px 160px', gap: '12px', alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#A1A1AA', fontSize: '11px' }}>
          SEARCH
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#71717A' }} />
            <input className="premium-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Order ID, customer, note, user..." style={{ paddingLeft: '32px' }} />
          </div>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#A1A1AA', fontSize: '11px' }}>
          ACTIVITY TYPE
          <select className="premium-input" value={type} onChange={event => setType(event.target.value as ActivityLogType | 'all')}>
            {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#A1A1AA', fontSize: '11px' }}>
          FROM
          <input type="date" className="premium-input" value={startDate} onChange={event => setStartDate(event.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#A1A1AA', fontSize: '11px' }}>
          TO
          <input type="date" className="premium-input" value={endDate} onChange={event => setEndDate(event.target.value)} />
        </label>
      </div>

      {loading ? <DashboardSkeleton variant="table" rows={8} /> : logs.length === 0 ? (
        <div className="premium-card" style={{ padding: '56px', textAlign: 'center', color: '#737373' }}>
          <CalendarDays size={28} style={{ marginBottom: '10px' }} />
          <div>No notification or order activity matches these filters.</div>
        </div>
      ) : (
        <div className="premium-table-container">
          <table className="premium-table">
            <thead><tr><th>Date & Time</th><th>Type</th><th>Order</th><th>Activity</th><th>Updated By</th><th>AWB Contact</th></tr></thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', color: '#A1A1AA', fontSize: '12px' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td><span className="premium-badge" style={{ color: typeColors[log.type], borderColor: typeColors[log.type], backgroundColor: `${typeColors[log.type]}15` }}>{typeLabels[log.type]}</span></td>
                  <td><div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{log.orderId}</div><div style={{ color: '#737373', fontSize: '11px' }}>{log.customerName || '—'}{log.courier ? ` · ${log.courier}` : ''}</div></td>
                  <td style={{ maxWidth: '520px' }}><div style={{ color: '#FAFAFA', fontWeight: 600, fontSize: '12.5px' }}>{log.title}</div><div style={{ color: '#A1A1AA', fontSize: '12px', marginTop: '3px', lineHeight: 1.45 }}>{log.message}</div></td>
                  <td style={{ color: '#D4D4D8', fontSize: '12px' }}>{log.updatedBy || 'System'}</td>
                  <td style={{ fontSize: '12px' }}>{log.shipmentContactPhone ? <><div style={{ fontFamily: 'monospace', color: '#A78BFA' }}>{log.shipmentContactPhone}</div><div style={{ color: '#737373', fontSize: '10px' }}>{log.shipmentContactType || 'Other'}</div></> : <span style={{ color: '#52525B' }}>Not recorded</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#8A8A8A', fontSize: '12px' }}>
        <span>Page {page} of {totalPages}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="premium-btn premium-btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={14} /> Previous</button>
          <button className="premium-btn premium-btn-secondary" disabled={page >= totalPages || loading} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Next <ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}
