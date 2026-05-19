// PDF utilities using pdfjs-dist (browser-only).
import * as pdfjsLib from "pdfjs-dist";

import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let configured = false;
function ensureWorker() {
  if (configured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc as string;
  configured = true;
}

export async function renderPdfFirstPage(
  source: Blob | ArrayBuffer | string,
  maxWidth = 400,
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    ensureWorker();
    let data: ArrayBuffer | string;
    if (source instanceof Blob) {
      data = await source.arrayBuffer();
    } else {
      data = source;
    }
    const loadingTask =
      typeof data === "string"
        ? pdfjsLib.getDocument(data)
        : pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(maxWidth / viewport.width, 2);
    const scaled = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = scaled.width;
    canvas.height = scaled.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({
      canvasContext: ctx,
      viewport: scaled,
      canvas,
    } as Parameters<typeof page.render>[0]).promise;
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("pdf render failed", e);
    return null;
  }
}

function sanitizeText(s: string): string {
  // Postgres text/jsonb rejects NUL (\u0000). Strip it plus other C0 control
  // chars (except tab/newline/carriage return) and lone surrogate halves
  // that can also trigger "unsupported Unicode escape sequence" on insert.
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\\u0000/g, "");
}

export async function extractPdfText(file: File, maxPages = 5): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    ensureWorker();
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pages = Math.min(pdf.numPages, maxPages);
    let out = "";
    for (let i = 1; i <= pages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        out +=
          content.items
            .map((it) => ("str" in it ? (it as { str: string }).str : ""))
            .join(" ") + "\n";
      } catch (pageErr) {
        console.warn(`pdf page ${i} text extract failed, skipping`, pageErr);
      }
    }
    return sanitizeText(out).trim();
  } catch (e) {
    console.warn("pdf text extract failed, continuing without text", e);
    return "";
  }
}
