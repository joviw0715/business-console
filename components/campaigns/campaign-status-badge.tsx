import { Badge } from '@/components/ui/badge';
import type { CampaignStatus } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'bg-secondary text-secondary-foreground' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  running:   { label: 'Running',   className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  paused:    { label: 'Paused',    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  done:      { label: 'Done',      className: 'bg-muted text-muted-foreground' },
};

export default function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { label, className } = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', className)}>
      {label}
    </Badge>
  );
}
