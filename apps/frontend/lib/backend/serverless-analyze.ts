import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";
import { analyzeSchema } from "@/lib/validation";
import { analyzeDocuments } from "@/lib/ai";
import { analyzePdf } from "@/lib/pdf/analyzePdf";
import { CheckResult } from "@/types";
import { DOCUMENTS } from "@/app/components/constants";

import {
  logAnalysisError,
  measureAnalysisRequest,
  measureAnalysisStage,
} from "@/lib/instrumentation/analysis";

export async function POST(req: NextRequest) {
  return measureAnalysisRequest(async (measureDocument) => {
    try {
      if (!isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
      }

      const ip = req.headers.get("x-forwarded-for") ?? "unknown";

      if (
        !(await measureAnalysisStage("request.rate_limit", () =>
          rateLimit(`analyze:${ip}`, 10, 60),
        ))
      ) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429 },
        );
      }

      const formData = await measureAnalysisStage("request.form_data", () =>
        req.formData(),
      );
      const input = {
        rules: formData.get("rules"),
        assignment: formData.get("assignment"),
        documents: formData.getAll("documents"),
      };

      const parsed = analyzeSchema.safeParse(input);

      if (!parsed.success) {
        return NextResponse.json({ error: "Bad request" }, { status: 400 });
      }

      const {
        data: { rules, documents, assignment },
      } = parsed;
      const results: { [key: string]: CheckResult } = {};

      const selectedDocument = DOCUMENTS.find(
        (document) => document.profile_id === rules,
      );

      if (!selectedDocument) {
        return NextResponse.json({ error: "Invalid input" }, { status: 403 });
      }
      for (const doc of documents) {
        await measureDocument(async () => {
          const analysisResult = await measureAnalysisStage("pdf.analyze", () =>
            analyzePdf(doc, selectedDocument.documentRules),
          );
          const aiResults = await measureAnalysisStage("ai.analyze", () =>
            analyzeDocuments([doc], selectedDocument, assignment),
          );

          results[doc.name] = {
            pdf: analysisResult,
            // ai: null,
            ai: aiResults,
          };
        });
      }

      return NextResponse.json(results);
    } catch (error) {
      logAnalysisError("analysis.request.error", error);
      return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
  });
}
