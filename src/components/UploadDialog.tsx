import { useEffect, useState } from "react";
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
import { logAudit } from "@/lib/audit";
import { CalendarClock, FileText, Loader2, Sparkles } from "lucide-react";

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

const STATUS_LABEL: Record<FileProgress["status"], string> = {
  queued: "Várakozik",
  extracting: "Szöveg kinyerés",
  ai: "AI elemzés",
  uploading: "Feltöltés",
  saving: "Mentés",
  done: "Kész",
  error: "Hiba",
};

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
  };

  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      setFiles(initialFiles.map((file) => ({ file, status: "queued", progress: 0 })));
    }
  }, [open, initialFiles]);

  const handleSelect = (selected: FileList | File[] | null) => {
    if (!selected) return;
    const arr = Array.from(selected);
    setFiles(arr.map((file) => ({ file, status: "queued", progress: 0 })));
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
        // Final safety: strip NUL + control chars that Postgres rejects
        // ("unsupported Unicode escape sequence").
        contentText = contentText
          // eslint-disable-next-line no-control-regex
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
          .replace(/[\uD800-\uDFFF]/g, "");

        updateAt(i, { status: "ai", progress: 30 });
        let category = "egyeb";
        let aiConfidence = 0;
        let detectedDate: string | null = null;
        try {
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
          detectedDate = result.documentDate ?? null;
          updateAt(i, { suggestedCategory: category, detectedDate });
          void logAudit("categorize", null, { filename: file.name, category, confidence: aiConfidence });

          if (aiConfidence < CONFIDENCE_THRESHOLD || detectedDate) {
            const { category: chosen, documentDate: confirmedDate } = await askConfirm({
              fileName: file.name,
              suggested: category,
              confidence: aiConfidence,
              reasoning: result.reasoning,
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
        } catch (e) {
          console.warn("AI categorize failed, fallback", e);
        }

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

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!running) { onOpenChange(v); if (!v) reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Dokumentumok feltöltése</DialogTitle>
            <DialogDescription>
              Több fájl is feltölthető egyszerre. Az AI automatikusan kategorizál és próbálja kinyerni a dokumentum dátumát.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-2">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <CalendarClock className="h-4 w-4" /> Dokumentum dátuma (alapértelmezett)
              </Label>
              <Input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                disabled={running}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A megőrzési határidő ettől a dátumtól számítódik (nem a feltöltés dátumától). Az AI is megpróbálja kinyerni a tényleges dátumot.
              </p>
            </div>

            <div>
              <Label className="mb-2 block">Fájlok</Label>
              <Input
                type="file"
                multiple
                disabled={running}
                onChange={(e) => handleSelect(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="border rounded-md p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{f.file.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        {f.status === "ai" && <Sparkles className="h-3 w-3" />}
                        {(f.status === "extracting" || f.status === "uploading" || f.status === "saving") && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        <span className={f.status === "error" ? "text-destructive" : ""}>
                          {STATUS_LABEL[f.status]}
                        </span>
                      </div>
                    </div>
                    <Progress value={f.progress} className="h-1.5" />
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { if (!running) { onOpenChange(false); reset(); } }} disabled={running}>Bezárás</Button>
            <Button onClick={startUpload} disabled={running || files.length === 0}>
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
