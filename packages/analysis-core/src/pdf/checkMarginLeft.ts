import type { DocumentRules, PageData, PdfCheckResult } from "../types.js";
import { TOLERANCE } from "./constants.js";

const groupValues = (values: number[], tolerance: number) => {
  const groups: number[][] = [];

  for (const value of [...values].sort((a, b) => a - b)) {
    const group = groups.find((g) => {
      const average = g.reduce((sum, value) => sum + value, 0) / g.length;

      return Math.abs(value - average) <= tolerance;
    });

    if (group) {
      group.push(value);
    } else {
      groups.push([value]);
    }
  }

  return groups
    .map((values) => ({
      values,
      count: values.length,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
    }))
    .sort((a, b) => b.count - a.count);
};

export const checkMarginLeft = (
  pages: PageData[],
  marginLeftMm: DocumentRules["marginLeftMm"],
  fontSize: DocumentRules["fontSize"],
): PdfCheckResult => {
  const leftValues: number[] = [];

  // const expectedMarginPt = marginLeftMm * (72 / 25.4);
  const tolerancePt = 2;

  for (const page of pages) {
    const textItems = page.textItems.filter(
      (item) =>
        Math.abs(item.fontSize - fontSize) <= TOLERANCE &&
        item.text.trim().length > 0,
    );

    if (!textItems.length) continue;

    const left = Math.min(...textItems.map((item) => item.x));

    leftValues.push(left);
  }

  if (leftValues.length === 0) {
    return {
      valid: false,
      message: "Nebylo možné zjistit velikost levého okraje stránky",
      details: [],
    };
  }

  const groups = groupValues(leftValues, tolerancePt);
  const mainLeft = groups[0];

  if (!mainLeft) {
    return {
      valid: false,
      message: "Nebylo možné zjistit velikost levého okraje stránky",
      details: [],
    };
  }

  const detectedMm = mainLeft.average * (25.4 / 72);
  const valid = Math.abs(detectedMm - marginLeftMm) <= 1;

  return {
    valid,
    message: valid
      ? `OK (${detectedMm.toFixed(1)} mm)`
      : `nevalidní (${detectedMm.toFixed(1)} mm)`,
    details: {
      detected: detectedMm,
      expected: marginLeftMm,
      count: mainLeft.count,
      distribution: groups.map((group) => ({
        average: group.average * (25.4 / 72),
        count: group.count,
      })),
    },
  };
};
