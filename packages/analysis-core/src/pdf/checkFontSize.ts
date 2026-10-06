import type { DocumentRules, PdfCheckResult } from "../types.js";
import { TOLERANCE } from "./constants.js";

export const checkFontSize = (
  mainFontSize: number | undefined,
  fontSize: DocumentRules["fontSize"],
): PdfCheckResult => {
  if (mainFontSize === undefined) {
    return {
      valid: false,
      message: "Nebylo možné zjistit velikost písma",
      details: [],
    };
  }

  const valid = Math.abs(mainFontSize - fontSize) <= TOLERANCE;

  return {
    valid,
    message: valid ? "OK" : `nevalidní (${mainFontSize} pt)`,
    details: {
      expected: fontSize,
      detected: mainFontSize,
    },
  };
};
