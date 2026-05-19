// Client-side DOCX / XLSX preview helpers.
// Lazy-imported so they don't bloat the initial bundle.

export type OfficeKind = "docx" | "xlsx" | "image" | "pdf" | "text" | "other";

export function detectKind(mimeType: string | null, name: string): OfficeKind {
  const n = name.toLowerCase();
  const m = (mimeType ?? "").toLowerCase();
  if (m.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/")) return "image";
  if (n.endsWith(".docx") || m.includes("officedocument.wordprocessingml")) return "docx";
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || m.includes("spreadsheetml") || m.includes("ms-excel")) return "xlsx";
  if (m.startsWith("text/") || n.endsWith(".txt") || n.endsWith(".md") || n.endsWith(".csv")) return "text";
  return "other";
}

export async function renderDocxHtml(blob: Blob): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await blob.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value || "<p class='text-muted-foreground'>Üres dokumentum</p>";
}

export async function renderXlsxHtml(blob: Blob, maxRows = 100): Promise<string> {
  const XLSX = await import("xlsx");
  const buf = await blob.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return "<p class='text-muted-foreground'>Üres munkafüzet</p>";
  const sheet = wb.Sheets[firstSheetName];
  const html = XLSX.utils.sheet_to_html(sheet, { header: "", footer: "" });
  // Truncate long tables
  const truncated = html.split("</tr>").slice(0, maxRows + 1).join("</tr>") + "</tr></table>";
  return `<div class="xlsx-preview"><div class="text-xs text-muted-foreground mb-2">Munkalap: ${firstSheetName}</div>${truncated}</div>`;
}
