import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';
import { sendBookingConfirmation } from '@/lib/wa-confirmation';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; rid: string }> },
) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id, rid } = await params;

  // Verify campaign belongs to this account
  const { rows: [campaign] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }

  const date = typeof body.date === 'string' ? body.date.trim() : '';
  const time = typeof body.time === 'string' ? body.time.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  if (!date || !time) {
    return NextResponse.json({ error: 'date and time are required' }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }

  await sendBookingConfirmation(phone, {
    restaurant: typeof body.restaurant === 'string' ? body.restaurant : '餐廳',
    customer:   typeof body.name === 'string' ? body.name : '客人',
    status:     '確認',
    date,
    time,
    people:     typeof body.people === 'string' ? body.people : '-',
  }, accountId);

  await pool.query(
    'UPDATE call_reports SET wa_confirmation_sent = true WHERE id = $1 AND campaign_id = $2',
    [rid, id],
  );

  return NextResponse.json({ ok: true });
}
