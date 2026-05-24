import { Worker } from 'bullmq';
import { twilioClient } from '@/lib/twilio';
import pool from '@/lib/db';
import { redisConnection } from '@/lib/queue';
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

const worker = new Worker<CallJobData>('outbound-calls', processCall, {
  connection: redisConnection,
  concurrency: parseInt(process.env.CAMPAIGN_CONCURRENCY ?? '3'),
});

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  if (!job) return;
  console.error(`[worker] job ${job.id} failed:`, err.message);
  pool.query(
    "UPDATE contacts SET status = 'failed' WHERE id = $1",
    [job.data.contactId],
  ).catch(() => {});
});

console.log('[worker] outbound-calls worker started');
