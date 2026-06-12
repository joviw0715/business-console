import pool from '@/lib/db';

// Called by voice-claw-webhook after each completed turn to push live transcript
export async function POST(req: Request) {
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
