import { NextRequest } from 'next/server';
import { getAccountCredentials } from '@/lib/credentials';
import { requireAuth, effectiveAccountId } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sid: string }> },
) {
  const session = await requireAuth();
  const sessionAccountId = effectiveAccountId(session);
  const { sid } = await params;

  // Look up account from the recording SID — scoped to the session's account
  const { rows: [row] } = await pool.query(
    `SELECT c.account_id FROM call_reports cr
     JOIN contacts ct ON ct.id = cr.contact_id
     JOIN campaigns c ON c.id = cr.campaign_id
     WHERE cr.recording_url LIKE $1 AND c.account_id = $2
     UNION
     SELECT account_id FROM inbound_calls
     WHERE recording_url LIKE $1 AND account_id = $2
     LIMIT 1`,
    [`%${sid}%`, sessionAccountId],
  );

  // Deny if no matching record found for this account (unless admin viewing any account)
  if (!row && !session.isAdmin) {
    return new Response('Not found', { status: 404 });
  }

  const accountId = row?.account_id ?? (session.isAdmin ? sessionAccountId : null);
  if (!accountId) return new Response('Not found', { status: 404 });
  const creds = await getAccountCredentials(accountId);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.twilioAccountSid}/Recordings/${sid}.mp3`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.twilioAccountSid}:${creds.twilioAuthToken}`).toString('base64')}`,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) return new Response('Not found', { status: 404 });

  return new Response(resp.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
