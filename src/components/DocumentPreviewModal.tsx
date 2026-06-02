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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase, type DocumentRow } from "@/lib/supabase";
import { formatDeadline, isExpired } from "@/lib/categories";
import { useCategoryHelpers } from "@/hooks/use-categories";
import { getSignedUrl } from "@/lib/signed-url";
import { logAudit } from "@/lib/audit";
import { FilePreview } from "./FilePreview";
import { toast } from "sonner";

export function DocumentPreviewModal({
  doc: propDoc,
  open,
  onOpenChange,
  onUpdated,
  canEdit = true,
  onPrev,
  onNext,
}: {
  doc: DocumentRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: (doc: DocumentRow) => void;
  canEdit?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { getCategory, getRetentionDeadline } = useCategoryHelpers();
  const [url, setUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [versions, setVersions] = useState<DocumentRow[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  // The doc currently shown: either the explicitly selected version, or the prop doc
  const activeDoc = activeVersionId
    ? versions.find((v) => v.id === activeVersionId) ?? propDoc
    : propDoc;

  useEffect(() => {
    let cancelled = false;
    if (!propDoc || !open) {
      setUrl(null);
      setVersions([]);
      setActiveVersionId(null);
      return;
    }
    setActiveVersionId(null);
    setVersions([]);

    // Load all versions in this chain (root + children)
    const rootId = propDoc.parent_document_id ?? propDoc.id;
    void supabase
      .from("documents")
      .select("*")
      .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`)
      .order("version_number", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        if (data && data.length > 0) {
          setVersions(data as DocumentRow[]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [propDoc, open]);

  useEffect(() => {
    let cancelled = false;
    if (!activeDoc || !open) return;
    setNameValue(activeDoc.filename);
    setEditingName(false);
    setNotesValue(activeDoc.notes ?? "");
    setEditingNotes(false);

    void logAudit("view", activeDoc.id);
    getSignedUrl(activeDoc.storage_path, 600).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [activeDoc, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" && onPrev) { e.preventDefault(); onPrev(); }
      else if (e.key === "ArrowRight" && onNext) { e.preventDefault(); onNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onPrev, onNext]);

  if (!activeDoc) return null;
  const doc = activeDoc;
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
      <DialogContent className="max-w-5xl w-screen h-screen max-h-screen rounded-none p-4 sm:p-6 sm:w-full sm:h-auto sm:max-h-[92vh] sm:rounded-lg overflow-hidden flex flex-col [&>button.absolute]:h-10 [&>button.absolute]:w-10 [&>button.absolute]:flex [&>button.absolute]:items-center [&>button.absolute]:justify-center [&>button.absolute]:bg-background/90 [&>button.absolute]:border [&>button.absolute]:rounded-full [&>button.absolute]:shadow [&>button.absolute>svg]:h-5 [&>button.absolute>svg]:w-5">
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Előző dokumentum"
            className="flex items-center justify-center fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 h-11 w-11 sm:h-10 sm:w-10 rounded-full bg-background/90 border shadow hover:bg-accent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Következő dokumentum"
            className="flex items-center justify-center fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 h-11 w-11 sm:h-10 sm:w-10 rounded-full bg-background/90 border shadow hover:bg-accent"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
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

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4 overflow-y-auto md:overflow-hidden">
          <div className="bg-muted rounded-lg overflow-hidden min-h-[300px] md:min-h-[400px]">
            <FilePreview
              path={doc.storage_path}
              mimeType={doc.mime_type}
              filename={doc.filename}
              variant="full"
              className="w-full h-full min-h-[50vh] md:min-h-[60vh]"
            />
          </div>

          <div className="space-y-3 md:overflow-y-auto text-sm md:pr-2">
            <Field label="Eredeti fájlnév" value={doc.original_filename} />
            <Field label="Feltöltve" value={new Date(doc.created_at).toLocaleString("hu-HU")} />
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/60 p-3 shadow-sm">
              <div className="text-[11px] uppercase tracking-wider text-amber-800 dark:text-amber-300 font-bold flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Megjegyzés
                </span>
                {!editingNotes && doc.notes && doc.notes.trim() && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                    aria-label="Megjegyzés szerkesztése"
                    title="Megjegyzés szerkesztése"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <Input
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="pl. 2026.Q1"
                    autoFocus
                    className="bg-white dark:bg-background border-amber-300 dark:border-amber-700"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveNotes();
                      if (e.key === "Escape") { setEditingNotes(false); setNotesValue(doc.notes ?? ""); }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="bg-green-600 hover:bg-green-700 text-white">
                      <Check className="h-4 w-4 mr-1" /> Mentés
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setEditingNotes(false); setNotesValue(doc.notes ?? ""); }} disabled={savingNotes}>
                      <X className="h-4 w-4 mr-1" /> Mégse
                    </Button>
                  </div>
                </div>
              ) : doc.notes && doc.notes.trim() ? (
                <span className="inline-block bg-amber-200 dark:bg-amber-800/70 text-amber-950 dark:text-amber-50 px-2.5 py-1 rounded-md text-sm font-medium break-words max-w-full">
                  {doc.notes}
                </span>
              ) : (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="w-full text-left text-sm text-amber-700/80 dark:text-amber-300/80 italic hover:text-amber-900 dark:hover:text-amber-100 flex items-center gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0" />
                  Kattintson a megjegyzés hozzáadásához...
                </button>
              )}
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
