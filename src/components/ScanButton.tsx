import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

const PUBLIC_URL = "archivai-docs-hub.lovable.app";

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const small = window.innerWidth <= 820;
  return touch && (small || /Android|iPhone|iPad|iPod|Mobile/i.test(ua));
}

/**
 * Read EXIF orientation from a JPEG ArrayBuffer.
 * Returns 1-8 or 1 (default) if not found.
 */
function readExifOrientation(buf: ArrayBuffer): number {
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;
    if (marker === 0xffe1) {
      // APP1 (EXIF)
      const size = view.getUint16(offset);
      const exifStart = offset + 2;
      if (view.getUint32(exifStart) !== 0x45786966) return 1; // "Exif"
      const tiffOffset = exifStart + 6;
      const little = view.getUint16(tiffOffset) === 0x4949;
      const get16 = (o: number) => view.getUint16(o, little);
      const get32 = (o: number) => view.getUint32(o, little);
      if (get16(tiffOffset + 2) !== 0x002a) return 1;
      const ifdOffset = tiffOffset + get32(tiffOffset + 4);
      const tagCount = get16(ifdOffset);
      for (let i = 0; i < tagCount; i++) {
        const entry = ifdOffset + 2 + i * 12;
        if (get16(entry) === 0x0112) {
          return get16(entry + 8);
        }
      }
      return 1;
    } else if ((marker & 0xff00) !== 0xff00) {
      break;
    } else {
      offset += view.getUint16(offset);
    }
  }
  return 1;
}

/**
 * Draw an HTMLImageElement onto a canvas applying EXIF orientation
 * and converting to grayscale. Returns a JPEG blob compressed under maxBytes.
 */
async function processImage(file: File, maxBytes = 2 * 1024 * 1024): Promise<Blob> {
  const buf = await file.arrayBuffer();
  const orientation = file.type === "image/jpeg" ? readExifOrientation(buf) : 1;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });

  // Downscale large captures (long edge max 2000px)
  const MAX_EDGE = 2000;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const swap = orientation >= 5 && orientation <= 8;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Apply orientation transform
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
  }
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);

  // Grayscale
  const cw = canvas.width;
  const ch = canvas.height;
  const imageData = ctx.getImageData(0, 0, cw, ch);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);

  // Iteratively compress to under maxBytes
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
