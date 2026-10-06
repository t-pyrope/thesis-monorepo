import type { DocumentRules, PageData, PdfCheckResult } from "../types.js";
import { TOLERANCE } from "./constants.js";

export const checkLineSpacing = (
  pages: PageData[],
  lineSpacing: DocumentRules["lineSpacing"],
  mainFontSize: number | undefined,
): PdfCheckResult => {
  if (mainFontSize === undefined) {
    return {
      valid: false,
      message: "Nebylo možné zjistit velikost písma",
      details: [],
    };
  }

  const expectedLineSpacing = mainFontSize * lineSpacing * 1.1;

  const spacings: number[] = [];

  for (const page of pages) {
    const items = page.textItems
      .filter(
        (item) =>
          Math.abs(item.fontSize - mainFontSize) <= TOLERANCE &&
          item.text.trim().length > 0,
      )
      .sort((a, b) => b.y - a.y);

    for (let i = 1; i < items.length; i++) {
      const distance = items[i - 1].y - items[i].y;

      if (distance > 10 && distance < 30) {
        spacings.push(distance);
      }
    }
  }

  if (spacings.length === 0) {
    return {
      valid: false,
      message: "Nebylo možné zjistit řádkování",
      details: [],
    };
  }

  const distribution = new Map<number, number>();

  for (const spacing of spacings) {
    const normalized = Math.round(spacing * 10) / 10;

    distribution.set(normalized, (distribution.get(normalized) ?? 0) + 1);
  }

  const [detected, count] =
    [...distribution.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  if (detected === undefined) {
    return {
      valid: false,
      message: "Nebylo možné zjistit řádkování",
      details: [],
    };
  }

  const valid = Math.abs(detected - expectedLineSpacing) <= 1;
  const detectedLineSpacing = detected / (mainFontSize * 1.1);

  return {
    valid,

    message: valid ? `OK` : `nevalidní (${detectedLineSpacing.toFixed(2)})`,

    details: valid
      ? null
      : {
          fontSize: mainFontSize,
          expectedLineSpacing,
          detected,
          count,
        },
  };
};
