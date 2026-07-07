import { NextRequest } from 'next/server';
import { getAccountCredentials } from '@/lib/credentials';
import pool from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sid: string }> },
) {
  const { sid } = await params;

  // Look up account from the recording SID via call_sid
  const { rows: [row] } = await pool.query(
    `SELECT c.account_id FROM call_reports cr
     JOIN contacts ct ON ct.id = cr.contact_id
     JOIN campaigns c ON c.id = cr.campaign_id
     WHERE cr.recording_url LIKE $1
     UNION
     SELECT account_id FROM inbound_calls WHERE recording_url LIKE $1
     LIMIT 1`,
    [`%${sid}%`],
  );

  const accountId = row?.account_id ?? null;
  const creds = await getAccountCredentials(accountId ?? 1);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.twilioAccountSid}/Recordings/${sid}.mp3`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.twilioAccountSid}:${creds.twilioAuthToken}`).toString('base64')}`,
    },
  });

  if (!resp.ok) return new Response('Not found', { status: 404 });

  return new Response(resp.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
