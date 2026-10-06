import { analyzeDocuments } from './ai.js';
import { analyzePdf } from './pdf/analyzePdf.js';
import { DOCUMENTS } from './documents.js';
import type { CheckResult } from './types.js';
import { getJson, putJson, type ObjectStore } from './storage.js';
import { resultKey, type Manifest, type AnalysisRequested } from './jobs.js';
import { measureAnalysisRequest, measureAnalysisStage } from './instrumentation/analysis.js';

export function createProcessor(store: ObjectStore, deps = { analyzePdf, analyzeDocuments }) {
  return async (job: { id?: string; data: AnalysisRequested }) => {
    if (!job.id) throw new Error('Missing job ID');
    const jobId = job.id;
    await measureAnalysisRequest(async (measureDocument) => {
      const manifest = await getJson<Manifest>(store, job.data.manifestKey);
      const profile = DOCUMENTS.find(item => item.profile_id === manifest.rules);
      if (!profile) throw new Error('Invalid profile');
      const results: Record<string, CheckResult> = Object.create(null);
      for (const ref of manifest.documents) {
        await measureDocument(async () => {
          const bytes = await measureAnalysisStage('storage.document.read', () => store.get(ref.key));
          const file = new File([Buffer.from(bytes)], ref.name, { type: ref.type });
          const pdf = await measureAnalysisStage('pdf.analyze', () => deps.analyzePdf(file, profile.documentRules));
          const ai = await measureAnalysisStage('ai.analyze', () => deps.analyzeDocuments([file], profile, manifest.assignment));
          results[ref.name] = { pdf, ai };
        });
      }
      await measureAnalysisStage('storage.result.write', () => putJson(store, resultKey(jobId), results));
      return { status: 200 };
    }, jobId);
    return { resultKey: resultKey(jobId) };
  };
}
