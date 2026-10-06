import OpenAI from "openai";
import { createAnalyzeDocuments } from "@academic-analyzer/analysis-core/ai";
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
export const analyzeDocuments = createAnalyzeDocuments(() => openai);
