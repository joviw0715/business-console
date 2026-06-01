'use client';

import { Badge } from '@/components/ui/badge';
import type { CampaignStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/lang';

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft:     'bg-secondary text-secondary-foreground',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  running:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  paused:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  done:      'bg-muted text-muted-foreground',
};

export default function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { T } = useLang();
  const labelMap: Record<CampaignStatus, string> = {
    draft:     T.statusDraft,
    scheduled: T.statusScheduled,
    running:   T.statusRunning,
    paused:    T.statusPaused,
    done:      T.statusDone,
  };
  const label = labelMap[status] ?? status;
  const className = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', className)}>
      {label}
    </Badge>
  );
}
