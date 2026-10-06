import { createHmac } from 'node:crypto';
import { Queue } from 'bullmq';
import { logAnalysisError } from './instrumentation/analysis.js';

export const QUEUE_NAME = 'academic-analysis';
export const EVENT_NAME = 'AnalysisRequested';
export type AnalysisRequested = { manifestKey: string; owner: string };
export type Manifest = {
  rules: string;
  assignment: string;
  documents: { key: string; name: string; type: string }[];
};

export function sessionOwner(token: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET!).update(token).digest('hex');
}

export function redisConnection() {
  const url = new URL(process.env.REDIS_URL!);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

export function createQueue() {
  const queue = new Queue<AnalysisRequested>(QUEUE_NAME, {
    connection: { ...redisConnection(), maxRetriesPerRequest: 1, enableOfflineQueue: false },
    defaultJobOptions: { attempts: 1, removeOnComplete: false, removeOnFail: false },
  });
  queue.on('error', error => logAnalysisError('analysis.queue.error', error));
  return queue;
}

export const resultKey = (jobId: string) => `analyses/${jobId}/result.json`;
