import pool from '@/lib/db';
import { validateTwilioSignature } from '@/lib/twilio-validate';
import type { NextRequest } from 'next/server';

// Called by Twilio when a call's status changes (ringing, busy, no-answer, failed)
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries()) as Record<string, string>;

  // Resolve account and campaign from contact's campaign to get the right auth token
  const callSid = params.CallSid;
  const { rows: [contact] } = await pool.query(
    'SELECT c.account_id, c.id AS campaign_id FROM contacts ct JOIN campaigns c ON c.id = ct.campaign_id WHERE ct.call_sid = $1 LIMIT 1',
    [callSid],
  ).catch(() => ({ rows: [] as { account_id: number; campaign_id: number }[] }));

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

    // Check if the campaign is now complete. This handles calls that end via Twilio
    // status callbacks (busy, no-answer, failed, canceled) without a call-complete
    // webhook from the voice AI server.
    if (contact?.campaign_id) {
      try {
        const { rows: [counts] } = await pool.query(
          "SELECT COUNT(*) FILTER (WHERE status IN ('pending', 'calling')) AS active FROM contacts WHERE campaign_id = $1",
          [contact.campaign_id],
        );
        if (parseInt(counts.active) === 0) {
          await pool.query(
            "UPDATE campaigns SET status = 'done', completed_at = NOW() WHERE id = $1 AND status = 'running'",
            [contact.campaign_id],
          );
        }
      } catch {
        // Non-fatal — do not block the Twilio response
      }
    }
  }

  return new Response('OK', { status: 200 });
}
