import OpenAI from "openai";
import { createAnalyzeDocuments } from "@academic-analyzer/analysis-core/ai";
let client: OpenAI | undefined;
export const analyzeDocuments = createAnalyzeDocuments(() => client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
