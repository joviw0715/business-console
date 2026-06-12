import pool from '@/lib/db';

// Called by Twilio when a recording is ready
// Works for both outbound (call_reports) and inbound (inbound_calls)
export async function POST(req: Request) {
  const formData = await req.formData();
  const callSid        = formData.get('CallSid') as string;
  const recordingUrl   = formData.get('RecordingUrl') as string;
  const recordingStatus = formData.get('RecordingStatus') as string;

  if (recordingStatus !== 'completed' || !recordingUrl || !callSid) {
    return new Response('OK', { status: 200 });
  }

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
