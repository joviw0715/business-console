import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { Campaign } from '@/types';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

const PAGE_SIZE = 8;

function buildStatusFilter(group: string): { clause: string; params: string[] } {
  if (group === 'active') return { clause: "AND c.status IN ('running','scheduled','paused')", params: [] };
  if (group === 'done')   return { clause: "AND c.status = 'done'",   params: [] };
  if (group === 'draft')  return { clause: "AND c.status = 'draft'",  params: [] };
  return { clause: '', params: [] };
}

export async function GET(req: Request) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);

  const url = new URL(req.url);
  const group  = url.searchParams.get('group') ?? '';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit  = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? String(PAGE_SIZE), 10) || PAGE_SIZE));
  const offset = (page - 1) * limit;

  const { clause } = buildStatusFilter(group);

  const { rows } = await pool.query<Campaign>(`
    SELECT c.*,
      COUNT(ct.id)::int AS total_contacts,
      COUNT(ct.id) FILTER (WHERE ct.status = 'done')::int AS called_contacts
    FROM campaigns c
    LEFT JOIN contacts ct ON ct.campaign_id = c.id
    WHERE c.account_id = $3 ${clause}
    GROUP BY c.id ORDER BY c.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset, accountId]);

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM campaigns c WHERE c.account_id = $1 ${clause}`,
    [accountId],
  );

  return NextResponse.json({ campaigns: rows, total: count, page, limit });
}

export async function POST(req: Request) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);

  const body = await req.json();
  const {
    name, description, system_prompt, voice_id, max_retries, call_timeout_sec,
    greeting_text, webhook_url, scheduled_at, concurrency,
    contacts, campaign_template_id,
  } = body as {
    name: string; description?: string; system_prompt?: string; voice_id?: string;
    max_retries?: number; call_timeout_sec?: number; greeting_text?: string;
    webhook_url?: string; scheduled_at?: string | null; concurrency?: number;
    campaign_template_id?: number;
    contacts?: Array<{ name: string; phone: string; custom_field?: string }>;
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO campaigns (name, description, status, scheduled_at, campaign_template_id, account_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, description ?? null, scheduled_at ? 'scheduled' : 'draft', scheduled_at ?? null, campaign_template_id ?? null, accountId],
    );
    const id = rows[0].id;

    await client.query(
      `INSERT INTO campaign_config (campaign_id, system_prompt, voice_id, max_retries, call_timeout_sec, greeting_text, webhook_url, concurrency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (campaign_id) DO UPDATE SET
         system_prompt = EXCLUDED.system_prompt, voice_id = EXCLUDED.voice_id,
         max_retries = EXCLUDED.max_retries, call_timeout_sec = EXCLUDED.call_timeout_sec,
         greeting_text = EXCLUDED.greeting_text, webhook_url = EXCLUDED.webhook_url,
         concurrency = EXCLUDED.concurrency`,
      [id, system_prompt ?? '', voice_id ?? 'Cantonese_GentleLady', max_retries ?? 2,
       call_timeout_sec ?? 60, greeting_text ?? '', webhook_url ?? null, concurrency ?? 3],
    );

    if (contacts && contacts.length > 0) {
      const validContacts = contacts.filter((c) => c.phone?.trim());
      if (validContacts.length > 0) {
        const values = validContacts
          .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
          .join(', ');
        const params = validContacts.flatMap((c) => [
          id,
          c.phone.trim(),
          c.name?.trim() || null,
          c.custom_field?.trim() ? JSON.stringify({ field: c.custom_field.trim() }) : null,
        ]);
        await client.query(
          `INSERT INTO contacts (campaign_id, phone, name, custom_data) VALUES ${values}`,
          params,
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
