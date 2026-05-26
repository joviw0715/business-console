import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { twilioClient } from '@/lib/twilio';
import pool from '@/lib/db';
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

// Worker needs its own dedicated IORedis connection (separate from Queue)
const workerConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

workerConnection.on('connect', () => console.log('[worker] redis connected'));
workerConnection.on('error', (err) => console.error('[worker] redis error:', err.message));

async function processCall(job: Job<CallJobData>) {
  const { contactId, campaignId, phone, callTimeoutSec } = job.data;
  const baseUrl = process.env.WEBHOOK_BASE_URL!;

  console.log(`[worker] job ${job.id} — dialling contact ${contactId} (${phone}) for campaign ${campaignId}`);

  await pool.query(
    "UPDATE contacts SET status = 'calling' WHERE id = $1",
    [contactId],
  );
  console.log(`[worker] contact ${contactId} status → calling`);

  const call = await twilioClient.calls.create({
    to: phone.startsWith('+') ? phone : `+${phone}`,
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

  console.log(`[worker] contact ${contactId} — Twilio call created: ${call.sid}`);
}

const worker = new Worker<CallJobData>('outbound-calls', processCall, {
  connection: workerConnection,
  concurrency: parseInt(process.env.CAMPAIGN_CONCURRENCY ?? '3'),
});

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  if (!job) return;
  console.error(`[worker] job ${job.id} failed: ${err.message}`);
  pool.query(
    "UPDATE contacts SET status = 'failed' WHERE id = $1",
    [job.data.contactId],
  ).catch(() => {});
});

worker.on('error', (err) => {
  console.error('[worker] worker error:', err.message);
});

worker.on('active', (job) => {
  console.log(`[worker] job ${job.id} active — processing`);
});

// Heartbeat so we can confirm the worker is still alive
setInterval(() => {
  worker.getJobCounts().then((counts) => {
    console.log(`[worker] heartbeat — queue: ${JSON.stringify(counts)}`);
  }).catch(() => {});
}, 30000);

console.log(`[worker] started — concurrency: ${process.env.CAMPAIGN_CONCURRENCY ?? '3'}, redis: ${process.env.REDIS_URL ?? 'redis://localhost:6379'}`);
