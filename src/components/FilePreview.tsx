import { useEffect, useState } from "react";
import { Loader2, FileText } from "lucide-react";
import { getSignedUrl } from "@/lib/signed-url";
import { renderPdfFirstPage } from "@/lib/pdf";
import { detectKind, renderDocxHtml, renderXlsxHtml } from "@/lib/office-preview";

type RenderState =
  | { kind: "loading" }
  | { kind: "image"; url: string }
  | { kind: "pdf"; dataUrl: string }
  | { kind: "html"; html: string }
  | { kind: "iframe"; url: string }
  | { kind: "none" };

const cache = new Map<string, RenderState>();

export function FilePreview({
  path,
  mimeType,
  filename,
  variant = "thumb",
  className,
}: {
  path: string;
  mimeType: string | null;
  filename: string;
  variant?: "thumb" | "large" | "full";
  className?: string;
}) {
  const cacheKey = `${variant}:${path}`;
  const [state, setState] = useState<RenderState>(cache.get(cacheKey) ?? { kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (cache.has(cacheKey)) {
      setState(cache.get(cacheKey)!);
      return;
    }
    (async () => {
      setState({ kind: "loading" });
      const url = await getSignedUrl(path, 600);
      if (!url || cancelled) return;
      const kind = detectKind(mimeType, filename);
      const maxWidth = variant === "thumb" ? 400 : variant === "large" ? 800 : 1200;

      try {
        if (kind === "image") {
          const next: RenderState = { kind: "image", url };
          cache.set(cacheKey, next);
          if (!cancelled) setState(next);
          return;
        }
        if (kind === "pdf") {
          if (variant === "full") {
            const next: RenderState = { kind: "iframe", url };
            cache.set(cacheKey, next);
            if (!cancelled) setState(next);
            return;
          }
          const res = await fetch(url);
          const blob = await res.blob();
          const dataUrl = await renderPdfFirstPage(blob, maxWidth);
          if (dataUrl) {
            const next: RenderState = { kind: "pdf", dataUrl };
            cache.set(cacheKey, next);
            if (!cancelled) setState(next);
            return;
          }
        }
        if (kind === "docx") {
          const res = await fetch(url);
          const blob = await res.blob();
          const html = await renderDocxHtml(blob);
          const next: RenderState = { kind: "html", html };
          cache.set(cacheKey, next);
          if (!cancelled) setState(next);
          return;
        }
        if (kind === "xlsx") {
          const res = await fetch(url);
          const blob = await res.blob();
          const html = await renderXlsxHtml(blob);
          const next: RenderState = { kind: "html", html };
          cache.set(cacheKey, next);
          if (!cancelled) setState(next);
          return;
        }
        if (kind === "text") {
          const res = await fetch(url);
          const text = await res.text();
          const escaped = text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
          const next: RenderState = { kind: "html", html: `<pre class="whitespace-pre-wrap text-xs">${escaped.slice(0, 5000)}</pre>` };
          cache.set(cacheKey, next);
          if (!cancelled) setState(next);
          return;
        }
        const next: RenderState = { kind: "none" };
        cache.set(cacheKey, next);
        if (!cancelled) setState(next);
      } catch (e) {
        console.warn("preview failed", e);
        if (!cancelled) setState({ kind: "none" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, path, mimeType, filename, variant]);

  if (state.kind === "loading") {
    return (
      <div className={`flex items-center justify-center bg-muted ${className ?? ""}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state.kind === "none") {
    return (
      <div className={`flex flex-col items-center justify-center bg-muted text-muted-foreground gap-1 ${className ?? ""}`}>
        <FileText className="h-10 w-10" />
        <span className="text-xs px-2 truncate max-w-full">{filename}</span>
      </div>
    );
  }
  if (state.kind === "image") {
    return <img src={state.url} alt={filename} className={`object-contain bg-muted ${className ?? ""}`} loading="lazy" />;
  }
  if (state.kind === "pdf") {
    return <img src={state.dataUrl} alt={filename} className={`object-contain bg-white ${className ?? ""}`} loading="lazy" />;
  }
  if (state.kind === "iframe") {
    const fitUrl = `${state.url}#zoom=page-fit`;
    return <iframe src={fitUrl} title={filename} className={`bg-white w-full h-full ${className ?? ""}`} />;
  }
  // html
  return (
    <div
      className={`bg-white overflow-auto p-4 text-sm prose prose-sm max-w-none [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: state.html }}
    />
  );
}
