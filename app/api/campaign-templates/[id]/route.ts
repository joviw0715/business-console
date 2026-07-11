import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }
  const { name, emoji, industry, voice_id, script, greeting, wa_confirmation_enabled } = body as Record<string, unknown>;

  const { rowCount } = await pool.query(
    `UPDATE campaign_templates SET
       name = COALESCE($1, name), emoji = COALESCE($2, emoji),
       industry = $3, voice_id = COALESCE($4, voice_id),
       script = COALESCE($5, script), greeting = COALESCE($6, greeting),
       wa_confirmation_enabled = COALESCE($8, wa_confirmation_enabled),
       updated_at = NOW()
     WHERE id = $7 AND account_id = $9`,
    [name ?? null, emoji ?? null, industry ?? null, voice_id ?? null,
     script ?? null, greeting ?? null, id, wa_confirmation_enabled ?? null, accountId],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;
  const { rowCount } = await pool.query(
    'DELETE FROM campaign_templates WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
