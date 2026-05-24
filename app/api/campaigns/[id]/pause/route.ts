import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await outboundCallsQueue.pause();
  await pool.query("UPDATE campaigns SET status = 'paused' WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
