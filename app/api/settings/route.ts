import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const DEFAULTS: Record<string, string> = {
  business_name:       '',
  wa_outbound_enabled: 'false',
  wa_inbound_enabled:  'false',
  wa_template_sid:     '',
};

export async function GET() {
  // Ensure default rows exist
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, value],
    );
  }
  const { rows } = await pool.query('SELECT key, value FROM app_settings');
  const settings = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    if (key in DEFAULTS) {
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, String(value)],
      );
    }
  }
  return NextResponse.json({ ok: true });
}
