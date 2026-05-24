import { twilioClient } from '@/lib/twilio';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';
import type { Job } from 'bullmq';

interface CallJobData {
  contactId: number;
  campaignId: number;
  phone: string;
  voiceId: string;
  greetingText: string;
  systemPrompt: string;
  callTimeoutSec: number;
}

async function processCall(job: Job<CallJobData>) {
  const { contactId, campaignId, phone, callTimeoutSec } = job.data;
  const baseUrl = process.env.WEBHOOK_BASE_URL!;
  const voiceWebhookUrl = process.env.VOICE_WEBHOOK_URL!;

  await pool.query(
    "UPDATE contacts SET status = 'calling' WHERE id = $1",
    [contactId],
  );

  const call = await twilioClient.calls.create({
    to: phone,
    from: process.env.TWILIO_PHONE_NUMBER!,
    url: `${baseUrl}/api/twiml/outbound?contactId=${contactId}&campaignId=${campaignId}`,
    statusCallback: `${baseUrl}/api/webhooks/call-status`,
    statusCallbackMethod: 'POST',
    timeout: callTimeoutSec,
    machineDetection: 'DetectMessageEnd',
    asyncAmd: 'true',
    asyncAmdStatusCallback: `${baseUrl}/api/webhooks/amd`,
  });

  await pool.query(
    "UPDATE contacts SET call_sid = $1 WHERE id = $2",
    [call.sid, contactId],
  );

  console.log(`[worker] dialled ${phone} → ${call.sid}`);
}

outboundCallsQueue.process(
  parseInt(process.env.CAMPAIGN_CONCURRENCY ?? '3'),
  processCall,
);

outboundCallsQueue.on('completed', async (job: Job<CallJobData>) => {
  console.log(`[worker] job ${job.id} completed`);
});

outboundCallsQueue.on('failed', async (job: Job<CallJobData> | undefined, err: Error) => {
  if (!job) return;
  console.error(`[worker] job ${job.id} failed:`, err.message);
  await pool.query(
    "UPDATE contacts SET status = 'failed' WHERE id = $1",
    [job.data.contactId],
  ).catch(() => {});
});

console.log('[worker] outbound-calls worker started');
