import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkFont } from '../src/pdf/checkFont.js';
import { analyzePdf } from '../src/pdf/analyzePdf.js';

import { pdfFile } from './fixtures/pdf.mjs';

test('real PDF analysis resolves hoisted assets and eval worker independently of cwd', { timeout: 20000 }, async () => {
  const previous = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), 'thesis-core-pdf-'));
  try {
    process.chdir(directory);
    const result = await analyzePdf(pdfFile(), { pageSize: 'A4', marginLeftMm: 25, fontFamily: 'Times-Roman', fontSize: 12, lineSpacing: 1.5, maxFileSizeInMb: 50 });
    assert.equal(result.pageSize.valid, true);
    assert.equal(result.fontSize.valid, true);
    assert.equal(result.maxFileSizeInMb.valid, true);
    assert.deepEqual(Object.keys(result).sort(), ['fontFamily', 'fontSize', 'lineSpacing', 'marginLeftMm', 'maxFileSizeInMb', 'pageSize']);
    await assert.rejects(analyzePdf(new File(['broken'], 'broken.pdf'), { pageSize: 'A4', marginLeftMm: 25, fontFamily: 'Times-Roman', fontSize: 12, lineSpacing: 1.5, maxFileSizeInMb: 50 }));
  } finally { process.chdir(previous); await rm(directory, { recursive: true, force: true }); }
});


test('missing font metadata reports an indeterminate check instead of throwing', () => {
  assert.equal(checkFont([], 'Times New Roman').valid, undefined);
});
