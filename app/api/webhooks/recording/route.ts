import pool from '@/lib/db';
import { validateTwilioSignature } from '@/lib/twilio-validate';
import type { NextRequest } from 'next/server';

// Called by Twilio when a recording is ready
// Works for both outbound (call_reports) and inbound (inbound_calls)
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const callSid        = formData.get('CallSid') as string;
  const recordingUrl   = formData.get('RecordingUrl') as string;
  const recordingStatus = formData.get('RecordingStatus') as string;

  if (recordingStatus !== 'completed' || !recordingUrl || !callSid) {
    return new Response('OK', { status: 200 });
  }

  const params = Object.fromEntries(formData.entries()) as Record<string, string>;

  // Resolve account from call_sid (try outbound first, then inbound)
  const { rows: [row] } = await pool.query(
    `SELECT c.account_id FROM contacts ct
     JOIN campaigns c ON c.id = ct.campaign_id
     WHERE ct.call_sid = $1
     UNION ALL
     SELECT h.account_id FROM inbound_calls ic
     JOIN hotlines h ON h.id = ic.hotline_id
     WHERE ic.call_sid = $1
     LIMIT 1`,
    [callSid],
  ).catch(() => ({ rows: [] as { account_id: number }[] }));

  const denied = await validateTwilioSignature(req, params, row?.account_id ?? null);
  if (denied) return denied;

  // Twilio recording URLs require auth — append .mp3 for direct playback
  const mp3Url = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;

  // Try outbound call_reports first, then inbound_calls
  const outbound = await pool.query(
    'UPDATE call_reports SET recording_url = $1 WHERE call_sid = $2',
    [mp3Url, callSid],
  ).catch(() => ({ rowCount: 0 }));

  if (!outbound.rowCount) {
    await pool.query(
      'UPDATE inbound_calls SET recording_url = $1 WHERE call_sid = $2',
      [mp3Url, callSid],
    ).catch(() => {});
  }

  console.log(`[recording] saved for ${callSid}: ${mp3Url}`);
  return new Response('OK', { status: 200 });
}
