import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export function getQueueName() {
  const prefix = process.env.QUEUE_PREFIX || 'prod';
  return `${prefix}-outbound-calls`;
}

let _queue: Queue | null = null;

export function getOutboundCallsQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(getQueueName(), {
      connection: new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
      }),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return _queue;
}

// Keep backward-compatible export as a getter proxy
export const outboundCallsQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    return (getOutboundCallsQueue() as any)[prop];
  },
});
