import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Next must be able to trace dependencies hoisted to the workspace root.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/analyze": [
      // Only dynamic runtime assets need explicit inclusion; core code is bundled.
      // PDF.js loads its worker and native canvas dynamically.
      "../../node_modules/pdfjs-dist/package.json",
      "../../node_modules/pdfjs-dist/legacy/build/*.mjs",
      "../../node_modules/pdfjs-dist/standard_fonts/**/*",
      "../../node_modules/@napi-rs/canvas*/{*.js,*.node,package.json}",
      // Imports inside the eval-based table worker are invisible to tracing.
      // Keep PDFExcavator's separate PDF.js version and canvas together.
      "../../node_modules/pdfexcavator/package.json",
      "../../node_modules/pdfexcavator/dist/**/*.js",
      "../../node_modules/pdfexcavator/node_modules/pdfjs-dist/package.json",
      "../../node_modules/pdfexcavator/node_modules/pdfjs-dist/legacy/build/*.mjs",
      "../../node_modules/pdfexcavator/node_modules/pdfjs-dist/standard_fonts/**/*",
      "../../node_modules/pdfexcavator/node_modules/pdfjs-dist/cmaps/**/*",
      "../../node_modules/pdfexcavator/node_modules/@napi-rs/canvas*/{*.js,*.node,package.json}",
    ],
  },
};

export default nextConfig;
