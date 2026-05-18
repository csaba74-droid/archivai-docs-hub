// PDF utilities using pdfjs-dist (browser-only).
import * as pdfjsLib from "pdfjs-dist";
// @ts-expect-error - vite ?url import
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

export async function extractPdfText(file: File, maxPages = 5): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    ensureWorker();
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pages = Math.min(pdf.numPages, maxPages);
    let out = "";
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      out +=
        content.items
          .map((it) => ("str" in it ? (it as { str: string }).str : ""))
          .join(" ") + "\n";
    }
    return out.trim();
  } catch (e) {
    console.warn("pdf text extract failed", e);
    return "";
  }
}
