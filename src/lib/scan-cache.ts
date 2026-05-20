// Cache OCR text extracted from scanned images, keyed by the resulting PDF File.
// The ScanButton runs OCR on the raw camera image (before converting to PDF)
// and stores the text here, so the upload pipeline can reuse it instead of
// re-OCR-ing the rendered PDF page.

const cache = new WeakMap<File, string>();

export function setScanOcrText(file: File, text: string): void {
  if (text) cache.set(file, text);
}

export function getScanOcrText(file: File): string | undefined {
  return cache.get(file);
}
