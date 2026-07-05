import pool from '@/lib/db';
import { validateTwilioSignature } from '@/lib/twilio-validate';
import type { NextRequest } from 'next/server';

// Called by Twilio when a call's status changes (ringing, busy, no-answer, failed)
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries()) as Record<string, string>;

  // Resolve account from contact's campaign to get the right auth token
  const callSid = params.CallSid;
  const { rows: [contact] } = await pool.query(
    'SELECT c.account_id FROM contacts ct JOIN campaigns c ON c.id = ct.campaign_id WHERE ct.call_sid = $1 LIMIT 1',
    [callSid],
  ).catch(() => ({ rows: [] }));

  const denied = await validateTwilioSignature(req, params, contact?.account_id ?? null);
  if (denied) return denied;

  const callStatus = params.CallStatus;
  const duration   = params.CallDuration ?? null;

  const TERMINAL: Record<string, string> = {
    'completed': 'answered',
    'busy':      'busy',
    'no-answer': 'no_answer',
    'failed':    'failed',
    'canceled':  'failed',
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
