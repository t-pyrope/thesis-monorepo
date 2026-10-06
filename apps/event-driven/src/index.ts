import 'dotenv/config';
import { createApp } from './app.js';
import { createQueue } from './jobs.js';
import { createObjectStore } from './storage.js';
import { validateEnvironment } from './config.js';

validateEnvironment('api');
const queue = createQueue();
const server = createApp(queue, createObjectStore()).listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => { void queue.close().then(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 25_000).unref();
  });
}
