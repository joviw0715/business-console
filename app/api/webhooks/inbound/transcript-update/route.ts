import pool from '@/lib/db';
import { safeCompare } from '@/lib/webhook-auth';

// Called by voice-claw-webhook after each completed turn to push live transcript
export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!safeCompare(provided, secret)) return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return new Response('OK', { status: 200 }); }

  const { call_sid, transcript } = body as { call_sid: string; transcript: string };
  if (!call_sid || !transcript) return new Response('OK', { status: 200 });

  await pool.query(
    'UPDATE inbound_calls SET transcript = $1 WHERE call_sid = $2 AND ended_at IS NULL',
    [transcript, call_sid],
  ).catch(() => {});

  return new Response('OK', { status: 200 });
}
