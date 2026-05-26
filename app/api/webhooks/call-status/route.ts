import pool from '@/lib/db';

// Called by Twilio when a call's status changes (ringing, busy, no-answer, failed)
export async function POST(req: Request) {
  const formData = await req.formData();
  const callSid    = formData.get('CallSid') as string;
  const callStatus = formData.get('CallStatus') as string;
  const duration   = formData.get('CallDuration') as string | null;

  const TERMINAL: Record<string, string> = {
    'busy':        'busy',
    'no-answer':   'no_answer',
    'failed':      'failed',
    'canceled':    'failed',
  };

  const outcome = TERMINAL[callStatus];
  if (outcome) {
    await pool.query(
      "UPDATE contacts SET status = 'done', outcome = $1, duration_sec = $2 WHERE call_sid = $3",
      [outcome, duration ? parseInt(duration) : null, callSid],
    ).catch(() => {});
  }

  return new Response('OK', { status: 200 });
}
