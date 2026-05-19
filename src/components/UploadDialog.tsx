import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase, type DocumentRow, type CustomCategoryRow } from "@/lib/supabase";
import { useCategories, useCategoryHelpers } from "@/hooks/use-categories";
import { extractPdfText } from "@/lib/pdf";
import { categorizeDocument } from "@/lib/ai.functions";
import { matchFilenameCategory } from "@/lib/filename-rules";
import { logAudit } from "@/lib/audit";
import {
  CalendarClock,
  ChevronDown,
  FileText,
  FolderOpen,
  Loader2,
  Settings2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

type FileProgress = {
  file: File;
  status: "queued" | "extracting" | "ai" | "uploading" | "saving" | "done" | "error";
  progress: number;
  error?: string;
  suggestedCategory?: string;
  detectedDate?: string | null;
};

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const CONFIDENCE_THRESHOLD = 0.8;

const HARD_CATEGORY_ID_BY_LABEL: Record<string, string> = {
  "Számlák": "szamlak",
  "Szerződések": "szerzodesek",
  "Szállítólevelek": "szallitolevek",
  "Munkaügyi iratok": "munkaugyi",
};

const STATUS_LABEL: Record<FileProgress["status"], string> = {
  queued: "Várakozik",
  extracting: "Szöveg kinyerés",
  ai: "AI elemzés",
  uploading: "Feltöltés",
  saving: "Mentés",
  done: "Kész",
  error: "Hiba",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadDialog({
  open,
  onOpenChange,
  onComplete,
  initialFiles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: () => void;
  initialFiles?: File[] | null;
}) {
  const { customRows, all: allCats } = useCategories();
  const { isStrict } = useCategoryHelpers();
  const [files, setFiles] = useState<FileProgress[]>([]);
  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [running, setRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    fileName: string;
    suggested: string;
    confidence: number;
    reasoning?: string;
    detectedDate?: string | null;
    docDate: string;
    resolve: (v: { category: string | null; documentDate: string }) => void;
  } | null>(null);
  const [confirmCategory, setConfirmCategory] = useState("egyeb");
  const [confirmDate, setConfirmDate] = useState("");

  const reset = () => {
    setFiles([]);
    setDocumentDate(new Date().toISOString().slice(0, 10));
    setAdvancedOpen(false);
  };

  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      setFiles(initialFiles.map((file) => ({ file, status: "queued", progress: 0 })));
    }
  }, [open, initialFiles]);

  const addFiles = (selected: FileList | File[] | null) => {
    if (!selected) return;
    const arr = Array.from(selected);
    if (arr.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...arr.map((file) => ({ file, status: "queued" as const, progress: 0 })),
    ]);
  };

  const removeAt = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateAt = (i: number, patch: Partial<FileProgress>) => {
    setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };

  const askConfirm = (params: {
    fileName: string;
    suggested: string;
    confidence: number;
    reasoning?: string;
    detectedDate?: string | null;
    docDate: string;
  }) =>
    new Promise<{ category: string | null; documentDate: string }>((resolve) => {
      setConfirmCategory(params.suggested);
      setConfirmDate(params.detectedDate ?? params.docDate);
      setPendingConfirm({ ...params, resolve });
    });

  const resolveConfirm = (chosen: string | null) => {
    if (!pendingConfirm) return;
    pendingConfirm.resolve({ category: chosen, documentDate: confirmDate });
    setPendingConfirm(null);
  };

  const startUpload = async () => {
    if (files.length === 0) {
      toast.info("Nincs kiválasztott fájl");
      return;
    }
    const filenameMatches = files.map(({ file }) => {
      const label = matchFilenameCategory(file.name);
      const category = label ? HARD_CATEGORY_ID_BY_LABEL[label] : null;
      console.log("FILENAME CHECK:", file.name, "RESULT:", label ?? "(no match → AI)");
      if (label) toast.success(`📂 Kategória azonosítva: ${label}`);
      return { label, category };
    });
    const { data: ud } = await supabase.auth.getUser();
    const user = ud.user;
    if (!user) {
      toast.error("Nincs bejelentkezett felhasználó");
      return;
    }
    setRunning(true);
    const customForAi = customRows.map((c: CustomCategoryRow) => ({ id: c.id, name: c.name, mode: c.mode }));
    let okCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i].file;
      try {
        const hardCategory = filenameMatches[i]?.category ?? null;

        updateAt(i, { status: "extracting", progress: 10 });
        const isPdf = (file.type || "").includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
        let contentText = "";
        if (isPdf) {
          try {
            contentText = await extractPdfText(file);
          } catch (extractErr) {
            console.warn("PDF text extraction failed, continuing with filename-only", extractErr);
            contentText = "";
          }
        }
        contentText = contentText
          // eslint-disable-next-line no-control-regex
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
          .replace(/[\uD800-\uDFFF]/g, "");

        updateAt(i, { status: "ai", progress: 30 });

        let category = hardCategory ?? "egyeb";
        let aiConfidence = hardCategory ? 1 : 0;
        let detectedDate: string | null = null;
        let aiReasoning: string | undefined = hardCategory ? "filename keyword match" : undefined;
        try {
          if (hardCategory) {
            updateAt(i, { suggestedCategory: category, detectedDate: null });
            void logAudit("categorize", null, { filename: file.name, category, confidence: 1, hardRule: true });
          } else {
            const result = await categorizeDocument({
              data: {
                filename: file.name,
                mimeType: file.type || undefined,
                sample: contentText.slice(0, 3000) || undefined,
                customCategories: customForAi,
              },
            });
            category = result.category;
            aiConfidence = result.confidence;
            aiReasoning = result.reasoning;
            detectedDate = result.documentDate ?? null;
            updateAt(i, { suggestedCategory: category, detectedDate });
            void logAudit("categorize", null, { filename: file.name, category, confidence: aiConfidence, hardRule: false });

            if (aiConfidence < CONFIDENCE_THRESHOLD || detectedDate) {
              const { category: chosen, documentDate: confirmedDate } = await askConfirm({
                fileName: file.name,
                suggested: category,
                confidence: aiConfidence,
                reasoning: aiReasoning,
                detectedDate,
                docDate: documentDate,
              });
              if (chosen === null) {
                updateAt(i, { status: "error", progress: 0, error: "Kihagyva" });
                continue;
              }
              category = chosen;
              if (confirmedDate) detectedDate = confirmedDate;
            }
          }
        } catch (e) {
          console.warn("AI categorize failed, fallback", e);
          updateAt(i, { suggestedCategory: category });
        }

        // Retention base date: AI-detected or user-set in Advanced settings.
        const finalDocDate = detectedDate ?? documentDate;

        updateAt(i, { status: "uploading", progress: 60 });
        const buf = await file.arrayBuffer();
        const hash = await sha256Hex(buf);
        const safeName = file.name.replace(/[^\w.-]+/g, "_");
        const path = `${user.id}/${Date.now()}-${hash.slice(0, 8)}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
        if (upErr) throw upErr;

        updateAt(i, { status: "saving", progress: 85 });
        const itm_compliant = isStrict(category);
        const { data: inserted, error: insErr } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            filename: file.name,
            original_filename: file.name,
            storage_path: path,
            category,
            itm_compliant,
            size_bytes: file.size,
            mime_type: file.type || null,
            sha256: hash,
            content_text: contentText || null,
            ai_confidence: aiConfidence,
            document_date: finalDocDate,
          })
          .select()
          .single();
        if (insErr) throw insErr;
        okCount++;
        if (inserted) {
          void logAudit("upload", (inserted as DocumentRow).id, { filename: file.name, category, confidence: aiConfidence });
        }
        updateAt(i, { status: "done", progress: 100 });
      } catch (e: unknown) {
        const err = e as { message?: string; error?: string; statusText?: string; name?: string } | Error | string | null;
        let msg = "Ismeretlen hiba";
        if (typeof err === "string") msg = err;
        else if (err && typeof err === "object") {
          msg = (err as { message?: string }).message
            || (err as { error?: string }).error
            || (err as { statusText?: string }).statusText
            || JSON.stringify(err);
        }
        console.error("Upload failed", file.name, e);
        updateAt(i, { status: "error", progress: 0, error: msg });
        toast.error(`${file.name}: ${msg}`);
      }
    }
    setRunning(false);
    if (okCount > 0) toast.success(`${okCount} fájl feltöltve`);
    onComplete();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (running) return;
    addFiles(e.dataTransfer.files);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!running) { onOpenChange(v); if (!v) reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Dokumentumok feltöltése</DialogTitle>
            <DialogDescription>
              Az AI automatikusan kategorizál és kinyeri a dokumentum dátumát.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1">
            {/* TOP: Drag-and-drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); if (!running) setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20"
              } ${running ? "opacity-60 pointer-events-none" : ""}`}
            >
              <UploadCloud className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-semibold mb-4">Húzd ide a fájlokat</p>
              <Button
                type="button"
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={running}
              >
                <FolderOpen className="h-5 w-5 mr-2" /> Fájlok kiválasztása
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                PDF, DOCX, XLSX, JPG, PNG — egyszerre több fájl is feltölthető
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {/* MIDDLE: Selected files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Kiválasztott fájlok ({files.length})
                </p>
                {files.map((f, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-1.5 bg-card">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{f.file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatBytes(f.file.size)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        {f.status === "ai" && <Sparkles className="h-3 w-3" />}
                        {(f.status === "extracting" || f.status === "uploading" || f.status === "saving") && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {f.status !== "queued" && (
                          <span className={f.status === "error" ? "text-destructive" : ""}>
                            {STATUS_LABEL[f.status]}
                          </span>
                        )}
                        {!running && f.status !== "done" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => removeAt(i)}
                            aria-label="Eltávolítás"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {(running || f.status === "done" || f.status === "error") && (
                      <Progress value={f.progress} className="h-1.5" />
                    )}
                    {f.error && <p className="text-xs text-destructive">{f.error}</p>}
                    {f.suggestedCategory && (
                      <p className="text-xs text-muted-foreground">
                        Kategória: <span className="font-medium">{allCats.find((c) => c.id === f.suggestedCategory)?.label ?? f.suggestedCategory}</span>
                        {f.detectedDate && <> • Dátum: <span className="font-medium">{f.detectedDate}</span></>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* BOTTOM: Advanced settings */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings2 className="h-4 w-4" />
                  Haladó beállítások
                  <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" /> Dokumentum dátuma
                  </Label>
                  <Input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                    disabled={running}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ha a dokumentum keltezése eltér a mai dátumtól, add meg itt. A megőrzési határidő ettől a dátumtól számítódik.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { if (!running) { onOpenChange(false); reset(); } }} disabled={running}>
              Bezárás
            </Button>
            <Button
              onClick={startUpload}
              disabled={running || files.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-muted disabled:text-muted-foreground"
            >
              {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Folyamatban...</> : "Feltöltés indítása"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm category + date dialog */}
      <Dialog open={!!pendingConfirm} onOpenChange={(v) => { if (!v) resolveConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" /> Megerősítés szükséges
            </DialogTitle>
            <DialogDescription>
              {pendingConfirm?.fileName}
            </DialogDescription>
          </DialogHeader>
          {pendingConfirm && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Kategória {pendingConfirm.confidence > 0 && `(AI biztonság: ${Math.round(pendingConfirm.confidence * 100)}%)`}</Label>
                <Select value={confirmCategory} onValueChange={setConfirmCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}{c.mode === "strict" && " 🔒"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pendingConfirm.reasoning && (
                  <p className="text-xs text-muted-foreground mt-1">AI: {pendingConfirm.reasoning}</p>
                )}
              </div>
              <div>
                <Label>
                  Dokumentum dátuma
                  {pendingConfirm.detectedDate && <span className="text-xs text-brand ml-2">(AI által felismert)</span>}
                </Label>
                <Input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => resolveConfirm(null)}>Kihagyás</Button>
            <Button onClick={() => resolveConfirm(confirmCategory)}>Mentés</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
