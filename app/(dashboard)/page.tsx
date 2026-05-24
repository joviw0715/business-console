import Link from 'next/link';
import pool from '@/lib/db';
import StatCard from '@/components/shared/stat-card';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import type { Campaign } from '@/types';

async function getStats() {
  try {
    const [total, today, active, outcomes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM call_reports'),
      pool.query("SELECT COUNT(*) FROM call_reports WHERE DATE(created_at) = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM campaigns WHERE status = 'running'"),
      pool.query(`
        SELECT outcome, COUNT(*) as count FROM call_reports
        WHERE DATE(created_at) = CURRENT_DATE GROUP BY outcome
      `),
    ]);
    return {
      total: parseInt(total.rows[0].count),
      today: parseInt(today.rows[0].count),
      active: parseInt(active.rows[0].count),
      outcomes: outcomes.rows as { outcome: string; count: string }[],
    };
  } catch {
    return { total: 0, today: 0, active: 0, outcomes: [] };
  }
}

async function getActiveCampaigns(): Promise<Campaign[]> {
  try {
    const { rows } = await pool.query<Campaign>(`
      SELECT c.*,
        COUNT(ct.id)::int AS total_contacts,
        COUNT(ct.id) FILTER (WHERE ct.status = 'done')::int AS called_contacts
      FROM campaigns c
      LEFT JOIN contacts ct ON ct.campaign_id = c.id
      WHERE c.status IN ('running','paused')
      GROUP BY c.id ORDER BY c.created_at DESC LIMIT 10
    `);
    return rows;
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const [stats, campaigns] = await Promise.all([getStats(), getActiveCampaigns()]);

  const outcomeMap = Object.fromEntries(stats.outcomes.map((o) => [o.outcome, parseInt(o.count)]));
  const connectRate =
    stats.today > 0 ? Math.round(((outcomeMap.answered ?? 0) / stats.today) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Calls" value={stats.total} />
        <StatCard title="Today's Calls" value={stats.today} />
        <StatCard title="Active Campaigns" value={stats.active} />
        <StatCard title="Connect Rate" value={`${connectRate}%`} sub="today" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active Campaigns</h2>
          <Link href="/campaigns/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="h-4 w-4 mr-1" />New Campaign
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
            No active campaigns. <Link href="/campaigns/new" className="underline">Create one</Link>.
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const pct = c.total_contacts
                    ? Math.round(((c.called_contacts ?? 0) / c.total_contacts) * 100)
                    : 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden max-w-32">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10">
                            {c.called_contacts ?? 0}/{c.total_contacts ?? 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/campaigns/${c.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>View</Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {stats.today > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Today&apos;s Outcomes</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Answered"   value={outcomeMap.answered   ?? 0} />
            <StatCard title="Voicemail"  value={outcomeMap.voicemail  ?? 0} />
            <StatCard title="No Answer"  value={outcomeMap.no_answer  ?? 0} />
            <StatCard title="Busy"       value={outcomeMap.busy       ?? 0} />
          </div>
        </div>
      )}
    </div>
  );
}
