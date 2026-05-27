import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [active, today] = await Promise.all([
      pool.query("SELECT COUNT(*)::int FROM campaigns WHERE status = 'running'"),
      pool.query("SELECT COUNT(*)::int FROM call_reports WHERE DATE(created_at) = CURRENT_DATE"),
    ]);
    return NextResponse.json({
      active: active.rows[0].count as number,
      today:  today.rows[0].count  as number,
    });
  } catch {
    return NextResponse.json({ active: 0, today: 0 });
  }
}
