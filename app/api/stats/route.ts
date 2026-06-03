import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function GET() {
  try {
    const session = await requireAuth();
    const accountId = effectiveAccountId(session);

    const [active, today] = await Promise.all([
      pool.query("SELECT COUNT(*)::int FROM campaigns WHERE status = 'running' AND account_id = $1", [accountId]),
      pool.query("SELECT COUNT(*)::int FROM call_reports r JOIN campaigns c ON c.id = r.campaign_id WHERE DATE(r.created_at) = CURRENT_DATE AND c.account_id = $1", [accountId]),
    ]);
    return NextResponse.json({
      active: active.rows[0].count as number,
      today:  today.rows[0].count  as number,
    });
  } catch {
    return NextResponse.json({ active: 0, today: 0 });
  }
}
