import { DashboardSkeleton } from '@/components/DashboardSkeleton';

export default function ActivityLogsLoading() {
  return <DashboardSkeleton variant="table" rows={8} />;
}
