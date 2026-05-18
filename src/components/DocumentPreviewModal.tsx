import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Lock,
  ShieldCheck,
  CalendarClock,
  Hash,
  FileText,
  Loader2,
} from "lucide-react";
import type { DocumentRow } from "@/lib/supabase";
import {
  getCategory,
  getRetentionDeadline,
  formatDeadline,
} from "@/lib/categories";
import { getSignedUrl } from "@/lib/signed-url";
import { logAudit } from "@/lib/audit";

export function DocumentPreviewModal({
  doc,
  open,
  onOpenChange,
}: {
  doc: DocumentRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!doc || !open) {
      setUrl(null);
      return;
    }
    setLoading(true);
    void logAudit("view", doc.id);
    getSignedUrl(doc.storage_path, 600).then((u) => {
      if (cancelled) return;
      setUrl(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, open]);

  if (!doc) return null;
  const cat = getCategory(doc.category);
  const strict = cat.mode === "strict";
  const deadline = getRetentionDeadline(doc.category, doc.created_at);
  const isPdf =
    (doc.mime_type ?? "").includes("pdf") ||
    doc.storage_path.toLowerCase().endsWith(".pdf");
  const isImage = (doc.mime_type ?? "").startsWith("image/");

  const handleDownload = async () => {
    if (!url) return;
    void logAudit("download", doc.id, { filename: doc.filename });
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.original_filename || doc.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{doc.filename}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{cat.label}</Badge>
            {strict ? (
              <Badge className="bg-brand text-brand-foreground gap-1">
                <ShieldCheck className="h-3 w-3" /> ITM zárolt
              </Badge>
            ) : (
              <Badge variant="outline">Ajánlott tárolás</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_280px] gap-4 overflow-hidden">
          <div className="bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : url && isPdf ? (
              <iframe
                src={url}
                title={doc.filename}
                className="w-full h-full min-h-[60vh] bg-white"
              />
            ) : url && isImage ? (
              <img
                src={url}
                alt={doc.filename}
                className="max-w-full max-h-[70vh] object-contain"
              />
            ) : (
              <div className="text-center text-muted-foreground p-8">
                <FileText className="h-10 w-10 mx-auto mb-2" />
                <p className="text-sm">Előnézet nem elérhető</p>
              </div>
            )}
          </div>

          <div className="space-y-3 overflow-y-auto text-sm">
            <Field label="Eredeti fájlnév" value={doc.original_filename} />
            <Field
              label="Feltöltve"
              value={new Date(doc.created_at).toLocaleString("hu-HU")}
            />
            <Field label="Kategória" value={cat.label} />
            <Field
              label="Méret"
              value={
                doc.size_bytes ? `${(doc.size_bytes / 1024).toFixed(1)} KB` : "—"
              }
            />
            <Field label="MIME" value={doc.mime_type ?? "—"} />
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Megőrzés
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {strict && <Lock className="h-3.5 w-3.5 text-brand" />}
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  {deadline ? formatDeadline(deadline) : cat.retentionLabel}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Hash className="h-3 w-3" /> SHA-256
              </div>
              <code className="block text-[10px] font-mono break-all text-muted-foreground mt-0.5">
                {doc.sha256 ?? "—"}
              </code>
            </div>
            <Button onClick={handleDownload} disabled={!url} className="w-full">
              <Download className="h-4 w-4 mr-2" /> Letöltés
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="truncate">{value}</div>
    </div>
  );
}
