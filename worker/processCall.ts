import type { Job } from 'bullmq';
import pool from '@/lib/db';
import { getAccountCredentials } from '@/lib/credentials';
import { getSipProvider } from '@/lib/sip-provider';
import twilio from 'twilio';

export interface CallJobData {
  contactId: number;
  campaignId: number;
  accountId: number;
  phone: string;
  voiceId: string;
  greetingText: string;
  systemPrompt: string;
  callTimeoutSec: number;
}

export async function processCall(job: Job<CallJobData>) {
  const { contactId, campaignId, accountId, phone, callTimeoutSec } = job.data;

  // Abort if the campaign has been paused or already completed — jobs may still
  // be sitting in the BullMQ queue after a pause/stop.
  const { rows: [campaignRow] } = await pool.query(
    'SELECT status FROM campaigns WHERE id = $1',
    [campaignId],
  );
  if (campaignRow && campaignRow.status !== 'running') {
    console.log(`[worker] job ${job.id} — skipping contact ${contactId}: campaign ${campaignId} status is '${campaignRow.status}'`);
    await pool.query(
      "UPDATE contacts SET status = 'pending' WHERE id = $1 AND status = 'calling'",
      [contactId],
    );
    return;
  }

  const creds = await getAccountCredentials(accountId);
  if (!creds.twilioAccountSid || !creds.twilioAuthToken) {
    throw new Error(`Twilio credentials not configured for account ${accountId} — set twilio_account_sid and twilio_auth_token in Settings`);
  }
  const baseUrl = creds.webhookBaseUrl || process.env.WEBHOOK_BASE_URL!;

  const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  console.log(`[worker] job ${job.id} — dialling contact ${contactId} (${normalizedPhone}) for campaign ${campaignId} account ${accountId}`);

  await pool.query(
    "UPDATE contacts SET status = 'calling' WHERE id = $1",
    [contactId],
  );

  let callSid: string;

  const sipProvider = await getSipProvider(accountId);
  if (sipProvider) {
    try {
      callSid = await sipProvider.initiateCall({
        to: normalizedPhone,
        contactId,
        campaignId,
        twimlUrl: `${baseUrl}/api/twiml/outbound?contactId=${contactId}&campaignId=${campaignId}`,
        statusCallbackUrl: `${baseUrl}/api/webhooks/call-status`,
        amdCallbackUrl: `${baseUrl}/api/webhooks/amd`,
        recordingCallbackUrl: `${baseUrl}/api/webhooks/recording`,
        timeoutSec: callTimeoutSec,
      });
      console.log(`[worker] contact ${contactId} — FreeSWITCH call created: ${callSid}`);
    } catch (fsErr) {
      const msg = (fsErr as Error).message;
      console.warn(`[worker] FreeSWITCH failed (${msg}), falling back to Twilio`);
      if (creds.voiceProvider === 'freeswitch') throw fsErr;
      callSid = await initiateTwilioCall({ creds, normalizedPhone, baseUrl, contactId, campaignId, callTimeoutSec });
    }
  } else {
    callSid = await initiateTwilioCall({ creds, normalizedPhone, baseUrl, contactId, campaignId, callTimeoutSec });
  }

  await pool.query(
    "UPDATE contacts SET call_sid = $1 WHERE id = $2",
    [callSid, contactId],
  );
}

export async function initiateTwilioCall({
  creds, normalizedPhone, baseUrl, contactId, campaignId, callTimeoutSec,
}: {
  creds: Awaited<ReturnType<typeof getAccountCredentials>>;
  normalizedPhone: string;
  baseUrl: string;
  contactId: number;
  campaignId: number;
  callTimeoutSec: number;
}): Promise<string> {
  const client = twilio(creds.twilioAccountSid, creds.twilioAuthToken);
  const call = await client.calls.create({
    to: normalizedPhone,
    from: creds.twilioPhoneNumber,
    url: `${baseUrl}/api/twiml/outbound?contactId=${contactId}&campaignId=${campaignId}`,
    statusCallback: `${baseUrl}/api/webhooks/call-status`,
    statusCallbackMethod: 'POST',
    timeout: callTimeoutSec,
    record: true,
    recordingStatusCallback: `${baseUrl}/api/webhooks/recording`,
    recordingStatusCallbackMethod: 'POST',
  });
  console.log(`[worker] contact ${contactId} — Twilio call created: ${call.sid}`);
  return call.sid;
}
