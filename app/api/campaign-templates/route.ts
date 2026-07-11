import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { TEMPLATE_LIST, getGreeting } from '@/lib/industry-templates';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

async function seedBuiltinsIfNeeded(accountId: number) {
  // Only run the upsert loop when the account has no built-in templates yet.
  // This avoids N write queries on every read once seeding is complete.
  const { rows } = await pool.query(
    'SELECT 1 FROM campaign_templates WHERE account_id = $1 AND is_builtin = true LIMIT 1',
    [accountId],
  );
  if (rows.length > 0) return;

  for (const tpl of TEMPLATE_LIST) {
    await pool.query(
      `INSERT INTO campaign_templates (name, emoji, industry, voice_id, script, greeting, is_builtin, account_id)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       ON CONFLICT DO NOTHING`,
      [tpl.name.zh, tpl.emoji, tpl.key, 'Cantonese_GentleLady', tpl.sampleScript.zh, getGreeting(tpl, 'zh'), accountId],
    );
  }
}

export async function GET() {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  await seedBuiltinsIfNeeded(accountId);
  const { rows } = await pool.query(
    `SELECT * FROM campaign_templates WHERE account_id = $1 ORDER BY is_builtin DESC, created_at ASC`,
    [accountId],
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }
  const { name, emoji, industry, voice_id, script, greeting, wa_confirmation_enabled } = body as Record<string, unknown>;
  if (!(name as string)?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const { rows: [tpl] } = await pool.query(
    `INSERT INTO campaign_templates (name, emoji, industry, voice_id, script, greeting, wa_confirmation_enabled, account_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name.trim(), emoji ?? '📋', industry ?? null, voice_id ?? 'Cantonese_GentleLady',
     script ?? '', greeting ?? '', wa_confirmation_enabled ?? false, accountId],
  );
  return NextResponse.json(tpl, { status: 201 });
}
