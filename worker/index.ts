import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import pool from '@/lib/db';
import { getAccountCredentials } from '@/lib/credentials';
import twilio from 'twilio';
import type { Job } from 'bullmq';

interface CallJobData {
  contactId: number;
  campaignId: number;
  accountId: number;
  phone: string;
  voiceId: string;
  greetingText: string;
  systemPrompt: string;
  callTimeoutSec: number;
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const workerConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const heartbeatQueue = new Queue<CallJobData>('outbound-calls', {
  connection: new IORedis(redisUrl, { maxRetriesPerRequest: null }),
});

workerConnection.on('connect', () => console.log('[worker] redis connected'));
workerConnection.on('error', (err) => console.error('[worker] redis error:', err.message));

async function processCall(job: Job<CallJobData>) {
  const { contactId, campaignId, accountId, phone, callTimeoutSec } = job.data;

  const creds = await getAccountCredentials(accountId);
  const baseUrl = creds.webhookBaseUrl || process.env.WEBHOOK_BASE_URL!;

  let normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  console.log(`[worker] job ${job.id} — dialling contact ${contactId} (${normalizedPhone}) for campaign ${campaignId} account ${accountId}`);

  await pool.query(
    "UPDATE contacts SET status = 'calling' WHERE id = $1",
    [contactId],
  );

  const client = twilio(creds.twilioAccountSid, creds.twilioAuthToken);
  const call = await client.calls.create({
    to: normalizedPhone,
    from: creds.twilioPhoneNumber,
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
  console.log(`[worker] job ${job.id} completed — contact ${job.data.contactId} account ${job.data.accountId}`);
});

worker.on('failed', (job, err) => {
  if (!job) {
    console.error(`[worker] job failed (no job data): ${err.message}\n${err.stack}`);
    return;
  }
  console.error(
    `[worker] job ${job.id} FAILED\n` +
    `  contact=${job.data.contactId} campaign=${job.data.campaignId} phone=${job.data.phone} account=${job.data.accountId}\n` +
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
  console.log(`[worker] job ${job.id} active — contact ${job.data.contactId} (${job.data.phone}) account ${job.data.accountId}`);
});

setInterval(async () => {
  try {
    const counts = await heartbeatQueue.getJobCounts();
    if (counts.failed > 0) {
      console.error(`[worker] heartbeat — queue: ${JSON.stringify(counts)}`);
      const failedJobs = await heartbeatQueue.getFailed(0, 4);
      for (const job of failedJobs) {
        console.error(
          `[worker] failed job ${job.id}: ${job.failedReason ?? '(no reason stored)'}\n` +
          `  contact=${job.data?.contactId} campaign=${job.data?.campaignId} phone=${job.data?.phone} account=${job.data?.accountId}\n` +
          `  stacktrace: ${job.stacktrace?.[0] ?? '(none)'}`,
        );
      }
    } else {
      console.log(`[worker] heartbeat — queue: ${JSON.stringify(counts)}`);
    }
  } catch (err) {
    console.log(`[worker] heartbeat error: ${err instanceof Error ? err.message : String(err)}`);
  }
}, 30000);

console.log(`[worker] started — concurrency: ${process.env.CAMPAIGN_CONCURRENCY ?? '3'}, redis: ${redisUrl}`);

heartbeatQueue.getFailed(0, 9).then((failedJobs) => {
  if (failedJobs.length === 0) return;
  console.error(`[worker] ${failedJobs.length} pre-existing failed job(s) in queue:`);
  for (const job of failedJobs) {
    console.error(
      `  job ${job.id}: ${job.failedReason ?? '(no reason)'} — contact=${job.data?.contactId} phone=${job.data?.phone}`,
    );
  }
}).catch(() => {});
