import type { PDFObjects } from "pdfjs-dist/types/src/display/pdf_objects.js";

export type FormValues = {
  rules: string;
  documents: File[];
  assignment: string;
};

export interface PdfCheckResult {
  valid?: boolean;
  message: string;
  details?: unknown;
}

export type AnalysisResult = {
  violations: {
    ruleId: string;
    description: string;
    location: string;
    explanation: string;
  }[];

  impossibleToDetermine: {
    ruleId: string;
    reason: string;
  }[];

  summary: string;

  questions: string[];
};

export interface DocumentRules {
  pageSize: string;
  marginLeftMm: number;
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  maxFileSizeInMb: number;
  chapterStartsNewPage?: boolean;
}

export interface CheckResult {
  pdf: {
    [K in keyof DocumentRules]: PdfCheckResult;
  };
  ai?: AnalysisResult;
}

export interface DocumentRule {
  id: string;
  definition: string;
  severity: string;
  description: string;
}

export interface SelectedDocument {
  schema_version: string;
  year: number;
  profile_id: string;

  institution: {
    university: string;
    faculty: string;
    work_type: string;
    faculty_code: string;
  };

  documentRules: DocumentRules;

  rules: DocumentRule[];
}

export interface PageData {
  page: number;
  width: number;
  height: number;
  commonObjs: PDFObjects;
  textItems: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontName: string;
    fontSize: number;
  }[];
}
