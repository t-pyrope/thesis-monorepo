import { cpSync } from 'node:fs';
cpSync(new URL('../src/docs', import.meta.url), new URL('../dist/docs', import.meta.url), { recursive: true });
