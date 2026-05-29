import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const { rows } = await pool.query(
    'SELECT * FROM user_templates ORDER BY created_at DESC',
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, emoji, campaign_name, greeting_text, system_prompt,
          hotline_name, hotline_system_prompt, after_hours_message } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { rows: [tpl] } = await pool.query(
    `INSERT INTO user_templates
       (name, emoji, campaign_name, greeting_text, system_prompt,
        hotline_name, hotline_system_prompt, after_hours_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name.trim(), emoji ?? '⭐', campaign_name ?? null, greeting_text ?? null,
     system_prompt ?? null, hotline_name ?? null, hotline_system_prompt ?? null,
     after_hours_message ?? null],
  );

  return NextResponse.json(tpl, { status: 201 });
}
