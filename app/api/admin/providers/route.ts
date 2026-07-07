import { requireAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { safeCompare } from '@/lib/webhook-auth';

const KEYS = ['provider:llm', 'provider:tts', 'provider:stt'] as const;
const VALID_LLM = ['auto', 'ctm', 'gemini', 'groq', 'openrouter', 'openclaw'];
const VALID_TTS = ['auto', 'ctm', 'minimax'];
const VALID_STT = ['auto', 'ctm', 'azure'];

async function readFromDb() {
  const { rows } = await pool.query(
    `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
    [KEYS],
  );
  const map = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    llm: map['provider:llm'] ?? 'auto',
    tts: map['provider:tts'] ?? 'auto',
    stt: map['provider:stt'] ?? 'auto',
  };
}

async function syncToVoiceService(config: { llm: string; tts: string; stt: string }) {
  const raw = (process.env.VOICE_WEBHOOK_URL || '').trim();
  if (!raw) return;
  const withProtocol = raw.startsWith('http') ? raw : `https://${raw}`;
  let base: string;
  try { base = new URL(withProtocol).origin; } catch { return; }
  const t = process.env.CONSOLE_API_TOKEN || '';
  try {
    const resp = await fetch(`${base}/admin/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(config),
    });
    if (!resp.ok) console.warn(`[admin/providers] voice service sync failed: ${resp.status} ${resp.statusText}`);
    else console.log('[admin/providers] voice service synced ok');
  } catch (err) {
    console.warn('[admin/providers] failed to sync to voice service:', err instanceof Error ? err.message : err);
  }
}

export async function GET(req: Request) {
  // Accept Bearer token from voice-claw-webhook (fallback rehydration)
  const token = process.env.CONSOLE_API_TOKEN;
  const auth = req.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const isServiceCall = token && provided && safeCompare(provided, token);

  if (!isServiceCall) await requireAdmin();
  try {
    const config = await readFromDb();
    return NextResponse.json(config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/providers GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const { llm, tts, stt } = await req.json();
    if (llm && !VALID_LLM.includes(llm)) return NextResponse.json({ error: `Invalid llm: ${llm}` }, { status: 400 });
    if (tts && !VALID_TTS.includes(tts)) return NextResponse.json({ error: `Invalid tts: ${tts}` }, { status: 400 });
    if (stt && !VALID_STT.includes(stt)) return NextResponse.json({ error: `Invalid stt: ${stt}` }, { status: 400 });

    const current = await readFromDb();
    const updated = {
      llm: llm ?? current.llm,
      tts: tts ?? current.tts,
      stt: stt ?? current.stt,
    };

    // Upsert all three keys into app_settings
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES
         ('provider:llm', $1), ('provider:tts', $2), ('provider:stt', $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [updated.llm, updated.tts, updated.stt],
    );

    // Best-effort sync to voice-claw-webhook Redis cache
    await syncToVoiceService(updated);

    console.log('[admin/providers] saved to DB:', updated);
    return NextResponse.json({ ok: true, config: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/providers POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
