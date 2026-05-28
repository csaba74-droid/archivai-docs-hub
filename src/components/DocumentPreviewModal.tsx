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
import { Input } from "@/components/ui/input";
import {
  Download,
  Lock,
  ShieldCheck,
  CalendarClock,
  Hash,
  Pencil,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { supabase, type DocumentRow } from "@/lib/supabase";
import { formatDeadline, isExpired } from "@/lib/categories";
import { useCategoryHelpers } from "@/hooks/use-categories";
import { getSignedUrl } from "@/lib/signed-url";
import { logAudit } from "@/lib/audit";
import { FilePreview } from "./FilePreview";
import { toast } from "sonner";

export function DocumentPreviewModal({
  doc,
  open,
  onOpenChange,
  onUpdated,
  canEdit = true,
}: {
  doc: DocumentRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: (doc: DocumentRow) => void;
  canEdit?: boolean;
}) {
  const { getCategory, getRetentionDeadline } = useCategoryHelpers();
  const [url, setUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);


  useEffect(() => {
    let cancelled = false;
    if (!doc || !open) {
      setUrl(null);
      return;
    }
    setNameValue(doc.filename);
    setEditingName(false);
    setNotesValue(doc.notes ?? "");
    setEditingNotes(false);

    void logAudit("view", doc.id);
    getSignedUrl(doc.storage_path, 600).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, open]);

  if (!doc) return null;
  const cat = getCategory(doc.category);
  const strict = cat.mode === "strict";
  const baseDateForRetention = doc.document_date ?? doc.created_at;
  const deadline = getRetentionDeadline(doc.category, baseDateForRetention);
  const expired = isExpired(deadline);

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

  const saveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === doc.filename) {
      setEditingName(false);
      return;
    }
    // Preserve original extension
    const origExtMatch = doc.filename.match(/\.[^.]+$/);
    const origExt = origExtMatch ? origExtMatch[0] : "";
    const hasExt = origExt && trimmed.toLowerCase().endsWith(origExt.toLowerCase());
    const finalName = hasExt ? trimmed : trimmed.replace(/\.[^.]+$/, "") + origExt;

    setSaving(true);
    const { data, error } = await supabase
      .from("documents")
      .update({ filename: finalName })
      .eq("id", doc.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Átnevezés sikertelen", { description: error.message });
      return;
    }
    toast.success("Fájlnév módosítva ✓");
    setNameValue(finalName);
    setEditingName(false);
    if (data) onUpdated?.(data as DocumentRow);
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const { data, error } = await supabase
      .from("documents")
      .update({ notes: notesValue.trim() || null })
      .eq("id", doc.id)
      .select()
      .single();
    setSavingNotes(false);
    if (error) {
      toast.error("Megjegyzés mentése sikertelen", { description: error.message });
      return;
    }
    toast.success("Megjegyzés mentve ✓");
    setEditingNotes(false);
    if (data) onUpdated?.(data as DocumentRow);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate flex items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="h-9 flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") { setEditingName(false); setNameValue(doc.filename); }
                  }}
                />
                <Button
                  size="sm"
                  onClick={saveName}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-1" /> Mentés
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setEditingName(false); setNameValue(doc.filename); }}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-1" /> Mégse
                </Button>
              </div>
            ) : (
              <>
                <span className="truncate">{doc.filename} (v3)</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Átnevezés"
                  title="Átnevezés"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </>
            )}
          </DialogTitle>

          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{cat.label}</Badge>
            {strict ? (
              <Badge className="bg-brand text-brand-foreground gap-1">
                <ShieldCheck className="h-3 w-3" /> Törvényileg védett
              </Badge>
            ) : (
              <Badge variant="outline">Ajánlott tárolás</Badge>
            )}
            {expired && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Lejárt
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_300px] gap-4 overflow-hidden">
          <div className="bg-muted rounded-lg overflow-hidden min-h-[400px]">
            <FilePreview
              path={doc.storage_path}
              mimeType={doc.mime_type}
              filename={doc.filename}
              variant="full"
              className="w-full h-full min-h-[60vh]"
            />
          </div>

          <div className="space-y-3 overflow-y-auto text-sm pr-2">
            <Field label="Eredeti fájlnév" value={doc.original_filename} />
            <Field label="Feltöltve" value={new Date(doc.created_at).toLocaleString("hu-HU")} />

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Dokumentum dátuma
              </div>
              <div className="mt-0.5">
                <span>{doc.document_date ? new Date(doc.document_date).toLocaleDateString("hu-HU") : "—"}</span>
              </div>
            </div>


            <Field label="Kategória" value={cat.label} />
            <Field label="Méret" value={doc.size_bytes ? `${(doc.size_bytes / 1024).toFixed(1)} KB` : "—"} />
            <Field label="MIME" value={doc.mime_type ?? "—"} />

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Megőrzési határidő
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {strict && <Lock className="h-3.5 w-3.5 text-lock" />}
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{deadline ? formatDeadline(deadline) : cat.retentionLabel}</span>
              </div>
              {expired && (
                <p className="text-xs text-destructive mt-1">A megőrzési idő lejárt a dokumentum dátuma alapján.</p>
              )}
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
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="truncate">{value}</div>
    </div>
  );
}
