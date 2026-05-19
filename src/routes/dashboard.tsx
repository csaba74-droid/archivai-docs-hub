import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase, type DocumentRow } from "@/lib/supabase";
import { formatDeadline } from "@/lib/categories";
import { useCategories, useCategoryHelpers } from "@/hooks/use-categories";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Archive, Search, Upload, LogOut, Lock, FileIcon, Loader2, Trash2,
  CalendarClock, Sparkles, Plus, CreditCard, AlertTriangle, Tag, X,
} from "lucide-react";
import { logAudit } from "@/lib/audit";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { DocumentHoverPreview } from "@/components/DocumentHoverPreview";
import { DocumentThumbnail } from "@/components/DocumentThumbnail";
import { UploadDialog } from "@/components/UploadDialog";
import { CustomCategoryDialog } from "@/components/CustomCategoryDialog";

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
  const { customRows, all: allCats, remove: removeCustomCat } = useCategories();
  const { getCategory, isStrict, getRetentionDeadline } = useCategoryHelpers();
  const { subscription, active } = useSubscription();

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);

  const canUpload = active;

  const openUploadWith = useCallback((files?: File[] | null) => {
    setPendingFiles(files && files.length > 0 ? files : null);
    setUploadOpen(true);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!canUpload) {
        toast.error("Csak olvasási hozzáférés", { description: "Rendezd a fizetést." });
        return;
      }
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) openUploadWith(files);
    },
    [canUpload, openUploadWith],
  );


  const loadDocs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Betöltési hiba", { description: error.message });
    else if (data) setDocs(data as DocumentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ""));
    loadDocs();
  }, [loadDocs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (activeCat && d.category !== activeCat) return false;
      if (!q) return true;
      const hay = `${d.filename ?? ""} ${d.original_filename ?? ""} ${d.content_text ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [docs, search, activeCat]);

  useEffect(() => {
    if (!search.trim()) return;
    const t = setTimeout(() => { void logAudit("search", null, { query: search, hits: filtered.length }); }, 800);
    return () => clearTimeout(t);
  }, [search, filtered.length]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    docs.forEach((d) => { map[d.category] = (map[d.category] ?? 0) + 1; });
    return map;
  }, [docs]);

  const handleDelete = async (doc: DocumentRow) => {
    if (!canUpload) {
      toast.error("Csak olvasási hozzáférés", { description: "Rendezd a fizetést." });
      return;
    }
    if (isStrict(doc.category)) {
      void logAudit("delete_blocked", doc.id, { reason: "strict" });
      toast.error("Törvényi megőrzés alatt", { description: "ITM-besorolású iratok nem törölhetők." });
      return;
    }
    if (!confirm(`Biztosan törlöd?\n${doc.filename}`)) return;
    try {
      await supabase.storage.from("documents").remove([doc.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      void logAudit("delete", doc.id, { filename: doc.filename });
      toast.success("Törölve");
    } catch (e) {
      toast.error("Törlés sikertelen", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleDeleteCustomCat = async (catId: string) => {
    const realId = catId.startsWith("custom:") ? catId.slice(7) : catId;
    const inUse = docs.some((d) => d.category === catId);
    if (inUse) {
      toast.error("Nem üres kategória", { description: "Csak üres custom kategória törölhető." });
      return;
    }
    if (!confirm("Biztosan törlöd ezt a kategóriát?")) return;
    try {
      await removeCustomCat(realId);
      if (activeCat === catId) setActiveCat(null);
      toast.success("Kategória törölve");
    } catch (e) {
      toast.error("Sikertelen", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const builtInStrict = allCats.filter((c) => !c.custom && c.mode === "strict");
  const builtInNormal = allCats.filter((c) => !c.custom && c.mode === "normal");

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
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeCat === null ? "bg-brand-soft text-brand" : "hover:bg-muted"}`}
          >
            <span className="flex items-center gap-2"><FileIcon className="h-4 w-4" /> Összes</span>
            <span className="text-xs text-muted-foreground">{docs.length}</span>
          </button>

          <SectionHeader icon={<Lock className="h-3 w-3" />} title="ITM kötelező" />
          {builtInStrict.map((cat) => (
            <CategoryButton key={cat.id} cat={cat} active={activeCat === cat.id} count={counts[cat.id] ?? 0} onClick={() => setActiveCat(cat.id)} />
          ))}

          <SectionHeader title="Egyéb tárolás" />
          {builtInNormal.map((cat) => (
            <CategoryButton key={cat.id} cat={cat} active={activeCat === cat.id} count={counts[cat.id] ?? 0} onClick={() => setActiveCat(cat.id)} />
          ))}

          <SectionHeader title="Saját kategóriák" />
          {customRows.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-muted-foreground">Még nincs egyéni kategória</p>
          )}
          {allCats.filter((c) => c.custom).map((cat) => (
            <div key={cat.id} className="group relative">
              <CategoryButton cat={cat} active={activeCat === cat.id} count={counts[cat.id] ?? 0} onClick={() => setActiveCat(cat.id)} />
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteCustomCat(cat.id); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:text-destructive"
                aria-label="Delete category"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setNewCatOpen(true)}
            className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" /> Új kategória
          </button>
        </nav>

        <div className="p-3 border-t space-y-2">
          <Link to="/subscription" className="block">
            <Button variant="outline" size="sm" className="w-full">
              <CreditCard className="h-3.5 w-3.5 mr-2" />
              {subscription ? PLAN_INFO[subscription.plan].label : "Csomag"}
            </Button>
          </Link>
          <div className="px-2 text-xs text-muted-foreground truncate">{userEmail}</div>
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
            <Input placeholder="Keresés név vagy tartalom alapján..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-background" />
          </div>
          <Button onClick={() => openUploadWith(null)} disabled={!canUpload}>
            <Upload className="h-4 w-4 mr-2" /> Feltöltés
          </Button>

        </header>

        {!canUpload && (
          <div className="bg-destructive/10 border-b border-destructive/30 px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span><strong>Fizetés szükséges.</strong> Csak olvasási hozzáférés. A dokumentumok biztonságban vannak.</span>
            </div>
            <Link to="/subscription"><Button size="sm" variant="destructive">Fizetés rendezése</Button></Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {activeCat ? getCategory(activeCat).label : "Összes dokumentum"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} dokumentum{search.trim() && ` — találat: "${search}"`}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Még nincsenek dokumentumok itt.</p>
              {canUpload && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" /> Első feltöltés
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((doc) => {
                const cat = getCategory(doc.category);
                const strict = cat.mode === "strict";
                const baseDate = doc.document_date ?? doc.created_at;
                const deadline = getRetentionDeadline(doc.category, baseDate);
                const expired = deadline && deadline.getTime() < Date.now();
                return (
                  <DocumentHoverPreview key={doc.id} doc={doc}>
                    <Card
                      role="button" tabIndex={0}
                      onClick={() => setPreviewDoc(doc)}
                      onKeyDown={(e) => { if (e.key === "Enter") setPreviewDoc(doc); }}
                      className={`p-0 overflow-hidden hover:shadow-md transition-shadow group relative cursor-pointer ${strict ? "border-brand/30" : ""}`}
                    >
                      <div className="h-36 bg-muted overflow-hidden">
                        <DocumentThumbnail path={doc.storage_path} mimeType={doc.mime_type} filename={doc.filename} className="w-full h-full" />
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate flex-1" title={doc.filename}>{doc.filename}</p>
                          {strict && <Lock className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] py-0 h-4 flex items-center gap-1">
                            {cat.custom && cat.color && <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />}
                            {cat.label}
                          </Badge>
                          {expired && <Badge variant="destructive" className="text-[10px] py-0 h-4">Lejárt</Badge>}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                          <span className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {deadline ? formatDeadline(deadline) : cat.retentionLabel}
                          </span>
                          {!strict && canUpload && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                              className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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
        onOpenChange={(v) => { if (!v) setPreviewDoc(null); }}
        onUpdated={(updated) => {
          setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          setPreviewDoc(updated);
        }}
        canEdit={canUpload}
      />
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onComplete={loadDocs} />
      <CustomCategoryDialog open={newCatOpen} onOpenChange={setNewCatOpen} />
    </div>
  );
}

function SectionHeader({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="pt-3 pb-1 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
      {icon} {title}
    </div>
  );
}

function CategoryButton({ cat, active, count, onClick }: { cat: ReturnType<typeof useCategoryHelpers>["all"][number]; active: boolean; count: number; onClick: () => void }) {
  const Icon = cat.icon;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-brand-soft text-brand font-medium" : "hover:bg-muted"}`}
    >
      <span className="flex items-center gap-2 min-w-0">
        {cat.custom && cat.color ? (
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: cat.color }} />
        ) : (
          <Icon className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{cat.label}</span>
        {cat.mode === "strict" && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
      </span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );
}
