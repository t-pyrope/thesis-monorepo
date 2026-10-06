import type { DocumentRules, PageData, PdfCheckResult } from "../types.js";

export const checkFont = (
  pages: PageData[],
  fontFamily: DocumentRules["fontFamily"],
): PdfCheckResult => {
  const fonts: { [key: string]: number } = {};

  for (const page of pages) {
    const fontNames = [...new Set(page.textItems.map((item) => item.fontName))];

    for (const fontName of fontNames) {
      const font = page.commonObjs.get(fontName);

      if (font?.name) {
        const fontName = font.name.includes("TimesNewRoman")
          ? "Times New Roman"
          : font.name.replace(/^[A-Z]{6}\+/, "");
        fonts[fontName] = fontName in fonts ? fonts[fontName] + 1 : 1;
      }
    }
  }

  const mainFont = Object.entries(fonts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const valid =
    mainFont === undefined
      ? undefined
      : mainFont === fontFamily
      ? true
      : mainFont.includes("CIDFont")
        ? undefined
        : false;

  return {
    valid,
    message: valid
      ? "OK"
      : valid === false
        ? `nevalidní (${mainFont})`
        : "nebylo možné zjistit písmo",
    details: fonts,
  };
};
