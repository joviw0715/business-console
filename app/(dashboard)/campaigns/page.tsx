import Link from 'next/link';
import pool from '@/lib/db';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal } from 'lucide-react';
import type { Campaign } from '@/types';

async function getCampaigns(): Promise<Campaign[]> {
  try {
    const { rows } = await pool.query<Campaign>(`
      SELECT c.*,
        COUNT(ct.id)::int AS total_contacts,
        COUNT(ct.id) FILTER (WHERE ct.status = 'done')::int AS called_contacts
      FROM campaigns c
      LEFT JOIN contacts ct ON ct.campaign_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC
    `);
    return rows;
  } catch {
    return [];
  }
}

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Button asChild size="sm">
          <Link href="/campaigns/new"><Plus className="h-4 w-4 mr-1" />New Campaign</Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground text-sm">
          No campaigns yet. <Link href="/campaigns/new" className="underline">Create your first one</Link>.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const pct = c.total_contacts
                  ? Math.round(((c.called_contacts ?? 0) / c.total_contacts) * 100)
                  : 0;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      <Link href={`/campaigns/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{c.total_contacts ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/campaigns/${c.id}`}>View</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/campaigns/${c.id}/contacts/import`}>Import Contacts</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/campaigns/${c.id}/reports`}>Reports</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
