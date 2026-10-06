// Runs in an isolated Node worker because pdfexcavator bundles PDF.js 4.
export const tableExtractionWorker = `
(async () => {
  const { parentPort, workerData } = await import('node:worker_threads');
  const { PDFExcavator, extractChars, extractTables, extractText } = await import(workerData.excavatorModuleUrl);
  const { OPS, Util } = await import(workerData.pdfjsModuleUrl);

  const document = await PDFExcavator.fromUint8Array(workerData.data);
  try {
    const tablesByPage = [];
    for (const page of document.pages) {
      const viewport = page.pdfPage.getViewport({ scale: 1 });
      const text = await page.pdfPage.getTextContent();
      // In 0.1.2 extractChars multiplies an already scaled item.width again.
      const normalizedText = { ...text, items: text.items.map(item => {
        if (!('str' in item)) return item;
        const scale = Math.abs(item.transform[0]);
        return { ...item, width: scale > 0 ? item.width / scale : item.width };
      }) };
      const chars = extractChars(normalizedText, page.pageNumber, page.height);
      const ops = await page.getOperatorList();
      const lines = [];
      let matrix = [1, 0, 0, 1, 0, 0];
      const stack = [];
      let paths = [];
      let current = [];
      const point = (x, y) => Util.applyTransform(
        Util.applyTransform([x, y], matrix), viewport.transform
      );
      const addLine = (a, b) => {
        const [x0, y0] = a;
        const [x1, y1] = b;
        if (Math.abs(x1 - x0) > 0.1 && Math.abs(y1 - y0) > 0.1) return;
        lines.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1),
          y0: Math.min(y0, y1), y1: Math.max(y0, y1),
          top: Math.min(y0, y1), bottom: Math.max(y0, y1),
          doctop: Math.min(y0, y1), lineWidth: 1, strokingColor: null,
          stroke: true, pageNumber: page.pageNumber });
      };
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];
        if (fn === OPS.save) stack.push([...matrix]);
        else if (fn === OPS.restore) matrix = stack.pop() || matrix;
        else if (fn === OPS.transform) matrix = Util.transform(matrix, args);
        else if (fn === OPS.constructPath) {
          const [commands, coordinates] = args;
          let offset = 0;
          for (const command of commands) {
            if (command === OPS.moveTo) {
              current = [point(coordinates[offset++], coordinates[offset++])];
              paths.push(current);
            } else if (command === OPS.lineTo) {
              current.push(point(coordinates[offset++], coordinates[offset++]));
            } else if (command === OPS.rectangle) {
              const x = coordinates[offset++], y = coordinates[offset++];
              const w = coordinates[offset++], h = coordinates[offset++];
              current = [point(x,y), point(x+w,y), point(x+w,y+h), point(x,y+h), point(x,y)];
              paths.push(current);
            } else if (command === OPS.closePath && current.length) {
              current.push(current[0]);
            } else if ([OPS.curveTo, OPS.curveTo2, OPS.curveTo3].includes(command)) {
              offset += command === OPS.curveTo ? 6 : 4;
              // Curves are not table rules; retain their endpoint for later lines.
              current = [point(coordinates[offset-2], coordinates[offset-1])];
              paths.push(current);
            }
          }
        } else if ([OPS.stroke, OPS.closeStroke, OPS.fill, OPS.eoFill,
          OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke,
          OPS.closeEOFillStroke, OPS.endPath].includes(fn)) {
          const filledOnly = fn === OPS.fill || fn === OPS.eoFill;
          if (fn !== OPS.endPath) {
            for (const points of paths) {
              if (points.length < 2) continue;
              if (filledOnly) {
                // Word-style borders are filled narrow polygons, not strokes.
                const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
                const left = Math.min(...xs), right = Math.max(...xs);
                const top = Math.min(...ys), bottom = Math.max(...ys);
                const w = right-left, h = bottom-top;
                if (h <= 2 && w > 2) addLine([left,(top+bottom)/2], [right,(top+bottom)/2]);
                else if (w <= 2 && h > 2) addLine([(left+right)/2,top], [(left+right)/2,bottom]);
              } else {
                for (let j = 1; j < points.length; j++) addLine(points[j-1], points[j]);
                if ([OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(fn)) {
                  addLine(points[points.length-1], points[0]);
                }
              }
            }
          }
          paths = [];
          current = [];
        }
      }
      const tables = extractTables(chars, lines, [], page.pageNumber, {
        snapTolerance: 1, joinTolerance: 1, intersectionTolerance: 1,
      });
      // Overlap-based selection in 0.1.2 can copy text into adjacent rows.
      // Assign characters by their centers to keep each cell's content separate.
      for (const table of tables) {
        table.rows = table.cells.map(row => row.map(cell => {
          if (!cell) return null;
          const content = chars.filter(char => {
            const x = (char.x0 + char.x1) / 2;
            const y = (char.y0 + char.y1) / 2;
            return x >= cell.x0 && x < cell.x1 && y >= cell.y0 && y < cell.y1;
          });
          cell.text = extractText(content).replace(/[ \\t]+/g, ' ').trim();
          return cell.text || null;
        }));
      }
      tablesByPage.push(tables);
    }
    parentPort.postMessage(tablesByPage);
  } finally {
    await document.close();
  }
})().catch(error => { throw error; });
`;
