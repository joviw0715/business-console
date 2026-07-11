import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';
import { sendBookingConfirmation } from '@/lib/wa-confirmation';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; callId: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id, callId } = await params;
  let follow_up_status: unknown, follow_up_note: unknown;
  try {
    ({ follow_up_status, follow_up_note } = await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  // Verify hotline belongs to account
  const { rows: [hotline] } = await pool.query(
    'SELECT id FROM hotlines WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!hotline) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rowCount } = await pool.query(
    `UPDATE inbound_calls
     SET follow_up_status = COALESCE($1, follow_up_status),
         follow_up_note   = COALESCE($2, follow_up_note)
     WHERE id = $3 AND hotline_id = $4`,
    [follow_up_status ?? null, follow_up_note ?? null, callId, id],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Send WA confirmation when staff manually marks a call as booking confirmed
  if (follow_up_status === 'booking_confirmed') {
    try {
      const { rows: [call] } = await pool.query(
        `SELECT ic.caller_phone, ic.booking_details, h.account_id
         FROM inbound_calls ic JOIN hotlines h ON h.id = ic.hotline_id
         WHERE ic.id = $1`,
        [callId],
      );
      const { rows: [account] } = await pool.query(
        'SELECT wa_inbound_enabled, business_name FROM accounts WHERE id = $1',
        [call?.account_id],
      );
      if (call?.caller_phone && account?.wa_inbound_enabled) {
        const booking = typeof call.booking_details === 'string'
          ? JSON.parse(call.booking_details || '{}')
          : (call.booking_details || {});
        await sendBookingConfirmation(call.caller_phone, {
          restaurant: account.business_name || '餐廳',
          customer:   booking.customer || '客人',
          status:     '確認',
          date:       booking.date || '-',
          time:       booking.time || '-',
          people:     booking.people || '-',
        }, call.account_id);
      }
    } catch (e: any) {
      console.error('[hotline/calls] WA send failed:', e.message);
    }
  }

  return NextResponse.json({ ok: true });
}
