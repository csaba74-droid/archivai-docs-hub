import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase, type DocumentRow } from "@/lib/supabase";
import { formatDeadline } from "@/lib/categories";
import { useCategories, useCategoryHelpers } from "@/hooks/use-categories";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Archive, Search, Upload, LogOut, Lock, FileIcon, Loader2, Trash2,
  CalendarClock, Sparkles, Plus, CreditCard, AlertTriangle, Tag, X,
  Bell, ChevronRight, ShieldCheck,
} from "lucide-react";
import { logAudit } from "@/lib/audit";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { DocumentHoverPreview } from "@/components/DocumentHoverPreview";
import { DocumentThumbnail } from "@/components/DocumentThumbnail";
import { UploadDialog } from "@/components/UploadDialog";
import { CustomCategoryDialog } from "@/components/CustomCategoryDialog";
import { ScanButton } from "@/components/ScanButton";
import { MobileBottomNav } from "@/components/MobileBottomNav";


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
  const [mobileCatsOpen, setMobileCatsOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);


  const canUpload = true;

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
    const baseDate = doc.document_date ?? doc.created_at;
    const deadline = getRetentionDeadline(doc.category, baseDate);
    const expired = deadline && deadline.getTime() < Date.now();
    if (isStrict(doc.category) && !expired) {
      void logAudit("delete_blocked", doc.id, { reason: "strict" });
      toast.error("Törvényi megőrzés alatt", { description: "Törvényileg védett iratok nem törölhetők." });
      return;
    }
    const confirmMsg = expired
      ? `Ez a dokumentum megőrzési ideje lejárt (${formatDeadline(deadline!)}). Biztosan törli?`
      : `Biztosan törlöd?\n${doc.filename}`;
    if (!confirm(confirmMsg)) return;
    try {
      await supabase.storage.from("documents").remove([doc.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      void logAudit("delete", doc.id, { filename: doc.filename, expired: !!expired });
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

  const sidebarNav = (
    <>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <button
          onClick={() => { setActiveCat(null); setMobileCatsOpen(false); }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeCat === null ? "bg-brand text-brand-foreground" : "hover:bg-muted"}`}
        >
          <span className="flex items-center gap-2"><FileIcon className="h-4 w-4" /> Összes</span>
          <span className="text-xs text-muted-foreground">{docs.length}</span>
        </button>

        <SectionHeader icon={<Lock className="h-3 w-3" />} title="Kötelező megőrzés" />
        {builtInStrict.map((cat) => (
          <CategoryButton key={cat.id} cat={cat} active={activeCat === cat.id} count={counts[cat.id] ?? 0} onClick={() => { setActiveCat(cat.id); setMobileCatsOpen(false); }} />
        ))}

        <SectionHeader title="Egyéb tárolás" />
        {builtInNormal.map((cat) => (
          <CategoryButton key={cat.id} cat={cat} active={activeCat === cat.id} count={counts[cat.id] ?? 0} onClick={() => { setActiveCat(cat.id); setMobileCatsOpen(false); }} />
        ))}

        <SectionHeader title="Saját kategóriák" />
        {customRows.length === 0 && (
          <p className="px-3 py-1.5 text-xs text-muted-foreground">Még nincs egyéni kategória</p>
        )}
        {allCats.filter((c) => c.custom).map((cat) => (
          <div key={cat.id} className="group relative">
            <CategoryButton cat={cat} active={activeCat === cat.id} count={counts[cat.id] ?? 0} onClick={() => { setActiveCat(cat.id); setMobileCatsOpen(false); }} />
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteCustomCat(cat.id); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 md:opacity-0 md:group-hover:opacity-100 hover:text-destructive"
              aria-label="Delete category"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          onClick={() => { setNewCatOpen(true); setMobileCatsOpen(false); }}
          className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" /> Új kategória
        </button>
      </nav>
    </>
  );

  const profilePanel = (
    <div className="p-3 space-y-2">
      <Link to="/subscription" onClick={() => setMobileProfileOpen(false)} className="block">
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
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar — desktop only */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-5 border-b flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-brand flex items-center justify-center">
            <Archive className="h-4 w-4 text-brand-foreground" />
          </div>
          <div>
            <h1 className="font-semibold tracking-tight">Archivai</h1>
            <p className="text-[11px] text-muted-foreground">Törvényi előírás szerint archiválva</p>
          </div>
        </div>
        {sidebarNav}
        <div className="border-t">{profilePanel}</div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden border-b-2 border-brand/10 bg-card px-4 py-3 flex items-center justify-between gap-2 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-brand flex items-center justify-center shrink-0">
              <Archive className="h-4 w-4 text-brand-foreground" />
            </div>
            <h1 className="font-semibold tracking-tight text-brand truncate">Archivai</h1>
          </div>
          <button
            aria-label="Értesítések"
            className="h-10 w-10 rounded-full flex items-center justify-center text-brand hover:bg-muted transition-colors"
          >
            <Bell className="h-5 w-5" />
          </button>
        </header>

        {/* Desktop header */}
        <header className="hidden md:flex border-b bg-card px-8 py-4 items-center gap-2">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Keresés név vagy tartalom alapján..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-background"
            />
          </div>
          <Button variant="secondary" onClick={() => { void logAudit("search", null, { query: search, manual: true }); }}>
            <Search className="h-4 w-4 mr-2" /> Keresés
          </Button>
        </header>

        {/* Mobile search bar (prominent) */}
        <div className="md:hidden bg-card px-4 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Keresés a dokumentumokban..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12 bg-background border-border rounded-xl text-base"
            />
          </div>
        </div>


        {!canUpload && (
          <div className="bg-destructive/10 border-b border-destructive/30 px-4 md:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span><strong>Fizetés szükséges.</strong> Csak olvasási hozzáférés.</span>
            </div>
            <Link to="/subscription"><Button size="sm" variant="destructive">Fizetés</Button></Link>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 md:pb-8 space-y-6">
          {/* Stats — desktop only */}
          <div className="hidden md:block">
            <h2 className="text-2xl font-bold tracking-tight">
              {activeCat ? getCategory(activeCat).label : "Összes dokumentum"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} dokumentum{search.trim() && ` — találat: "${search}"`}
            </p>
          </div>

          {/* Mobile home overview — only when no filter/search */}
          {!activeCat && !search.trim() && (
            <MobileHome
              docs={docs}
              counts={counts}
              allCats={allCats}
              onOpenCategory={(id) => setActiveCat(id)}
              onOpenDoc={(d) => setPreviewDoc(d)}
            />
          )}

          {/* Document list: always on desktop; on mobile only when filter/search active */}
          <div className={!activeCat && !search.trim() ? "hidden md:block space-y-6" : "space-y-6"}>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (

            <div className="rounded-xl border bg-card p-4 space-y-3">
              <DropZone
                variant="large"
                dragOver={dragOver}
                disabled={!canUpload}
                onDragOver={(e) => { e.preventDefault(); if (canUpload) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => canUpload && openUploadWith(null)}
              />
              <div className="flex justify-center gap-2 flex-wrap">
                <Button onClick={() => openUploadWith(null)} disabled={!canUpload} size="lg">
                  <Upload className="h-4 w-4 mr-2" /> Feltöltés
                </Button>
                <ScanButton disabled={!canUpload} onFilesReady={(f) => openUploadWith(f)} />
              </div>
            </div>
          ) : (
            <>
              {/* Compact dropzone — desktop only */}
              <div className="hidden md:flex rounded-xl border bg-card p-3 items-center gap-3">
                <div className="flex-1">
                  <DropZone
                    variant="compact"
                    dragOver={dragOver}
                    disabled={!canUpload}
                    onDragOver={(e) => { e.preventDefault(); if (canUpload) setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => canUpload && openUploadWith(null)}
                  />
                </div>
                <Button onClick={() => openUploadWith(null)} disabled={!canUpload}>
                  <Upload className="h-4 w-4 mr-2" /> Feltöltés
                </Button>
                <ScanButton disabled={!canUpload} onFilesReady={(f) => openUploadWith(f)} />
              </div>
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
                      className={`p-0 overflow-hidden hover:shadow-md transition-shadow group relative cursor-pointer ${strict ? "border-lock/40" : ""}`}
                    >
                      <div className="h-48 md:h-36 bg-muted overflow-hidden">
                        <DocumentThumbnail path={doc.storage_path} mimeType={doc.mime_type} filename={doc.filename} className="w-full h-full" />
                      </div>
                      <div className="p-4 md:p-3 space-y-2 md:space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-base md:text-sm font-medium truncate flex-1" title={doc.filename}>{doc.filename}</p>
                          {strict && <Lock className="h-4 w-4 md:h-3.5 md:w-3.5 text-lock shrink-0 mt-0.5" />}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs md:text-[10px] py-0.5 md:py-0 h-5 md:h-4 flex items-center gap-1">
                            {cat.custom && cat.color && <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />}
                            {cat.label}
                          </Badge>
                          {expired && <Badge variant="destructive" className="text-xs md:text-[10px] py-0.5 md:py-0 h-5 md:h-4">Lejárt</Badge>}
                        </div>
                        <div className="flex items-center justify-between text-xs md:text-[11px] text-muted-foreground pt-1">
                          <span className="flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5 md:h-3 md:w-3" />
                            {deadline ? formatDeadline(deadline) : cat.retentionLabel}
                          </span>
                          {(!strict || expired) && canUpload && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                              className="opacity-60 md:opacity-0 md:group-hover:opacity-100 hover:text-destructive transition-opacity p-1 -m-1"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </DocumentHoverPreview>
                );
              })}
            </div>
            </>
          )}

        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav
        activeCat={activeCat}
        onAll={() => { setActiveCat(null); scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
        onSearch={() => { scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => searchRef.current?.focus(), 200); }}
        onUpload={() => canUpload && openUploadWith(null)}
        onCategories={() => setMobileCatsOpen(true)}
        onProfile={() => setMobileProfileOpen(true)}
        onScan={(f) => openUploadWith(f)}
      />

      {/* Mobile categories sheet */}
      <Sheet open={mobileCatsOpen} onOpenChange={setMobileCatsOpen}>
        <SheetContent side="left" className="w-[85vw] sm:w-80 p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Kategóriák</SheetTitle>
          </SheetHeader>
          {sidebarNav}
        </SheetContent>
      </Sheet>

      {/* Mobile profile sheet */}
      <Sheet open={mobileProfileOpen} onOpenChange={setMobileProfileOpen}>
        <SheetContent side="right" className="w-[85vw] sm:w-80 p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Profil</SheetTitle>
          </SheetHeader>
          <div className="flex-1" />
          {profilePanel}
        </SheetContent>
      </Sheet>

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
      <UploadDialog
        open={uploadOpen}
        onOpenChange={(v) => { setUploadOpen(v); if (!v) setPendingFiles(null); }}
        onComplete={loadDocs}
        initialFiles={pendingFiles}
      />
      <CustomCategoryDialog open={newCatOpen} onOpenChange={setNewCatOpen} />
    </div>
  );
}


function DropZone({
  variant,
  dragOver,
  disabled,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  variant: "large" | "compact";
  dragOver: boolean;
  disabled: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  const large = variant === "large";
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      disabled={disabled}
      className={`w-full rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center text-center
        ${large ? "py-20 px-6" : "py-6 px-4"}
        ${dragOver ? "border-brand bg-brand-soft/50" : "border-border bg-muted/30 hover:bg-muted/60"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <Upload className={`${large ? "h-12 w-12" : "h-5 w-5"} text-brand mb-2`} />
      <p className={`${large ? "text-base font-medium" : "text-sm font-medium"}`}>
        Húzd ide a fájlokat vagy kattints a Feltöltés gombra
      </p>
      {large && (
        <p className="text-xs text-muted-foreground mt-2">
          PDF, Word, Excel, képek — egy vagy több fájl egyszerre
        </p>
      )}
    </button>
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
      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-brand text-brand-foreground font-medium" : "hover:bg-muted"}`}
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
