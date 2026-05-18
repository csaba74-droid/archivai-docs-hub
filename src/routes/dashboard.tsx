import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase, type DocumentRow } from "@/lib/supabase";
import {
  CATEGORIES,
  getCategory,
  getRetentionDeadline,
  formatDeadline,
  isStrict,
} from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Archive,
  Search,
  Upload,
  LogOut,
  ShieldCheck,
  Lock,
  FileIcon,
  Loader2,
  Trash2,
  CalendarClock,
  Sparkles,
} from "lucide-react";
import { categorizeDocument } from "@/lib/ai.functions";
import { extractPdfText } from "@/lib/pdf";
import { logAudit } from "@/lib/audit";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { DocumentHoverPreview } from "@/components/DocumentHoverPreview";
import { DocumentThumbnail } from "@/components/DocumentThumbnail";

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CONFIDENCE_THRESHOLD = 0.8;

type PendingConfirm = {
  file: File;
  suggested: string;
  confidence: number;
  reasoning?: string;
  resolve: (chosen: string | null) => void;
};

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmCategory, setConfirmCategory] = useState<string>("egyeb");

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Document list failed:", error);
      toast.error("A dokumentumok betöltése nem sikerült", {
        description: error.message,
      });
    } else if (data) {
      setDocs(data as DocumentRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
    });
    loadDocs();
  }, [loadDocs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (activeCat && d.category !== activeCat) return false;
      if (!q) return true;
      const hay =
        (d.filename ?? "").toLowerCase() +
        " " +
        (d.original_filename ?? "").toLowerCase() +
        " " +
        (d.content_text ?? "").toLowerCase();
      return hay.includes(q);
    });
  }, [docs, search, activeCat]);

  useEffect(() => {
    if (!search.trim()) return;
    const t = setTimeout(() => {
      void logAudit("search", null, { query: search, hits: filtered.length });
    }, 800);
    return () => clearTimeout(t);
  }, [search, filtered.length]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    docs.forEach((d) => (map[d.category] = (map[d.category] ?? 0) + 1));
    return map;
  }, [docs]);

  const handleDelete = async (doc: DocumentRow) => {
    if (isStrict(doc.category)) {
      void logAudit("delete_blocked", doc.id, { reason: "strict" });
      toast.error("Ez a dokumentum törvényi megőrzés alatt áll", {
        description: "Az ITM-besorolású iratokat nem lehet törölni.",
      });
      return;
    }
    if (!confirm(`Biztosan törlöd? \n${doc.filename}`)) return;
    try {
      const { error: stErr } = await supabase.storage
        .from("documents")
        .remove([doc.storage_path]);
      if (stErr) throw stErr;
      const { error: dbErr } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);
      if (dbErr) throw dbErr;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      void logAudit("delete", doc.id, { filename: doc.filename });
      toast.success("Dokumentum törölve");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Delete failed:", e);
      toast.error("Törlés sikertelen", { description: msg });
    }
  };

  const askConfirmCategory = (
    file: File,
    suggested: string,
    confidence: number,
    reasoning?: string,
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setConfirmCategory(suggested);
      setPendingConfirm({ file, suggested, confidence, reasoning, resolve });
    });
  };

  const resolveConfirm = (chosen: string | null) => {
    if (pendingConfirm) {
      pendingConfirm.resolve(chosen);
      setPendingConfirm(null);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) {
      toast.info("Nem választottál ki fájlt");
      return;
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      toast.error("Nincs bejelentkezett felhasználó");
      return;
    }
    setUploading(true);
    let ok = 0;
    try {
      for (const file of selectedFiles) {
        try {
          const isPdf =
            (file.type || "").includes("pdf") ||
            file.name.toLowerCase().endsWith(".pdf");
          const contentText = isPdf ? await extractPdfText(file) : "";

          // AI categorization
          let category = "egyeb";
          let aiConfidence = 0;
          try {
            const result = await categorizeDocument({
              data: {
                filename: file.name,
                mimeType: file.type || undefined,
                sample: contentText.slice(0, 2000) || undefined,
              },
            });
            category = result.category;
            aiConfidence = result.confidence;
            void logAudit("categorize", null, {
              filename: file.name,
              category,
              confidence: aiConfidence,
            });

            if (aiConfidence < CONFIDENCE_THRESHOLD) {
              const chosen = await askConfirmCategory(
                file,
                category,
                aiConfidence,
                result.reasoning,
              );
              if (chosen === null) {
                toast.info(`Kihagyva: ${file.name}`);
                continue;
              }
              category = chosen;
            }
          } catch (e) {
            console.warn("AI categorize failed, falling back to 'egyeb'", e);
          }

          const hash = await sha256Hex(file);
          const safeName = file.name.replace(/[^\w.-]+/g, "_");
          const path = `${user.id}/${Date.now()}-${hash.slice(0, 8)}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("documents")
            .upload(path, file, {
              upsert: false,
              contentType: file.type || "application/octet-stream",
            });
          if (upErr) throw upErr;
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
            })
            .select()
            .single();
          if (insErr) throw insErr;
          ok++;
          if (inserted) {
            void logAudit("upload", (inserted as DocumentRow).id, {
              filename: file.name,
              category,
              confidence: aiConfidence,
            });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("Upload failed:", file.name, e);
          toast.error(`Hiba: ${file.name}`, { description: msg });
        }
      }
      if (ok > 0) toast.success(`${ok} fájl feltöltve`);
      await loadDocs();
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-5 border-b flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-brand flex items-center justify-center">
            <Archive className="h-4 w-4 text-brand-foreground" />
          </div>
          <div>
            <h1 className="font-semibold tracking-tight">Archivai</h1>
            <p className="text-[11px] text-muted-foreground">ITM-megfelelő archív</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <button
            onClick={() => setActiveCat(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeCat === null ? "bg-brand-soft text-brand" : "text-foreground hover:bg-muted"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileIcon className="h-4 w-4" /> Összes dokumentum
            </span>
            <span className="text-xs text-muted-foreground">{docs.length}</span>
          </button>

          {(["strict", "normal"] as const).map((mode) => (
            <div key={mode}>
              <div className="pt-3 pb-1 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                {mode === "strict" ? (
                  <>
                    <Lock className="h-3 w-3" /> ITM kötelező
                  </>
                ) : (
                  "Egyéb tárolás"
                )}
              </div>
              {CATEGORIES.filter((c) => c.mode === mode).map((cat) => {
                const Icon = cat.icon;
                const active = activeCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCat(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-brand-soft text-brand font-medium"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                      {cat.mode === "strict" && (
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{counts[cat.id] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t">
          <div className="px-2 pb-2 text-xs text-muted-foreground truncate">{userEmail}</div>
          <Button variant="outline" size="sm" onClick={signOut} className="w-full">
            <LogOut className="h-3.5 w-3.5 mr-2" /> Kijelentkezés
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-card px-8 py-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Keresés név vagy tartalom alapján..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-background"
            />
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" /> Feltöltés
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {activeCat ? getCategory(activeCat).label : "Összes dokumentum"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} dokumentum
              {search.trim() && ` — találat: "${search}"`}
            </p>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              dragOver
                ? "border-brand bg-brand-soft"
                : "border-border bg-card hover:border-brand/40"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Feltöltés és AI kategorizálás folyamatban...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-brand-soft flex items-center justify-center">
                  <Upload className="h-5 w-5 text-brand" />
                </div>
                <p className="text-sm font-medium">
                  Húzd ide a fájlokat vagy kattints a Feltöltés gombra
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> AI-vezérelt automatikus kategorizálás
                </p>
              </div>
            )}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Még nincsenek dokumentumok itt.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((doc) => {
                const cat = getCategory(doc.category);
                const strict = cat.mode === "strict";
                const deadline = getRetentionDeadline(doc.category, doc.created_at);
                return (
                  <DocumentHoverPreview key={doc.id} doc={doc}>
                    <Card
                      role="button"
                      tabIndex={0}
                      onClick={() => setPreviewDoc(doc)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setPreviewDoc(doc);
                      }}
                      className={`p-0 overflow-hidden hover:shadow-md transition-shadow group relative cursor-pointer ${
                        strict ? "border-brand/30" : ""
                      }`}
                    >
                      <div className="relative">
                        <DocumentThumbnail
                          path={doc.storage_path}
                          mimeType={doc.mime_type}
                          className="w-full h-36"
                          alt={doc.filename}
                        />
                        {strict && (
                          <span
                            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-brand text-brand-foreground flex items-center justify-center shadow"
                            title="Törvényi megőrzés alatt"
                          >
                            <Lock className="h-3 w-3" />
                          </span>
                        )}
                        {!strict && (
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(doc);
                            }}
                            title="Törlés"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="font-medium text-sm truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {cat.label}
                          </Badge>
                          {strict ? (
                            <Badge className="text-[10px] font-normal bg-brand text-brand-foreground hover:bg-brand/90 gap-1">
                              <ShieldCheck className="h-3 w-3" /> ITM zárolt
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal text-muted-foreground"
                            >
                              Ajánlott
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CalendarClock className="h-3 w-3" />
                          {deadline ? (
                            <span>
                              {strict ? "Megőrzés:" : "Ajánlott:"} {formatDeadline(deadline)}
                            </span>
                          ) : (
                            <span>{cat.retentionLabel}</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </DocumentHoverPreview>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <DocumentPreviewModal
        doc={previewDoc}
        open={!!previewDoc}
        onOpenChange={(v) => !v && setPreviewDoc(null)}
      />

      <AlertDialog
        open={!!pendingConfirm}
        onOpenChange={(v) => !v && resolveConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              Kategória megerősítése
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Az AI nem teljesen biztos a fájl kategóriájában (
                  <strong>{Math.round((pendingConfirm?.confidence ?? 0) * 100)}%</strong>
                  ).
                </p>
                <p className="text-xs truncate">
                  Fájl: <span className="font-mono">{pendingConfirm?.file.name}</span>
                </p>
                {pendingConfirm?.reasoning && (
                  <p className="text-xs italic">„{pendingConfirm.reasoning}"</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={confirmCategory} onValueChange={setConfirmCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveConfirm(null)}>
              Mégse
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => resolveConfirm(confirmCategory)}>
              Megerősítés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
