import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { TEMPLATE_LIST, getGreeting } from '@/lib/industry-templates';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

async function seedBuiltins(accountId: number) {
  for (const tpl of TEMPLATE_LIST) {
    const { rowCount } = await pool.query(
      `UPDATE campaign_templates SET name=$1, emoji=$2, script=$3, greeting=$4
       WHERE industry=$5 AND is_builtin=true AND account_id=$6`,
      [tpl.name.zh, tpl.emoji, tpl.sampleScript.zh, getGreeting(tpl, 'zh'), tpl.key, accountId],
    );
    if (!rowCount) {
      await pool.query(
        `INSERT INTO campaign_templates (name, emoji, industry, voice_id, script, greeting, is_builtin, account_id)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
        [tpl.name.zh, tpl.emoji, tpl.key, 'Cantonese_GentleLady', tpl.sampleScript.zh, getGreeting(tpl, 'zh'), accountId],
      );
    }
  }
}

export async function GET() {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  await seedBuiltins(accountId);
  const { rows } = await pool.query(
    `SELECT * FROM campaign_templates WHERE account_id = $1 ORDER BY is_builtin DESC, created_at ASC`,
    [accountId],
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { name, emoji, industry, voice_id, script, greeting, wa_confirmation_enabled } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const { rows: [tpl] } = await pool.query(
    `INSERT INTO campaign_templates (name, emoji, industry, voice_id, script, greeting, wa_confirmation_enabled, account_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name.trim(), emoji ?? '📋', industry ?? null, voice_id ?? 'Cantonese_GentleLady',
     script ?? '', greeting ?? '', wa_confirmation_enabled ?? false, accountId],
  );
  return NextResponse.json(tpl, { status: 201 });
}
