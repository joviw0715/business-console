import Link from 'next/link';
import pool from '@/lib/db';
import { buttonVariants } from '@/components/ui/button';
import { Plus, PhoneIncoming } from 'lucide-react';
import { cn } from '@/lib/utils';

async function getHotlines() {
  try {
    const { rows } = await pool.query(`
      SELECT h.*,
        COUNT(ic.id) FILTER (WHERE ic.ended_at IS NULL)::int AS live_count
      FROM hotlines h
      LEFT JOIN inbound_calls ic ON ic.hotline_id = h.id
      GROUP BY h.id
      ORDER BY h.created_at DESC
    `);
    return rows;
  } catch {
    return [];
  }
}

export default async function HotlinesPage() {
  const hotlines = await getHotlines();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Inbound hotlines</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Let AI handle your phone lines — answer questions, qualify leads, and escalate when needed.
          </p>
        </div>
        <Link href="/hotlines/new" className={buttonVariants({ size: 'sm' })}>
          <Plus className="h-4 w-4 mr-1.5" />New hotline
        </Link>
      </div>

      {hotlines.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          No hotlines yet. <Link href="/hotlines/new" className="underline">Create one</Link>.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {hotlines.map((h) => (
            <Link
              key={h.id}
              href={`/hotlines/${h.id}`}
              className="block rounded-lg border border-border bg-card p-4 hover:border-violet-500/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <PhoneIncoming className="h-4 w-4 text-violet-400 shrink-0" />
                  <p className="font-medium text-sm">{h.name}</p>
                </div>
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  h.status === 'active'
                    ? 'bg-violet-500/10 text-violet-400'
                    : 'bg-secondary text-muted-foreground',
                )}>
                  {h.status === 'active' ? 'ACTIVE' : 'PAUSED'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground ml-6">{h.twilio_number}</p>
              {h.live_count > 0 ? (
                <p className="text-xs text-green-400 ml-6 mt-1">
                  ● {h.live_count} live call{h.live_count !== 1 ? 's' : ''}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground ml-6 mt-1">Idle</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
