import path from "node:path";
import { resolveModule } from "../runtime/resolveModule.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { CheckResult, DocumentRules, PageData } from "../types.js";
import { checkChapterStartsNewPage } from "./checkChapterStartsNewPage.js";
import { checkMarginLeft } from "./checkMarginLeft.js";
import { checkFont } from "./checkFont.js";
import { checkLineSpacing } from "./checkLineSpacing.js";
import { checkFileSize } from "./checkFileSize.js";
import { checkFontSize } from "./checkFontSize.js";
import { checkPageSize } from "./checkPageSize.js";

import { extractTables } from "./extractTables.js";

const getMainFontSize = (pages: PageData[]): number | undefined => {
  const fontSizes = pages
    .flatMap((page) => page.textItems)
    .map((item) => item.fontSize)
    .filter((size) => size > 5 && size < 30);

  if (fontSizes.length === 0) {
    return undefined;
  }

  const groups = new Map<number, number>();

  for (const size of fontSizes) {
    const normalized = Math.round(size * 100) / 100;

    groups.set(normalized, (groups.get(normalized) ?? 0) + 1);
  }

  return [...groups.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

export const analyzePdf = async (
  file: File,
  documentRules: DocumentRules,
): Promise<CheckResult["pdf"]> => {
  const buffer = await file.arrayBuffer();

  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: path.join(
      path.dirname(resolveModule("pdfjs-dist/package.json")),
      "standard_fonts/",
    ),
  }).promise;

  const pages: PageData[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    await page.getOperatorList();

    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const textItems = textContent.items
      .filter((item) => "str" in item && item.str.trim().length > 0)
      .map((item) => {
        if (!("str" in item)) return null;

        const [, , , , x, y] = item.transform;

        return {
          text: item.str,
          x,
          y,
          width: item.width,
          height: item.height,
          fontName: item.fontName,
          fontSize: Math.abs(item.transform[0]),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    pages.push({
      page: i,
      commonObjs: page.commonObjs,
      width: viewport.width,
      height: viewport.height,
      textItems,
    });
  }

  const mainFontSize = getMainFontSize(pages);

  // TODO
  await extractTables(new Uint8Array(await file.arrayBuffer()));

  const result: CheckResult["pdf"] = {
    pageSize: checkPageSize(pages, documentRules.pageSize),
    marginLeftMm: checkMarginLeft(
      pages,
      documentRules.marginLeftMm,
      documentRules.fontSize,
    ),
    fontFamily: checkFont(pages, documentRules.fontFamily),
    fontSize: checkFontSize(mainFontSize, documentRules.fontSize),
    lineSpacing: checkLineSpacing(
      pages,
      documentRules.lineSpacing,
      mainFontSize,
    ),
    maxFileSizeInMb: checkFileSize(file, documentRules.maxFileSizeInMb),
  };

  if (documentRules.chapterStartsNewPage) {
    result.chapterStartsNewPage = checkChapterStartsNewPage(pages);
  }

  return result;
};
