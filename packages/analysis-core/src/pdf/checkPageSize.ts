import type { DocumentRules, PageData, PdfCheckResult } from "../types.js";
import { TOLERANCE } from "./constants.js";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const isA4 = (width: number, height: number): boolean => {
  const portrait =
    Math.abs(width - A4_WIDTH) <= TOLERANCE &&
    Math.abs(height - A4_HEIGHT) <= TOLERANCE;

  const landscape =
    Math.abs(width - A4_HEIGHT) <= TOLERANCE &&
    Math.abs(height - A4_WIDTH) <= TOLERANCE;

  return portrait || landscape;
};

export const checkPageSize = (
  pages: PageData[],
  pageSize: DocumentRules["pageSize"],
): PdfCheckResult => {
  const invalidPages = pages.filter(({ width, height }) =>
    pageSize === "A4" ? !isA4(width, height) : true,
  );

  return {
    valid: invalidPages.length === 0,

    message:
      invalidPages.length === 0
        ? "OK"
        : `${invalidPages.map((p) => p.page).length} stránek nejsou A4`,

    details: invalidPages.map((p) => ({
      page: p.page,
      width: p.width,
      height: p.height,
    })),
  };
};
