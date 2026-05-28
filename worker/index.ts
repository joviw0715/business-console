import { Worker, Queue } from 'bullmq';
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

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Worker needs its own dedicated IORedis connection (separate from Queue)
const workerConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
// Queue connection for heartbeat only (getJobCounts is a Queue method, not Worker)
const heartbeatQueue = new Queue<CallJobData>('outbound-calls', {
  connection: new IORedis(redisUrl, { maxRetriesPerRequest: null }),
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
  console.log(`[worker] job ${job.id} completed — contact ${job.data.contactId}`);
});

worker.on('failed', (job, err) => {
  if (!job) {
    console.error(`[worker] job failed (no job data): ${err.message}\n${err.stack}`);
    return;
  }
  console.error(
    `[worker] job ${job.id} FAILED\n` +
    `  contact=${job.data.contactId} campaign=${job.data.campaignId} phone=${job.data.phone}\n` +
    `  attempts=${job.attemptsMade}/${job.opts.attempts ?? 1}\n` +
    `  error: ${err.message}\n` +
    `  stack: ${err.stack ?? '(no stack)'}`,
  );
  pool.query(
    "UPDATE contacts SET status = 'failed' WHERE id = $1",
    [job.data.contactId],
  ).catch((dbErr) => console.error(`[worker] failed to update contact status: ${dbErr.message}`));
});

worker.on('error', (err) => {
  console.error(`[worker] worker error: ${err.message}\n${err.stack ?? ''}`);
});

worker.on('active', (job) => {
  console.log(`[worker] job ${job.id} active — contact ${job.data.contactId} (${job.data.phone})`);
});

// Heartbeat: log queue counts + dump any failed jobs so the failure reason is visible
setInterval(async () => {
  try {
    const counts = await heartbeatQueue.getJobCounts();
    const level = counts.failed > 0 ? 'error' : 'log';
    console[level](`[worker] heartbeat — queue: ${JSON.stringify(counts)}`);

    if (counts.failed > 0) {
      const failedJobs = await heartbeatQueue.getFailed(0, 4); // last 5 failed jobs
      for (const job of failedJobs) {
        console.error(
          `[worker] failed job ${job.id}: ${job.failedReason ?? '(no reason stored)'}\n` +
          `  contact=${job.data?.contactId} campaign=${job.data?.campaignId} phone=${job.data?.phone}\n` +
          `  stacktrace: ${job.stacktrace?.[0] ?? '(none)'}`,
        );
      }
    }
  } catch (err) {
    console.error(`[worker] heartbeat error: ${err instanceof Error ? err.message : String(err)}`);
  }
}, 30000);

console.log(`[worker] started — concurrency: ${process.env.CAMPAIGN_CONCURRENCY ?? '3'}, redis: ${redisUrl}`);

// On startup, immediately dump any pre-existing failed jobs so we see them on deploy
heartbeatQueue.getFailed(0, 9).then((failedJobs) => {
  if (failedJobs.length === 0) return;
  console.error(`[worker] ${failedJobs.length} pre-existing failed job(s) in queue:`);
  for (const job of failedJobs) {
    console.error(
      `  job ${job.id}: ${job.failedReason ?? '(no reason)'} — contact=${job.data?.contactId} phone=${job.data?.phone}`,
    );
  }
}).catch(() => {});
