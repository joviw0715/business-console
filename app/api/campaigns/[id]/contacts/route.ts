import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows: [campaign] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limitParsed = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = !Number.isNaN(limitParsed) ? Math.min(500, Math.max(1, limitParsed)) : null;

  const { rows } = await pool.query(
    `SELECT * FROM contacts WHERE campaign_id = $1 ORDER BY created_at DESC${limit ? ' LIMIT $2' : ''}`,
    limit ? [id, limit] : [id],
  );
  return NextResponse.json({ contacts: rows });
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

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }
  const contacts: { name?: string; phone: string; custom_field?: string }[] = (body.contacts as typeof contacts) ?? [];
  if (!contacts.length) return NextResponse.json({ error: 'No contacts provided' }, { status: 400 });

  const newContactIds: number[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const valid = contacts.filter((c) => c.phone?.trim());
    // Chunk to 1000 rows per INSERT to stay well under PostgreSQL's 65535 bind-param limit (4 params/row)
    const CHUNK = 1000;
    for (let offset = 0; offset < valid.length; offset += CHUNK) {
      const chunk = valid.slice(offset, offset + CHUNK);
      const vals = chunk.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
      const chunkParams = chunk.flatMap((c) => [
        id,
        c.name?.trim() || null,
        c.phone.trim(),
        c.custom_field ? JSON.stringify({ note: c.custom_field }) : null,
      ]);
      const { rows } = await client.query(
        `INSERT INTO contacts (campaign_id, name, phone, custom_data)
         VALUES ${vals} ON CONFLICT (campaign_id, phone) DO NOTHING RETURNING id`,
        chunkParams,
      );
      rows.forEach((r) => newContactIds.push(r.id));
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
    try {
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
          opts: { jobId: `contact-${contact.id}` },
        })),
      );
    } catch (enqueueErr: unknown) {
      // Contacts are already committed to the DB — do not fail this request.
      console.error(`[contacts/post] addBulk failed (contacts saved):`, enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr));
    }
  }

  return NextResponse.json({ ok: true, inserted: newContactIds.length });
}
