// Browser-only OCR helpers using tesseract.js.
// Used to extract text from scanned/photographed documents (JPG/PNG)
// and from PDFs with no embedded text layer.

import { renderPdfFirstPage } from "@/lib/pdf";

function sanitize(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .trim();
}

/**
 * Run OCR on an image source (File/Blob/dataURL).
 * Languages: Hungarian + English (best fit for this app's documents).
 */
export async function ocrImage(source: File | Blob | string): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const { recognize } = await import("tesseract.js");
    const input = source instanceof Blob ? source : source;
    const { data } = await recognize(input as Blob | string, "hun+eng");
    return sanitize(data?.text ?? "");
  } catch (e) {
    console.warn("OCR failed", e);
    return "";
  }
}

/** OCR the first page of a PDF that has no embedded text layer. */
export async function ocrPdfFirstPage(file: File): Promise<string> {
  const dataUrl = await renderPdfFirstPage(file, 1600);
  if (!dataUrl) return "";
  return ocrImage(dataUrl);
}
