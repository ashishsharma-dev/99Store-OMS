type DashboardSkeletonProps = {
  variant?: 'dashboard' | 'table' | 'tracking' | 'chat' | 'settings';
  rows?: number;
};

function Block({ width = '100%', height = 12, radius = 6 }: { width?: string; height?: number; radius?: number }) {
  return <span className="skeleton-block" style={{ width, height, borderRadius: radius }} />;
}

function HeaderSkeleton() {
  return (
    <div className="skeleton-header">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <Block width="190px" height={24} />
        <Block width="min(420px, 80%)" height={11} />
      </div>
      <Block width="128px" height={36} radius={8} />
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <div className="skeleton-toolbar">
        <Block width="min(340px, 48%)" height={38} radius={8} />
        <div style={{ display: 'flex', gap: 10 }}>
          <Block width="110px" height={38} radius={8} />
          <Block width="130px" height={38} radius={8} />
        </div>
      </div>
      <div className="skeleton-table">
        <div className="skeleton-table-row skeleton-table-head">
          {[32, 18, 16, 14, 12].map((width, index) => <Block key={index} width={`${width}%`} height={10} />)}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div className="skeleton-table-row" key={row}>
            {[32, 18, 16, 14, 12].map((width, index) => (
              <div key={index} style={{ width: `${width}%`, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Block width={index === 0 ? '72%' : '88%'} height={11} />
                {index < 2 && <Block width="52%" height={8} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function DashboardCardsSkeleton() {
  return (
    <>
      <div className="skeleton-metric-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="skeleton-panel skeleton-metric" key={index}>
            <Block width="38%" height={10} />
            <Block width="46%" height={28} />
            <Block width="68%" height={8} />
          </div>
        ))}
      </div>
      <div className="skeleton-content-grid">
        <div className="skeleton-panel skeleton-chart">
          <Block width="34%" height={15} />
          <div className="skeleton-bars">
            {[62, 88, 46, 72, 54, 81].map((height, index) => <span key={index} className="skeleton-bar" style={{ height: `${height}%` }} />)}
          </div>
        </div>
        <div className="skeleton-panel" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Block width="42%" height={15} />
          {Array.from({ length: 5 }, (_, index) => <Block key={index} width={`${92 - index * 7}%`} height={12} />)}
        </div>
      </div>
    </>
  );
}

function SplitSkeleton({ chat = false }: { chat?: boolean }) {
  return (
    <div className={chat ? 'skeleton-chat-grid' : 'skeleton-tracking-grid'}>
      {(chat ? [1, 2, 3] : [1, 2]).map((column) => (
        <div className="skeleton-panel" key={column} style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: chat ? 520 : 440 }}>
          <Block width="46%" height={15} />
          <Block width="100%" height={36} radius={8} />
          {Array.from({ length: chat ? 7 : 6 }, (_, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Block width="34px" height={34} radius={17} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                <Block width={`${78 - (index % 3) * 9}%`} height={10} />
                <Block width="44%" height={8} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <>
      <div className="skeleton-toolbar"><Block width="62%" height={42} radius={8} /><Block width="170px" height={42} radius={8} /></div>
      <div className="skeleton-settings-grid">
        {Array.from({ length: 4 }, (_, panel) => (
          <div className="skeleton-panel" key={panel} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Block width="38%" height={16} />
            {Array.from({ length: 4 }, (_, index) => <Block key={index} width="100%" height={38} radius={7} />)}
          </div>
        ))}
      </div>
    </>
  );
}

export function DashboardSkeleton({ variant = 'table', rows = 7 }: DashboardSkeletonProps) {
  return (
    <div className="dashboard-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">Loading dashboard content</span>
      <HeaderSkeleton />
      {variant === 'dashboard' && <DashboardCardsSkeleton />}
      {variant === 'table' && <TableSkeleton rows={rows} />}
      {variant === 'tracking' && <SplitSkeleton />}
      {variant === 'chat' && <SplitSkeleton chat />}
      {variant === 'settings' && <SettingsSkeleton />}
    </div>
  );
}
