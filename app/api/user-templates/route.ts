import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function GET() {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { rows } = await pool.query(
    'SELECT * FROM user_templates WHERE account_id = $1 ORDER BY created_at DESC',
    [accountId],
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const body = await req.json();
  const { name, emoji, campaign_name, greeting_text, system_prompt,
          hotline_name, hotline_system_prompt, after_hours_message } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const { rows: [tpl] } = await pool.query(
    `INSERT INTO user_templates
       (name, emoji, campaign_name, greeting_text, system_prompt,
        hotline_name, hotline_system_prompt, after_hours_message, account_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name.trim(), emoji ?? '⭐', campaign_name ?? null, greeting_text ?? null,
     system_prompt ?? null, hotline_name ?? null, hotline_system_prompt ?? null,
     after_hours_message ?? null, accountId],
  );
  return NextResponse.json(tpl, { status: 201 });
}
