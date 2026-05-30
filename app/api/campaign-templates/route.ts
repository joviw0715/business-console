import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { TEMPLATE_LIST } from '@/lib/industry-templates';
import { getGreeting } from '@/lib/industry-templates';

const VOICES: Record<string, string> = {
  'Cantonese_GentleLady': 'Jamie (Female Cantonese)',
  'Cantonese_BrightBoy':  'Kenji (Male Cantonese)',
  'Cantonese_WarmLady':   'Anna (Female English)',
  'moss_audio_6b759cbc-5c17-11f1-af91-92eea1bed9bb': 'Moss',
  'moss_audio_eb6bf7b8-5c1b-11f1-8f84-faf87dcc54b3': 'Test Voice',
};

// Seed built-in templates from industry-templates.ts if table is empty
async function seedBuiltins() {
  const { rows } = await pool.query(`SELECT COUNT(*) FROM campaign_templates WHERE is_builtin = true`);
  if (parseInt(rows[0].count) > 0) return;

  for (const tpl of TEMPLATE_LIST) {
    await pool.query(
      `INSERT INTO campaign_templates (name, emoji, industry, voice_id, script, greeting, is_builtin)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT DO NOTHING`,
      [
        `${tpl.name.zh} — default`,
        tpl.emoji,
        tpl.key,
        'Cantonese_GentleLady',
        tpl.sampleScript.zh,
        getGreeting(tpl, 'zh'),
      ],
    );
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
  const { name, emoji, industry, voice_id, script, greeting } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const { rows: [tpl] } = await pool.query(
    `INSERT INTO campaign_templates (name, emoji, industry, voice_id, script, greeting)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name.trim(), emoji ?? '📋', industry ?? null, voice_id ?? 'Cantonese_GentleLady',
     script ?? '', greeting ?? ''],
  );
  return NextResponse.json(tpl, { status: 201 });
}
