import { useEffect, useState } from "react";
import { Loader2, FileText } from "lucide-react";
import { getSignedUrl } from "@/lib/signed-url";
import { renderPdfFirstPage } from "@/lib/pdf";

const memoryCache = new Map<string, string>();

export function DocumentThumbnail({
  path,
  mimeType,
  maxWidth = 400,
  className,
  alt,
}: {
  path: string;
  mimeType: string | null;
  maxWidth?: number;
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState<string | null>(memoryCache.get(path) ?? null);
  const [loading, setLoading] = useState(!memoryCache.has(path));

  useEffect(() => {
    let cancelled = false;
    if (memoryCache.has(path)) {
      setSrc(memoryCache.get(path)!);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const url = await getSignedUrl(path);
      if (!url || cancelled) {
        setLoading(false);
        return;
      }
      const isImage = (mimeType ?? "").startsWith("image/");
      const isPdf = (mimeType ?? "").includes("pdf") || path.toLowerCase().endsWith(".pdf");
      if (isImage) {
        memoryCache.set(path, url);
        if (!cancelled) {
          setSrc(url);
          setLoading(false);
        }
        return;
      }
      if (isPdf) {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const dataUrl = await renderPdfFirstPage(blob, maxWidth);
          if (!cancelled) {
            if (dataUrl) {
              memoryCache.set(path, dataUrl);
              setSrc(dataUrl);
            }
            setLoading(false);
          }
        } catch {
          if (!cancelled) setLoading(false);
        }
        return;
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [path, mimeType, maxWidth]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className ?? ""}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className ?? ""}`}>
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt ?? ""}
      className={`object-cover bg-muted ${className ?? ""}`}
      loading="lazy"
    />
  );
}
