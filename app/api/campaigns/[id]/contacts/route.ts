import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows: [campaign] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows } = await pool.query(
    'SELECT * FROM contacts WHERE campaign_id = $1 ORDER BY created_at DESC',
    [id],
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows: [campaign] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const contacts: { name?: string; phone: string; custom_field?: string }[] = body.contacts ?? [];
  if (!contacts.length) return NextResponse.json({ error: 'No contacts provided' }, { status: 400 });

  const newContactIds: number[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of contacts) {
      if (!c.phone?.trim()) continue;
      const { rows: [row] } = await client.query(
        `INSERT INTO contacts (campaign_id, name, phone, custom_data, status)
         VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
        [id, c.name ?? '', c.phone.trim(), c.custom_field ? JSON.stringify({ note: c.custom_field }) : null],
      );
      if (row) newContactIds.push(row.id);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }

  // If the campaign is running, enqueue the newly inserted contacts immediately
  const { rows: [campaignStatus] } = await pool.query(
    'SELECT status FROM campaigns WHERE id = $1',
    [id],
  );
  if (campaignStatus?.status === 'running' && newContactIds.length > 0) {
    const { rows: [config] } = await pool.query(
      'SELECT * FROM campaign_config WHERE campaign_id = $1',
      [id],
    );
    const { rows: newContacts } = await pool.query(
      "SELECT id, phone FROM contacts WHERE id = ANY($1) AND status = 'pending'",
      [newContactIds],
    );
    await outboundCallsQueue.addBulk(
      newContacts.map((contact) => ({
        name: 'dial',
        data: {
          contactId: contact.id,
          campaignId: parseInt(id),
          accountId,
          phone: contact.phone,
          voiceId: config?.voice_id ?? 'Cantonese_GentleLady',
          greetingText: config?.greeting_text ?? '',
          systemPrompt: config?.system_prompt ?? '',
          callTimeoutSec: config?.call_timeout_sec ?? 60,
        },
        opts: { jobId: `contact-${contact.id}-${Date.now()}` },
      })),
    );
  }

  return NextResponse.json({ ok: true, inserted: newContactIds.length });
}
