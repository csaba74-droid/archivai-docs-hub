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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase, type DocumentRow, type CustomCategoryRow } from "@/lib/supabase";
import { useCategories, useCategoryHelpers } from "@/hooks/use-categories";
import { useSubscription } from "@/hooks/use-subscription";
import { can, documentCap, storageCap } from "@/lib/entitlements";
import { extractPdfText } from "@/lib/pdf";
import { ocrImage, ocrPdfFirstPage } from "@/lib/ocr";
import { getScanOcrText } from "@/lib/scan-cache";
import { categorizeDocument } from "@/lib/ai.functions";
import { matchFilenameCategory } from "@/config/document-rules";
import { logAudit } from "@/lib/audit";
import { CustomCategoryDialog } from "@/components/CustomCategoryDialog";
import {
  CalendarClock,
  FileText,
  FolderOpen,
  Loader2,
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

const CONFIDENCE_THRESHOLD = 0.85;

// Map document-rules category ids → canonical BUILT_IN_CATEGORIES ids in categories.ts
const CATEGORY_ID_ALIAS: Record<string, string> = {
  szamlak: "szamlak",
  szerzodesek: "szerzodesek",
  szallitolevelek: "szallitolevek",
  munkaugyi_iratok: "munkaugyi",
  adobevallesok: "adobevallasok",
  kozuzemi_szamlak: "kozuzemi",
  banki_dokumentumok: "banki",
  muszaki_dokumentumok: "muszaki",
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
  const { subscription, isTrialing } = useSubscription();
  const plan = subscription?.plan ?? null;
  const canAi = can(plan, "ai_categorization", { isTrialing });
  const canBulk = can(plan, "bulk_upload", { isTrialing });
  const docCap = documentCap(plan, isTrialing);
  const storCap = storageCap(plan, isTrialing);
  const [files, setFiles] = useState<FileProgress[]>([]);

  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [running, setRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    fileName: string;
    suggested: string;
    confidence: number;
    reasoning?: string;
    resolve: (v: string | null) => void;
  } | null>(null);
  const [confirmCategory, setConfirmCategory] = useState("egyeb");
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [datePrompt, setDatePrompt] = useState<{
    documentId: string;
    fileName: string;
    detectedDate: string | null;
    currentDate: string;
  } | null>(null);
  const [datePromptValue, setDatePromptValue] = useState<string>("");

  const reset = () => {
    setFiles([]);
    setDocumentDate(new Date().toISOString().slice(0, 10));
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
  }) =>
    new Promise<string | null>((resolve) => {
      setConfirmCategory(params.suggested);
      setPendingConfirm({ ...params, resolve });
    });

  const resolveConfirm = (chosen: string | null) => {
    if (!pendingConfirm) return;
    pendingConfirm.resolve(chosen);
    setPendingConfirm(null);
  };

  const askDateConfirm = (params: {
    documentId: string;
    fileName: string;
    detectedDate: string | null;
    currentDate: string;
  }) =>
    new Promise<boolean>((resolve) => {
      setDatePrompt(params);
      setDatePromptValue(params.detectedDate ?? new Date().toISOString().slice(0, 10));
      datePromptResolveRef.current = resolve;
    });

  const datePromptResolveRef = useRef<((v: boolean) => void) | null>(null);

  const resolveDatePrompt = async (save: boolean) => {
    const prompt = datePrompt;
    const chosenDate = datePromptValue;
    const resolver = datePromptResolveRef.current;
    setDatePrompt(null);
    datePromptResolveRef.current = null;
    if (save && prompt && chosenDate && chosenDate !== prompt.currentDate) {
      const { error } = await supabase
        .from("documents")
        .update({ document_date: chosenDate })
        .eq("id", prompt.documentId);
      if (error) {
        toast.error(`Dátum frissítés sikertelen: ${error.message}`);
      } else {
        toast.success(`📅 Dátum mentve: ${chosenDate}`);
      }
    }
    resolver?.(save);
  };


  const startUpload = async () => {
    if (files.length === 0) {
      toast.info("Nincs kiválasztott fájl");
      return;
    }
    // Plan: bulk upload (>1 file) requires Pro+.
    if (files.length > 1 && !canBulk) {
      toast.error("Tömeges feltöltés a Pro csomag része", {
        description: "Válts Pro-ra, vagy tölts fel egyesével.",
      });
      return;
    }
    const filenameMatches = files.map(({ file }) => {
      const match = matchFilenameCategory(file.name);
      const category = match ? (CATEGORY_ID_ALIAS[match.category] ?? match.category) : null;
      console.log("FILENAME CHECK:", file.name, "RESULT:", category ?? "(no match → AI)");
      if (category) {
        const label = allCats.find((c) => c.id === category)?.label ?? category;
        toast.success(`📂 Kategória azonosítva: ${label}`);
      }
      return { category };
    });
    const { data: ud } = await supabase.auth.getUser();
    const user = ud.user;
    if (!user) {
      toast.error("Nincs bejelentkezett felhasználó");
      return;
    }
    // Plan: document cap (Alap = 100).
    if (docCap !== null) {
      const { count: existing } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      const remaining = docCap - (existing ?? 0);
      if (remaining <= 0) {
        toast.error("Elérted a dokumentum limitet", {
          description: `Alap csomag: max ${docCap} dokumentum. Válts Pro-ra a korlátlan tároláshoz.`,
        });
        return;
      }
      if (files.length > remaining) {
        toast.error("Túl sok fájl", {
          description: `Csak ${remaining} fájl fér el. Pro csomag → korlátlan.`,
        });
        return;
      }
    }
    setRunning(true);
    const customForAi = customRows.map((c: CustomCategoryRow) => ({ id: c.id, name: c.name, mode: c.is_strict_itm ? "strict" as const : "normal" as const }));
    let okCount = 0;


    for (let i = 0; i < files.length; i++) {
      const file = files[i].file;
      console.log("STARTING UPLOAD FOR:", file.name);
      try {
        const hardCategory = filenameMatches[i]?.category ?? null;

        updateAt(i, { status: "extracting", progress: 10 });
        const lowerName = file.name.toLowerCase();
        const mime = (file.type || "").toLowerCase();
        const isPdf = mime.includes("pdf") || lowerName.endsWith(".pdf");
        const isImage =
          mime.startsWith("image/") ||
          /\.(jpe?g|png|webp|bmp|tiff?|heic)$/i.test(lowerName);
        let contentText = "";
        if (isPdf) {
          // Camera scans: OCR was already done on the upright image before
          // wrapping in PDF. Reuse it instead of re-rendering the page.
          const preOcr = getScanOcrText(file);
          if (preOcr) {
            console.log("Using cached scan OCR text, length:", preOcr.length);
            contentText = preOcr;
          } else {
            try {
              contentText = await extractPdfText(file);
            } catch (extractErr) {
              console.warn("PDF text extraction failed, continuing with filename-only", extractErr);
              contentText = "";
            }
            // Scanned PDF (no embedded text) → OCR first page
            if (contentText.trim().length < 30) {
              console.log("PDF has no text layer, running OCR fallback");
              try {
                const ocr = await ocrPdfFirstPage(file);
                if (ocr) contentText = ocr;
              } catch (ocrErr) {
                console.warn("PDF OCR fallback failed", ocrErr);
              }
            }
          }
        } else if (isImage) {
          try {
            console.log("Image upload — running OCR");
            contentText = await ocrImage(file);
          } catch (ocrErr) {
            console.warn("Image OCR failed", ocrErr);
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
          } else if (!canAi) {
            // Alap plan: no AI. Ask user to pick a category manually.
            const chosen = await askConfirm({
              fileName: file.name,
              suggested: "egyeb",
              confidence: 0,
              reasoning: "AI kategorizálás Pro csomag funkciója — válassz kézzel.",
            });
            if (chosen === null) {
              updateAt(i, { status: "error", progress: 0, error: "Kihagyva" });
              continue;
            }
            category = chosen;
            updateAt(i, { suggestedCategory: category });
          } else {

            console.log("CALLING AI FOR:", file.name, "sampleLen:", contentText.length);
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;
            if (!accessToken) {
              throw new Error("Nincs aktív munkamenet — jelentkezz be újra.");
            }
            const result = await categorizeDocument({
              headers: { Authorization: `Bearer ${accessToken}` },
              data: {
                filename: file.name,
                mimeType: file.type || undefined,
                sample: contentText.slice(0, 3000) || undefined,
                customCategories: customForAi,
                accessToken,
              },
            });
            console.log("AI RESULT:", result.category, result.confidence, result.reasoning, "documentDate:", result.documentDate, "raw:", result);
            category = result.category;
            aiConfidence = result.confidence;
            aiReasoning = result.reasoning;
            detectedDate = result.documentDate ?? null;

            updateAt(i, { suggestedCategory: category, detectedDate });
            void logAudit("categorize", null, { filename: file.name, category, confidence: aiConfidence, hardRule: false });

            if (aiConfidence < CONFIDENCE_THRESHOLD) {
              const chosen = await askConfirm({
                fileName: file.name,
                suggested: category,
                confidence: aiConfidence,
                reasoning: aiReasoning,
              });
              if (chosen === null) {
                updateAt(i, { status: "error", progress: 0, error: "Kihagyva" });
                continue;
              }
              category = chosen;
            }
          }
        } catch (e) {
          console.warn("AI categorize failed, fallback", e);
          updateAt(i, { suggestedCategory: category });
        }

        // Save with the user-visible document date. The AI-detected date
        // (if different) is confirmed with the user after upload.
        const finalDocDate = documentDate;

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

        // Post-upload: always confirm document date (pre-filled with detected date or today).
        if (inserted) {
          await askDateConfirm({
            documentId: (inserted as DocumentRow).id,
            fileName: file.name,
            detectedDate,
            currentDate: finalDocDate,
          });
        }
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col max-sm:max-w-full max-sm:w-screen max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:border-0 max-sm:p-4">
          <DialogHeader>
            <DialogTitle>Dokumentumok feltöltése</DialogTitle>
            <DialogDescription>
              Az AI automatikusan kategorizál és kinyeri a dokumentum dátumát.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex flex-col min-h-0 flex-1">
            {/* TOP: Compact drag-and-drop zone (max 150px) */}
            <div
              onDragOver={(e) => { e.preventDefault(); if (!running) setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              style={{ maxHeight: 150 }}
              className={`rounded-xl border-2 border-dashed px-4 py-3 flex flex-row items-center gap-4 transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20"
              } ${running ? "opacity-60 pointer-events-none" : ""}`}
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Húzd ide a fájlokat</p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, JPG, PNG — több fájl is</p>
              </div>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-brand hover:bg-brand-hover text-brand-foreground shrink-0"
                disabled={running}
              >
                <FolderOpen className="h-4 w-4 mr-2" /> Fájlok kiválasztása
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {/* Document date — always visible, above file list */}
            <div className="rounded-lg border bg-muted/20 px-3 py-2 flex items-center gap-3">
              <Label className="flex items-center gap-2 text-sm whitespace-nowrap m-0">
                <CalendarClock className="h-4 w-4" /> 📅 Dokumentum dátuma
              </Label>
              <Input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                disabled={running}
                className="h-8 w-auto"
              />
              <p className="text-xs text-muted-foreground hidden md:block">
                A megőrzési határidő ettől számítódik.
              </p>
            </div>

            {/* Selected files — scrolls only if needed */}
            {files.length > 0 && (
              <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
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
          </div>


          <DialogFooter>
            <Button variant="outline" onClick={() => { if (!running) { onOpenChange(false); reset(); } }} disabled={running}>
              Bezárás
            </Button>
            <Button
              onClick={startUpload}
              disabled={running || files.length === 0}
              className="bg-brand hover:bg-brand-hover text-brand-foreground disabled:bg-muted disabled:text-muted-foreground"
            >
              {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Folyamatban...</> : "Feltöltés indítása"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm category dialog (shown when AI confidence < threshold) */}
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
          {pendingConfirm && (() => {
            const suggestedLabel = allCats.find((c) => c.id === pendingConfirm.suggested)?.label ?? pendingConfirm.suggested;
            const confirmLabel = allCats.find((c) => c.id === confirmCategory)?.label ?? confirmCategory;
            const pct = Math.round(pendingConfirm.confidence * 100);
            return (
              <div className="space-y-4 py-2">
                {pendingConfirm.confidence > 0 ? (
                  <p className="text-sm">
                    Az AI szerint ez a dokumentum a(z){" "}
                    <span className="font-semibold">{suggestedLabel}</span> kategóriába tartozik
                    {" "}({pct}% biztos). Megerősíted, vagy más kategóriát választasz?
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Válassz kategóriát a dokumentumhoz.
                  </p>
                )}
                <div>
                  <Label>Kategória</Label>
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
                  {(confirmCategory === "egyeb" || pendingConfirm.suggested === "egyeb") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => setNewCatOpen(true)}
                    >
                      + Új kategória létrehozása
                    </Button>
                  )}
                </div>
                <DialogFooter className="flex flex-row gap-2 sm:justify-end">
                  <Button variant="outline" onClick={() => resolveConfirm(null)}>Kihagyás</Button>
                  {confirmCategory === pendingConfirm.suggested && pendingConfirm.confidence > 0 ? (
                    <Button
                      className="bg-brand hover:bg-brand-hover text-brand-foreground"
                      onClick={() => resolveConfirm(pendingConfirm.suggested)}
                    >
                      Igen, {suggestedLabel}
                    </Button>
                  ) : (
                    <Button
                      className="bg-brand hover:bg-brand-hover text-brand-foreground"
                      onClick={() => resolveConfirm(confirmCategory)}
                    >
                      Mentés: {confirmLabel}
                    </Button>
                  )}
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* Inline new-category dialog for "Egyéb" cases */}
      <CustomCategoryDialog
        open={newCatOpen}
        onOpenChange={setNewCatOpen}
        onCreated={(newId) => setConfirmCategory(newId)}
      />

      {/* Post-upload: AI-detected document date confirmation */}
      <Dialog open={!!datePrompt} onOpenChange={(v) => { if (!v) resolveDatePrompt(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📅 Dokumentum dátuma</DialogTitle>
            <DialogDescription>{datePrompt?.fileName}</DialogDescription>
          </DialogHeader>
          {datePrompt && (
            <div className="py-2 space-y-3 text-sm">
              {datePrompt.detectedDate ? (
                <p>
                  Az AI ezt a dátumot azonosította:{" "}
                  <span className="font-semibold">{datePrompt.detectedDate}</span>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Nem sikerült dátumot azonosítani. Kérem adja meg a dokumentum dátumát:
                </p>
              )}
              <div className="flex items-center gap-2">
                <Label className="flex items-center gap-2 whitespace-nowrap m-0">
                  <CalendarClock className="h-4 w-4" /> Dátum
                </Label>
                <Input
                  type="date"
                  value={datePromptValue}
                  onChange={(e) => setDatePromptValue(e.target.value)}
                  className="h-9 w-auto"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A megőrzési határidő ettől a dátumtól számítódik.
              </p>
            </div>
          )}
          <DialogFooter className="flex flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => resolveDatePrompt(false)}>
              Mégse
            </Button>
            <Button
              className="bg-brand hover:bg-brand-hover text-brand-foreground"
              onClick={() => resolveDatePrompt(true)}
            >
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
