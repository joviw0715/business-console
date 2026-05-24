import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await outboundCallsQueue.resume();
  await pool.query("UPDATE campaigns SET status = 'running' WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
