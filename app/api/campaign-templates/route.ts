import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { TEMPLATE_LIST, getGreeting } from '@/lib/industry-templates';

// Upsert built-in templates from industry-templates.ts on every request
async function seedBuiltins() {
  for (const tpl of TEMPLATE_LIST) {
    const { rowCount } = await pool.query(
      `UPDATE campaign_templates SET name=$1, emoji=$2, script=$3, greeting=$4
       WHERE industry=$5 AND is_builtin=true`,
      [tpl.name.zh, tpl.emoji, tpl.sampleScript.zh, getGreeting(tpl, 'zh'), tpl.key],
    );
    if (!rowCount) {
      await pool.query(
        `INSERT INTO campaign_templates (name, emoji, industry, voice_id, script, greeting, is_builtin)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [tpl.name.zh, tpl.emoji, tpl.key, 'Cantonese_GentleLady', tpl.sampleScript.zh, getGreeting(tpl, 'zh')],
      );
    }
  }
}

export async function GET() {
  await seedBuiltins();
  const { rows } = await pool.query(
    `SELECT * FROM campaign_templates ORDER BY is_builtin DESC, created_at ASC`,
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { name, emoji, industry, voice_id, script, greeting, wa_confirmation_enabled } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const { rows: [tpl] } = await pool.query(
    `INSERT INTO campaign_templates (name, emoji, industry, voice_id, script, greeting, wa_confirmation_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name.trim(), emoji ?? '📋', industry ?? null, voice_id ?? 'Cantonese_GentleLady',
     script ?? '', greeting ?? '', wa_confirmation_enabled ?? false],
  );
  return NextResponse.json(tpl, { status: 201 });
}
