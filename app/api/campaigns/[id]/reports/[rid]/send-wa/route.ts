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

  const body = await req.json() as {
    phone: string; name: string; restaurant: string;
    date: string; time: string; people: string;
  };

  if (!body.date?.trim() || !body.time?.trim()) {
    return NextResponse.json({ error: 'date and time are required' }, { status: 400 });
  }
  if (!body.phone?.trim()) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }

  await sendBookingConfirmation(body.phone, {
    restaurant: body.restaurant || '餐廳',
    customer:   body.name      || '客人',
    status:     '已確認',
    date:       body.date,
    time:       body.time,
    people:     body.people || '-',
  }, accountId);

  await pool.query(
    'UPDATE call_reports SET wa_confirmation_sent = true WHERE id = $1',
    [rid],
  );

  return NextResponse.json({ ok: true });
}
