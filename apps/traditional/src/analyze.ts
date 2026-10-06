import type { Middleware } from 'koa';
import { readFormData, InvalidFormData } from '@academic-analyzer/backend-common/form-data';
import { analyzeDocuments } from './ai.js';
import { analyzePdf } from './pdf/analyzePdf.js';
import { DOCUMENTS } from './documents.js';
import { analyzeSchema } from './validation.js';
import { rateLimit } from './rate-limit.js';
import type { CheckResult } from './types.js';
import { logAnalysisError, measureAnalysisRequest, measureAnalysisStage } from './instrumentation/analysis.js';

// Dependencies are injectable so route tests never call external services.
export function createAnalyzeHandler(deps = { rateLimit, analyzePdf, analyzeDocuments }): Middleware {
  return async (ctx) => {
    const response = await measureAnalysisRequest(async (measureDocument) => {
      try {
        if (!(await measureAnalysisStage('request.rate_limit', () =>
          deps.rateLimit(`analyze:${ctx.ip ?? 'unknown'}`, 10, 60)))) {
          return { status: 429, body: { error: 'Too many requests' } };
        }
        const formData = await measureAnalysisStage('request.form_data', () => readFormData(ctx));
        const parsed = analyzeSchema.safeParse({
          rules: formData.get('rules'),
          assignment: formData.get('assignment') ?? '',
          documents: formData.getAll('documents'),
        });
        if (!parsed.success || !parsed.data.documents.length ||
            new Set(parsed.data.documents.map(doc => doc.name)).size !== parsed.data.documents.length) {
          return { status: 400, body: { error: 'Bad request' } };
        }
        const { rules, assignment, documents } = parsed.data;
        const selectedDocument = DOCUMENTS.find(document => document.profile_id === rules);
        if (!selectedDocument) return { status: 403, body: { error: 'Invalid input' } };
        const results: Record<string, CheckResult> = Object.create(null);
        for (const doc of documents) {
          await measureDocument(async () => {
            const pdf = await measureAnalysisStage('pdf.analyze', () => deps.analyzePdf(doc, selectedDocument.documentRules));
            const ai = await measureAnalysisStage('ai.analyze', () => deps.analyzeDocuments([doc], selectedDocument, assignment));
            results[doc.name] = { pdf, ai };
          });
        }
        return { status: 200, body: results };
      } catch (error) {
        if (error instanceof InvalidFormData) return { status: 400, body: { error: 'Bad request' } };
        logAnalysisError('analysis.request.error', error);
        return { status: 500, body: { error: 'Internal Error' } };
      }
    });
    ctx.status = response.status;
    ctx.body = response.body;
  };
}

export const analyze = createAnalyzeHandler();
