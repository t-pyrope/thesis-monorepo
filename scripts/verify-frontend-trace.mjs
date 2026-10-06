import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pdfFile } from '../packages/analysis-core/tests/fixtures/pdf.mjs';

// Recreate only the files Next will ship for the serverless analysis route.
// The shared implementation is bundled by Next. Copy it as a test harness
// to exercise only the dependency assets Next ships, never checkout node_modules.
const root = fileURLToPath(new URL('../', import.meta.url));
const trace = path.join(root, 'apps/frontend/.next/server/app/api/analyze/route.js.nft.json');
const { files } = JSON.parse(await readFile(trace, 'utf8'));
const directory = await mkdtemp(path.join(tmpdir(), 'thesis-trace-'));
const previousCwd = process.cwd();
try {
  for (const file of files) {
    const source = path.resolve(path.dirname(trace), file);
    const relative = path.relative(root, source);
    assert.ok(!relative.startsWith('..'), `File outside monorepo: ${relative}`);
    const target = path.join(directory, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, { dereference: true });
  }
  const harness = path.join(directory, 'test-harness');
  await cp(path.join(root, 'packages/analysis-core/dist'), path.join(harness, 'dist'), { recursive: true });
  await cp(path.join(root, 'packages/analysis-core/package.json'), path.join(harness, 'package.json'));
  await mkdir(path.join(directory, 'apps/frontend'), { recursive: true });
  process.chdir(path.join(directory, 'apps/frontend'));
  const { analyzePdf } = await import(pathToFileURL(path.join(harness, 'dist/pdf/analyzePdf.js')).href);
  const result = await analyzePdf(pdfFile(), { pageSize: 'A4', marginLeftMm: 25, fontFamily: 'Times-Roman', fontSize: 12, lineSpacing: 1.5, maxFileSizeInMb: 50 });
  assert.equal(result.pageSize.valid, true);
  assert.equal(result.fontSize.valid, true);
  console.log('Frontend deployment trace: real PDF and isolated table worker passed.');
} finally { process.chdir(previousCwd); await rm(directory, { recursive: true, force: true }); }
