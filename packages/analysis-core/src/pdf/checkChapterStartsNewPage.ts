import type { PageData, PdfCheckResult } from "../types.js";

interface TextLine {
  text: string;
  y: number;
  height: number;
}

const LINE_Y_TOLERANCE = 3;
const CHAPTER_TOP_THRESHOLD = 120;

const getTextLines = (page: PageData): TextLine[] => {
  const items = page.textItems
    .filter((item) => item.text.trim())
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > LINE_Y_TOLERANCE) {
        return b.y - a.y;
      }

      return a.x - b.x;
    });

  const lines: TextLine[] = [];

  for (const item of items) {
    const lastLine = lines.at(-1);

    if (!lastLine || Math.abs(lastLine.y - item.y) > LINE_Y_TOLERANCE) {
      lines.push({
        text: item.text.trim(),
        y: item.y,
        height: item.height,
      });
      continue;
    }

    lastLine.text = `${lastLine.text} ${item.text.trim()}`
      .replace(/\s+/g, " ")
      .trim();

    lastLine.height = Math.max(lastLine.height, item.height);
  }

  return lines;
};

const isTocEntry = (text: string): boolean => {
  return /^(\d+(?:\.\d+)*\.?\s+.+?)\s*\.{3,}\s*\d+\s*$/.test(text);
};

const getTopLevelEntry = (text: string): string | null => {
  if (!/^\d+\.?\s+[^.]+\.{3,}\s*\d+\s*$/.test(text)) {
    return null;
  }

  return text.replace(/\s*\.{3,}\s*\d+\s*$/, "").trim();
};

export const checkChapterStartsNewPage = (
  pages: PageData[],
): PdfCheckResult => {
  const chapters: {
    chapter: string;
    page: number;
    topDistance: number;
  }[] = [];

  // Сначала находим начало основной части документа.
  //
  // Это необходимо, потому что в TOC находятся строки вроде:
  // "1. Úvod ........ 1"
  // "2. Cíl práce ........ 3"
  //
  // Их нельзя считать реальными заголовками.
  let bodyStarted = false;
  let tocEntryStarted = false;
  let tocEntryFinished: null | number = null;
  const tocEntries = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    const lines = getTextLines(page);

    for (const line of lines) {
      const text = line.text.trim();

      if (tocEntryFinished === null) {
        const tocEntry = isTocEntry(text);

        if (!tocEntry && tocEntryStarted) {
          tocEntryFinished = i;

          bodyStarted = true;
          break;
        }

        const topLevelEntry = getTopLevelEntry(text);

        if (topLevelEntry) {
          tocEntryStarted = true;
          tocEntries.push(topLevelEntry);
        }
      }
    }

    if (bodyStarted) {
      break;
    }
  }

  if (!bodyStarted) {
    return {
      valid: false,
      message: "nepodařilo se najít začátek hlavní části dokumentu.",
      details: {
        chapters: [],
      },
    };
  }

  for (let i = 0; i < pages.length; i++) {
    if (tocEntryFinished !== null && i <= tocEntryFinished) {
      continue;
    }

    const page = pages[i];

    const lines = getTextLines(page);

    for (const line of lines) {
      const text = line.text.trim();

      if (!tocEntries.includes(text)) {
        continue;
      }

      const topDistance = page.height - (line.y + line.height);

      chapters.push({
        chapter: text,
        page: page.page,
        topDistance,
      });
    }
  }

  const violations = chapters.filter(
    (chapter) => chapter.topDistance > CHAPTER_TOP_THRESHOLD,
  );

  return {
    valid: violations.length === 0,
    message:
      violations.length === 0
        ? "OK"
        : `${violations.length} hlavních kapitol nezačíná na nové stránce (${violations.map((violation) => violation.chapter).join(", ")}).`,
    details: {
      violations,
    },
  };
};
