import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { requireAdmin } from '@/lib/auth';
import { getQueueName } from '@/lib/queue';

export async function POST() {
  await requireAdmin();
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const conn = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  try {
    const q = new Queue(getQueueName(), { connection: conn });
    const failedJobs = await q.getFailed(0, 99);
    const ids = failedJobs.map((j) => j.id).filter(Boolean) as string[];

    for (const job of failedJobs) {
      await job.remove();
    }

    await q.close();
    return NextResponse.json({ removed: ids.length, ids });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    conn.disconnect();
  }
}
