import { resolveModule } from "../runtime/resolveModule.js";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import type { PDFTable } from "pdfexcavator";
import { tableExtractionWorker } from "./tableExtractionWorker.js";

const excavatorModuleUrl = pathToFileURL(resolveModule('pdfexcavator')).href;
const excavatorEntry = resolveModule('pdfexcavator');
const pdfjsModuleUrl = pathToFileURL(resolveModule('pdfjs-dist/legacy/build/pdf.mjs', excavatorEntry)).href;

export const extractTables = (data: Uint8Array): Promise<PDFTable[][]> =>
  new Promise((resolve, reject) => {
    // PDFExcavator uses PDF.js 4; isolate its global worker from PDF.js 6.
    const worker = new Worker(
      tableExtractionWorker,
      { eval: true, workerData: { data, excavatorModuleUrl, pdfjsModuleUrl } },
    );

    let tables: PDFTable[][] | undefined;
    worker.once("message", (result: PDFTable[][]) => {
      tables = result;
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code === 0 && tables !== undefined) {
        resolve(tables);
      } else {
        reject(new Error(`Table extraction worker exited with code ${code}`));
      }
    });
  });
