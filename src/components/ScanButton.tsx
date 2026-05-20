import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { ocrImage } from "@/lib/ocr";
import { setScanOcrText } from "@/lib/scan-cache";

const PUBLIC_URL = "archivai-docs-hub.lovable.app";

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const small = window.innerWidth <= 820;
  return touch && (small || /Android|iPhone|iPad|iPod|Mobile/i.test(ua));
}

/**
 * Load a camera image into an upright bitmap. Uses createImageBitmap with
 * `imageOrientation: "from-image"` so the browser applies EXIF orientation
 * for us (works on iOS Safari 13.4+, Chrome 79+, modern Android). Falls back
 * to a plain HTMLImageElement load if unsupported.
 */
async function loadUprightBitmap(
  file: File,
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, dw: number, dh: number) => void; dispose: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, dw, dh) => ctx.drawImage(bitmap, 0, 0, dw, dh),
        dispose: () => bitmap.close?.(),
      };
    } catch (e) {
      console.warn("createImageBitmap with EXIF failed, falling back", e);
    }
  }
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    draw: (ctx, dw, dh) => ctx.drawImage(img, 0, 0, dw, dh),
    dispose: () => URL.revokeObjectURL(url),
  };
}

/**
 * Decode camera image with correct EXIF orientation, downscale, convert to
 * grayscale, and return a JPEG blob under `maxBytes`.
 */
async function processImage(file: File, maxBytes = 2 * 1024 * 1024): Promise<Blob> {
  const bm = await loadUprightBitmap(file);

  const MAX_EDGE = 2000;
  const scale = Math.min(1, MAX_EDGE / Math.max(bm.width, bm.height));
  const w = Math.max(1, Math.round(bm.width * scale));
  const h = Math.max(1, Math.round(bm.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bm.dispose();
    throw new Error("Canvas not supported");
  }
  bm.draw(ctx, w, h);
  bm.dispose();

  // Grayscale
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);

  let quality = 0.85;
  let blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), "image/jpeg", quality),
  );
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
  }
  return blob;
}

async function imageToPdfFile(imageBlob: Blob, baseName: string): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(imageBlob);
  });

  // Determine dimensions
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  // Fit image into A4 portrait (210 x 297 mm)
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const ratio = img.naturalWidth / img.naturalHeight;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  const x = (pageW - w) / 2;
  const y = (pageH - h) / 2;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.addImage(dataUrl, "JPEG", x, y, w, h, undefined, "FAST");
  const pdfBlob = doc.output("blob");
  const safeName = baseName.replace(/\.[^.]+$/, "") || "szken";
  const filename = `${safeName}-${Date.now()}.pdf`;
  return new File([pdfBlob], filename, { type: "application/pdf" });
}

export function ScanButton({
  onFilesReady,
  disabled,
  iconOnly = false,
  className,
  variant = "outline",
}: {
  onFilesReady: (files: File[]) => void;
  disabled?: boolean;
  iconOnly?: boolean;
  className?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleClick = () => {
    if (!isMobileDevice()) {
      setDesktopOpen(true);
      return;
    }
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProcessing(true);
    try {
      const processed = await processImage(file);
      const pdf = await imageToPdfFile(processed, file.name || "szken");
      onFilesReady([pdf]);
    } catch (err) {
      console.error("scan failed", err);
      toast.error("Szkennelési hiba", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled || processing}
        variant={variant}
        className={className}
        size={iconOnly ? "icon" : "default"}
        aria-label="Szkennelés"
      >
        {processing ? (
          <Loader2 className={`h-4 w-4 ${iconOnly ? "" : "mr-2"} animate-spin`} />
        ) : (
          <Camera className={`h-4 w-4 ${iconOnly ? "" : "mr-2"}`} />
        )}
        {!iconOnly && "Szkennelés"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <Dialog open={desktopOpen} onOpenChange={setDesktopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📱 Mobil funkció</DialogTitle>
            <DialogDescription>
              Ez a funkció mobilon érhető el. Nyissa meg az alkalmazást telefonján:
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-center font-mono text-sm break-all">
            {PUBLIC_URL}
          </div>
          <DialogFooter>
            <Button onClick={() => setDesktopOpen(false)}>Rendben</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
