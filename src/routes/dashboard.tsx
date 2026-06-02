import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase, type DocumentRow } from "@/lib/supabase";
import { formatDeadline, type Category } from "@/lib/categories";
import { useCategories, useCategoryHelpers } from "@/hooks/use-categories";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { documentCap, storageCap } from "@/lib/entitlements";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Archive, Search, Upload, LogOut, Lock, FileIcon, Loader2, Trash2,
  CalendarClock, Sparkles, Plus, CreditCard, AlertTriangle, Tag, X,
  Bell, ChevronRight, ShieldCheck, ClipboardList, UserCog, ArrowLeft,
  Home, Gift, Copy, Check, CheckSquare, Users, Camera, BookOpen, Shield, Plug, Mail, FolderPlus, ArrowUpDown, Download,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { logAudit } from "@/lib/audit";
import { isInGracePeriod, GRACE_AUDIT_NOTE } from "@/lib/grace-period";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { DocumentHoverPreview } from "@/components/DocumentHoverPreview";
import { DocumentThumbnail } from "@/components/DocumentThumbnail";
import { DocumentCard } from "@/components/DocumentCard";
import { UploadDialog } from "@/components/UploadDialog";
import { CustomCategoryDialog } from "@/components/CustomCategoryDialog";
import { CategoryTree } from "@/components/CategoryTree";
import { ScanButton } from "@/components/ScanButton";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useDocumentSearch } from "@/hooks/use-document-search";
import { SearchPanel, SearchHistoryDropdown } from "@/components/SearchPanel";
import { TrialBanner } from "@/components/TrialBanner";
import { SubfolderChips } from "@/components/SubfolderChips";
import { BulkMoveDialog } from "@/components/BulkMoveDialog";
import { MoveFolderDialog } from "@/components/MoveFolderDialog";
import { RenameFolderDialog } from "@/components/RenameFolderDialog";
import { ArrowRightLeft } from "lucide-react";
import { SharedWithMeSection } from "@/components/SharedWithMeSection";
import { SharedWithMeSidebar } from "@/components/SharedWithMeSidebar";


export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/" });
  },
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { customRows, all: allCats, remove: removeCustomCat } = useCategories();
  const { getCategory, isStrict, getRetentionDeadline, all: allCategories } = useCategoryHelpers();
  const { subscription, active, trialExpired, isTrialing, reload: reloadSubscription } = useSubscription();
  useEffect(() => { void reloadSubscription(); }, [reloadSubscription]);

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [archivaiEmail, setArchivaiEmail] = useState<string>("");
  const [archivaiEmailCopied, setArchivaiEmailCopied] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [subfolderParent, setSubfolderParent] = useState<string | null>(null);
  const [mobileCatsOpen, setMobileCatsOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sortBy, setSortBy] = useState<"created_desc" | "created_asc" | "name_asc" | "name_desc" | "size_desc" | "size_asc">("created_desc");

  // Clear selection when leaving / changing category or activating search
  useEffect(() => {
    setSelectedDocs(new Set());
    setSelectionMode(false);
  }, [activeCat]);

  const toggleDocSelected = useCallback((id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const moveDocsTo = useCallback(async (targetCatId: string, docIds: string[]) => {
    if (docIds.length === 0) return;
    const { error } = await supabase
      .from("documents")
      .update({ category: targetCatId })
      .in("id", docIds);
    if (error) {
      toast.error("Áthelyezés sikertelen", { description: error.message });
      return;
    }
    await Promise.all(
      docIds.map((id) => logAudit("move", id, { to: targetCatId, bulk: docIds.length > 1 })),
    );
    setDocs((prev) =>
      prev.map((d) => (docIds.includes(d.id) ? { ...d, category: targetCatId } : d)),
    );
    setSelectedDocs(new Set());
    toast.success(
      docIds.length === 1 ? "Áthelyezve" : `${docIds.length} dokumentum áthelyezve`,
    );
  }, []);


  const canUpload = !trialExpired;

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
    supabase.auth.getUser().then(async ({ data }) => {
      setUserEmail(data.user?.email ?? "");
      setUserId(data.user?.id ?? "");
      if (data.user?.id) {
        let { data: prof } = await supabase
          .from("profiles")
          .select("archivai_email")
          .eq("id", data.user.id)
          .maybeSingle();

        // Self-heal: profile row missing (e.g. signup trigger failed historically).
        // Insert an empty row so the BEFORE-INSERT trigger derives archivai_email
        // from full_name / email local-part.
        if (!prof) {
          const meta = (data.user.user_metadata ?? {}) as Record<string, string>;
          const emailLocal = (data.user.email ?? "").split("@")[0]?.replace(/[._\-+]+/g, " ").trim() ?? "";
          const fullName = meta.full_name?.trim() || emailLocal;
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName,
            company: meta.company ?? "",
          });
          const re = await supabase
            .from("profiles")
            .select("archivai_email")
            .eq("id", data.user.id)
            .maybeSingle();
          prof = re.data;
        }

        const row = prof as { archivai_email: string | null } | null;
        setArchivaiEmail(row?.archivai_email ?? "");
      }
    });
    loadDocs();
  }, [loadDocs]);

  const archivaiFullEmail = useMemo(
    () => archivaiEmail || "Generálás folyamatban...",
    [archivaiEmail],
  );
  const copyArchivaiEmail = useCallback(async () => {
    if (!archivaiFullEmail) return;
    try {
      await navigator.clipboard.writeText(archivaiFullEmail);
      setArchivaiEmailCopied(true);
      toast.success("E-mail cím kimásolva");
      setTimeout(() => setArchivaiEmailCopied(false), 2000);
    } catch {
      toast.error("Másolás sikertelen");
    }
  }, [archivaiFullEmail]);

  const referralLink = useMemo(
    () => (userId && typeof window !== "undefined" ? `${window.location.origin}/register?ref=${userId}` : ""),
    [userId],
  );
  const copyReferral = useCallback(async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Link kimásolva");
    } catch {
      toast.error("Másolás sikertelen");
    }
  }, [referralLink]);


  const searchState = useDocumentSearch(docs, allCats);
  const { rawQuery, setRawQuery, query: searchQuery, isActive: searchActive } = searchState;
  // Back-compat alias used in many JSX spots below
  const search = rawQuery;
  const setSearch = setRawQuery;

  const filtered = useMemo(() => {
    const list = docs.filter((d) => {
      if (activeCat && d.category !== activeCat) return false;
      return true;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "created_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name_asc":
          return a.filename.localeCompare(b.filename, "hu");
        case "name_desc":
          return b.filename.localeCompare(a.filename, "hu");
        case "size_desc":
          return (Number(b.size_bytes) || 0) - (Number(a.size_bytes) || 0);
        case "size_asc":
          return (Number(a.size_bytes) || 0) - (Number(b.size_bytes) || 0);
        case "created_desc":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return sorted;
  }, [docs, activeCat, sortBy]);

  // Global Ctrl/Cmd+K to focus search; Escape to clear
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && searchActive) {
        setRawQuery("");
        searchState.clearFilters();
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchActive, setRawQuery, searchState]);
  void searchQuery;

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    const byId = new Map(allCategories.map((c) => [c.id, c]));
    docs.forEach((d) => {
      let cur = byId.get(d.category);
      let depth = 0;
      while (cur && depth < 64) {
        map[cur.id] = (map[cur.id] ?? 0) + 1;
        if (!cur.parentCatId) break;
        cur = byId.get(cur.parentCatId);
        depth++;
      }
    });
    return map;
  }, [docs, allCategories]);

  const handleDelete = async (doc: DocumentRow) => {
    if (!canUpload) {
      toast.error("Csak olvasási hozzáférés", { description: "Rendezd a fizetést." });
      return;
    }
    const baseDate = doc.document_date ?? doc.created_at;
    const deadline = getRetentionDeadline(doc.category, baseDate);
    const expired = deadline && deadline.getTime() < Date.now();
    const inGrace = isInGracePeriod(doc.created_at);
    if (isStrict(doc.category) && !expired && !inGrace) {
      void logAudit("delete_blocked", doc.id, { reason: "strict" });
      toast.error("Törvényi megőrzés alatt", { description: "Törvényileg védett iratok nem törölhetők." });
      return;
    }
    const confirmMsg = expired
      ? `Ez a dokumentum megőrzési ideje lejárt (${formatDeadline(deadline!)}). Biztosan törli?`
      : `Biztosan törlöd?\n${doc.filename}`;
    if (!confirm(confirmMsg)) return;
    try {
      // Write the audit log BEFORE deleting so the document row (FK target)
      // still exists when the audit_log row is inserted.
      await logAudit("delete", doc.id, {
        filename: doc.filename,
        expired: !!expired,
        ...(inGrace ? { within_grace: true, note: GRACE_AUDIT_NOTE } : {}),
      });
      await supabase.storage.from("documents").remove([doc.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
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

  // (legacy flat lists kept off — tree view in mobileCatsNav handles all categories)

  const openNewSubfolder = (parentId: string) => {
    setSubfolderParent(parentId);
    setNewCatOpen(true);
    setMobileCatsOpen(false);
  };

  const mobileCatsNav = (
    <>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <button
          onClick={() => { setActiveCat(null); setMobileCatsOpen(false); }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeCat === null ? "bg-brand text-brand-foreground" : "hover:bg-muted"}`}
        >
          <span className="flex items-center gap-2"><FileIcon className="h-4 w-4" /> Összes</span>
          <span className="text-xs text-muted-foreground">{docs.length}</span>
        </button>

        <SectionHeader title="Kategóriák" />
        <CategoryTree
          allCats={allCats}
          counts={counts}
          activeCat={activeCat}
          onSelect={(id) => { setActiveCat(id); setMobileCatsOpen(false); }}
          onAddSub={openNewSubfolder}
          onDelete={handleDeleteCustomCat}
          onMoveFolder={(id) => { setMoveFolderId(id); setMobileCatsOpen(false); }}
          onRenameFolder={(id) => { setRenameFolderId(id); setMobileCatsOpen(false); }}
        />

        <SharedWithMeSidebar
          activeCat={activeCat}
          onSelect={(id) => { setActiveCat(id); setMobileCatsOpen(false); }}
        />

        <button
          onClick={() => { setSubfolderParent(null); setNewCatOpen(true); setMobileCatsOpen(false); }}
          className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" /> Új kategória
        </button>
      </nav>
    </>
  );

  const desktopSidebarNav = (
    <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
      <button
        onClick={() => { setActiveCat(null); setSearch(""); }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeCat === null && !search.trim() ? "bg-brand text-brand-foreground" : "hover:bg-muted"}`}
      >
        <Home className="h-4 w-4" /> Kezdőlap
      </button>

      <SectionHeader title="Kategóriák" />
      <CategoryTree
        allCats={allCats}
        counts={counts}
        activeCat={activeCat}
        onSelect={(id) => { setActiveCat(id); setSearch(""); }}
        onAddSub={openNewSubfolder}
        onDelete={handleDeleteCustomCat}
        onMoveFolder={(id) => setMoveFolderId(id)}
        onRenameFolder={(id) => setRenameFolderId(id)}
      />
      <button
        onClick={() => { setSubfolderParent(null); setNewCatOpen(true); }}
        className="w-full mt-1 mb-2 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Új kategória
      </button>

      <SharedWithMeSidebar
        activeCat={activeCat}
        onSelect={(id) => { setActiveCat(id); setSearch(""); }}
      />

      <Link
        to="/profile"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      >
        <UserCog className="h-4 w-4" /> Profil & Beállítások
      </Link>
      <Link
        to="/scan-guide"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      >
        <Camera className="h-4 w-4" /> Hogyan szkennelj
      </Link>
      <a
        href="/sugo"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      >
        <BookOpen className="h-4 w-4" /> Súgó
      </a>
      <Link
        to="/sharing"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      >
        <Users className="h-4 w-4" /> Hozzáférés megosztása
      </Link>
      <Link
        to="/referral"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      >
        <Gift className="h-4 w-4 text-brand" /> Partneri program
      </Link>
      <Link
        to="/subscription"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      >
        <CreditCard className="h-4 w-4" /> Csomagok és árak
      </Link>
      {subscription?.plan === "vallalati" && (
        <Link
          to="/profile"
          hash="nav"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
        >
          <Plug className="h-4 w-4" /> NAV számlaadatok importálása
        </Link>
      )}
      <Link
        to="/audit"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      >
        <ClipboardList className="h-4 w-4" /> Audit napló
      </Link>
      <Link
        to="/kapcsolat"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      >
        <Mail className="h-4 w-4" /> Kapcsolat
      </Link>
      {userEmail === "lenard.csaba74@gmail.com" && (
        <Link
          to="/admin"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
        >
          <Shield className="h-4 w-4" /> Admin
        </Link>
      )}
      <button
        onClick={signOut}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors text-left"
      >
        <LogOut className="h-4 w-4" /> Kijelentkezés
      </button>
    </nav>
  );



  const profilePanel = (
    <div className="p-3 space-y-2">
      <Link to="/profile" onClick={() => setMobileProfileOpen(false)} className="block">
        <Button variant="outline" size="sm" className="w-full">
          <UserCog className="h-3.5 w-3.5 mr-2" /> Profil & Beállítások
        </Button>
      </Link>
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
    <div className="min-h-screen flex flex-col bg-background">
      <TrialBanner />
      <div className="flex flex-1 min-h-0">
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
        {desktopSidebarNav}
        <div className="border-t">{profilePanel}</div>
        <div className="border-t px-4 py-3 space-y-1 text-xs text-muted-foreground">
          <a href="mailto:kapcsolat@archivai.hu" className="block hover:text-brand truncate">
            kapcsolat@archivai.hu
          </a>
          <a href="tel:+36205590559" className="block hover:text-brand">
            06 20 559-0-559
          </a>
          <div className="flex gap-3 pt-1">
            <Link to="/aszf" className="hover:text-brand">ÁSZF</Link>
            <Link to="/adatkezeles" className="hover:text-brand">Adatkezelés</Link>
          </div>
        </div>
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
              placeholder="Keresés... (Ctrl+K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              className="pl-9 pr-16 h-10 bg-background"
            />
            {searchState.isSearching ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">⌘K</kbd>
            )}
            {searchFocused && !search.trim() && (
              <SearchHistoryDropdown
                history={searchState.history}
                onPick={(q) => { setSearch(q); searchRef.current?.focus(); }}
                onClear={searchState.clearHistory}
              />
            )}
          </div>
          <Button onClick={() => searchRef.current?.focus()} variant="default" size="sm">
            <Search className="h-4 w-4 mr-1" /> Keresés
          </Button>
          {search.trim() && (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
              <X className="h-4 w-4 mr-1" /> Bezár
            </Button>
          )}
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
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              className="pl-12 pr-10 h-12 bg-background border-border rounded-xl text-base"
            />
            {searchState.isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
            )}
            {searchFocused && !search.trim() && (
              <SearchHistoryDropdown
                history={searchState.history}
                onPick={(q) => { setSearch(q); searchRef.current?.focus(); }}
                onClear={searchState.clearHistory}
              />
            )}
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
          {searchActive ? (
            <SearchPanel
              query={searchState.query}
              isSearching={searchState.isSearching}
              results={searchState.results}
              grouped={searchState.grouped}
              filters={searchState.filters}
              setFilters={searchState.setFilters}
              clearFilters={searchState.clearFilters}
              hasActiveFilters={searchState.hasActiveFilters}
              allCats={allCats}
              onOpenDoc={(d) => setPreviewDoc(d)}
              onSuggestQuery={(q) => setRawQuery(q)}
            />
          ) : (<>
          {/* Header / Breadcrumb — desktop only */}
          <div className="hidden md:block">
            {activeCat ? (
              <div className="space-y-3">
                <button
                  onClick={() => setActiveCat(null)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Vissza a kategóriákhoz
                </button>
                <nav className="text-sm text-muted-foreground">
                  <button onClick={() => setActiveCat(null)} className="hover:text-foreground transition-colors">
                    Összes
                  </button>
                  <span className="mx-2">→</span>
                  <span className="text-foreground font-medium">{getCategory(activeCat).label}</span>
                </nav>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{getCategory(activeCat).label}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {filtered.length} dokumentum{search.trim() && ` — találat: "${search}"`}
                    </p>
                  </div>
                  {(() => {
                    const cat = getCategory(activeCat);
                    if (cat.custom && !cat.isSystem && cat.parentCatId) {
                      return (
                        <Button variant="outline" size="sm" onClick={() => setMoveFolderId(activeCat)}>
                          <ArrowRightLeft className="h-4 w-4 mr-1.5" /> Mappa áthelyezése
                        </Button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            ) : search.trim() ? (
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Keresési eredmények</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {filtered.length} találat — "{search}"
                </p>
              </div>
            ) : null}
          </div>

          {/* Subfolder chips — direct children of active category. Acts as drop target. */}
          {activeCat && !search.trim() && (
            <SubfolderChips
              parentId={activeCat}
              all={allCats}
              counts={counts}
              onOpen={(id) => setActiveCat(id)}
              onDropDocs={(target, ids) => void moveDocsTo(target, ids)}
              onRename={(id) => setRenameFolderId(id)}
              onMove={(id) => setMoveFolderId(id)}
              onDelete={(id) => void handleDeleteCustomCat(id)}
            />
          )}



          {/* Dedicated Archivai inbox email — Pro/Vállalati only (trialing users get preview) */}
          {!activeCat && !search.trim() && (() => {
            const plan = subscription?.plan ?? null;
            const hasEmailFeature = plan === "pro" || plan === "vallalati" || isTrialing;
            if (!hasEmailFeature) {
              return (
                <div className="rounded-xl border bg-muted/40 p-4 md:p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold tracking-tight text-sm md:text-base">
                        Dedikált Archivai e-mail cím
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1">
                        Egyedi e-mail címére érkező dokumentumok automatikusan bekerülnek az Archivai rendszerbe és elérhetők a Beérkezett mappában — ahol könnyedén rendszerezheti őket.
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground mt-2">
                        Ez a funkció Pro csomagtól érhető el.
                      </p>
                      <div className="mt-3">
                        <Button asChild size="sm">
                          <Link to="/subscription">
                            <Sparkles className="h-4 w-4 mr-1.5" />
                            Csomag váltása
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            if (!archivaiFullEmail) return null;
            return (
              <div
                className="rounded-xl border p-4 md:p-5 text-white shadow-sm"
                style={{ backgroundColor: "#1A2B4A", borderColor: "#1A2B4A" }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold tracking-tight text-sm md:text-base">
                      Az Ön dedikált Archivai e-mail címe
                    </h3>
                    <p className="text-xs md:text-sm text-white/70 mt-1">
                      Küldje erre a címre dokumentumait és azok automatikusan bekerülnek az Archivai-ba.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <code className="px-3 py-1.5 rounded-md bg-white/10 text-white text-xs md:text-sm font-mono break-all">
                        {archivaiFullEmail}
                      </code>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={copyArchivaiEmail}
                        className="bg-white text-[#1A2B4A] hover:bg-white/90"
                      >
                        {archivaiEmailCopied ? (
                          <><Check className="h-4 w-4 mr-1.5" /> Kimásolva</>
                        ) : (
                          <><Copy className="h-4 w-4 mr-1.5" /> Másolás</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Plan usage — monthly docs & storage */}
          {!activeCat && !search.trim() && (() => {
            const plan = subscription?.plan ?? null;
            const docCap = documentCap(plan, isTrialing);
            const storCap = storageCap(plan, isTrialing);
            const now = new Date();
            const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const monthlyCount = docs.filter((d) => new Date(d.created_at).getTime() >= startMonth).length;
            const usedBytes = docs.reduce((s, d) => s + (Number(d.size_bytes) || 0), 0);
            const fmtBytes = (b: number) => {
              if (b < 1024) return `${b} B`;
              if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
              if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
              return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
            };
            const fmtCap = (b: number | null) => (b === null ? "∞" : b >= 1024 * 1024 * 1024 ? `${Math.round(b / 1024 / 1024 / 1024)} GB` : `${Math.round(b / 1024 / 1024)} MB`);
            const docPct = docCap === null ? 0 : Math.min(100, (monthlyCount / docCap) * 100);
            const storPct = storCap === null ? 0 : Math.min(100, (usedBytes / storCap) * 100);
            return (
              <div className="rounded-xl border bg-card p-4 md:p-5 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Havi dokumentumok</span>
                    <span className="text-muted-foreground">{monthlyCount} / {docCap ?? "∞"} feltöltve</span>
                  </div>
                  <Progress value={docPct} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Tárhely</span>
                    <span className="text-muted-foreground">{fmtBytes(usedBytes)} / {fmtCap(storCap)} használva</span>
                  </div>
                  <Progress value={storPct} />
                </div>
              </div>
            );
          })()}


          {!activeCat && !search.trim() && (
            <MobileHome
              docs={docs}
              counts={counts}
              allCats={allCats}
              onOpenCategory={(id) => setActiveCat(id)}
              onOpenDoc={(d) => setPreviewDoc(d)}
              onNewCategory={() => setNewCatOpen(true)}
              onDeleteCustomCat={handleDeleteCustomCat}
            />
          )}

          {/* Desktop category grid — only when no activeCat & no search */}
          {!activeCat && !search.trim() && (
            <div className="hidden md:block space-y-6">
              <div className="flex items-stretch gap-3">
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
                <Button onClick={() => canUpload && openUploadWith(null)} disabled={!canUpload} size="lg">
                  <Upload className="h-4 w-4 mr-2" /> Feltöltés
                </Button>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Kategóriák</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Válassz egy kategóriát a dokumentumok megtekintéséhez
                </p>
              </div>
              <CategoryGrid
                allCats={allCats}
                counts={counts}
                onOpen={(id) => setActiveCat(id)}
                onNewCategory={() => setNewCatOpen(true)}
                onNewSubfolder={openNewSubfolder}
                onDeleteCustomCat={handleDeleteCustomCat}
              />
              <SharedWithMeSection onOpen={(id) => setActiveCat(id)} />
            </div>
          )}



          {/* Document list: desktop when activeCat or search; mobile when filter/search active */}
          <div className={(!activeCat && !search.trim()) ? "hidden" : "space-y-6"}>
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
                {activeCat && (
                  <Button variant="outline" size="lg" onClick={() => openNewSubfolder(activeCat)}>
                    <FolderPlus className="h-4 w-4 mr-2" /> Új almappa
                  </Button>
                )}
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
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  onClick={() => {
                    if (selectionMode) {
                      setSelectedDocs(new Set());
                      setSelectionMode(false);
                    } else {
                      setSelectionMode(true);
                    }
                  }}
                >
                  {selectionMode ? (
                    <><X className="h-4 w-4 mr-2" /> Mégse</>
                  ) : (
                    <><CheckSquare className="h-4 w-4 mr-2" /> Kijelölés</>
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      {sortBy === "created_desc" && "Legújabb elöl"}
                      {sortBy === "created_asc" && "Legrégebbi elöl"}
                      {sortBy === "name_asc" && "Név (A-Z)"}
                      {sortBy === "name_desc" && "Név (Z-A)"}
                      {sortBy === "size_desc" && "Méret (legnagyobb)"}
                      {sortBy === "size_asc" && "Méret (legkisebb)"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuCheckboxItem checked={sortBy === "created_desc"} onCheckedChange={() => setSortBy("created_desc")}>Legújabb elöl</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={sortBy === "created_asc"} onCheckedChange={() => setSortBy("created_asc")}>Legrégebbi elöl</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={sortBy === "name_asc"} onCheckedChange={() => setSortBy("name_asc")}>Név (A-Z)</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={sortBy === "name_desc"} onCheckedChange={() => setSortBy("name_desc")}>Név (Z-A)</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={sortBy === "size_desc"} onCheckedChange={() => setSortBy("size_desc")}>Méret (legnagyobb elöl)</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={sortBy === "size_asc"} onCheckedChange={() => setSortBy("size_asc")}>Méret (legkisebb elöl)</DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ScanButton disabled={!canUpload} onFilesReady={(f) => openUploadWith(f)} />
                {activeCat && (
                  <Button variant="outline" onClick={() => openNewSubfolder(activeCat)}>
                    <FolderPlus className="h-4 w-4 mr-2" /> Új almappa
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((doc) => {
                const cat = getCategory(doc.category);
                const strict = cat.mode === "strict";
                const baseDate = doc.document_date ?? doc.created_at;
                const deadline = getRetentionDeadline(doc.category, baseDate);
                const expired = !!(deadline && deadline.getTime() < Date.now());
                const graceStart = doc.category_changed_at ?? doc.created_at;
                const canDelete = canUpload && (!strict || expired || isInGracePeriod(graceStart));
                const isSelected = selectedDocs.has(doc.id);
                const dragIds = isSelected && selectedDocs.size > 1
                  ? Array.from(selectedDocs)
                  : [doc.id];
                return (
                  <DocumentHoverPreview key={doc.id} doc={doc}>
                    <DocumentCard
                      doc={doc}
                      category={cat}
                      strict={strict}
                      canDelete={canDelete}
                      selectable
                      selectionMode={selectionMode}
                      isSelected={isSelected}
                      onSelect={(id) => toggleDocSelected(id)}
                      draggableIds={dragIds}
                      onOpen={() => setPreviewDoc(doc)}
                      onDelete={() => handleDelete(doc)}
                      onRenamed={(updated: DocumentRow) => {
                        setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
                      }}
                      onMoved={(updated: DocumentRow) => {
                        setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
                      }}
                    />
                  </DocumentHoverPreview>
                );
              })}
            </div>
            </>
          )}
          </div>
          </>)}
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
          {mobileCatsNav}
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
        onPrev={(() => {
          if (!previewDoc) return undefined;
          const idx = filtered.findIndex((d) => d.id === previewDoc.id);
          if (idx > 0) return () => setPreviewDoc(filtered[idx - 1]);
          return undefined;
        })()}
        onNext={(() => {
          if (!previewDoc) return undefined;
          const idx = filtered.findIndex((d) => d.id === previewDoc.id);
          if (idx >= 0 && idx < filtered.length - 1) return () => setPreviewDoc(filtered[idx + 1]);
          return undefined;
        })()}
      />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={(v) => { setUploadOpen(v); if (!v) setPendingFiles(null); }}
        onComplete={loadDocs}
        initialFiles={pendingFiles}
      />
      <CustomCategoryDialog
        open={newCatOpen}
        onOpenChange={(v) => { setNewCatOpen(v); if (!v) setSubfolderParent(null); }}
        parentCatId={subfolderParent}
      />
      {selectedDocs.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 flex items-center gap-3 rounded-full border bg-card/95 backdrop-blur shadow-xl px-4 py-2.5 animate-in fade-in slide-in-from-bottom-2">
          <span className="text-sm font-medium">
            {selectedDocs.size} dokumentum kijelölve
          </span>
          <div className="h-5 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={() => setSelectedDocs(new Set())} disabled={bulkDownloading}>
            Kijelölés törlése
          </Button>
          <Button size="sm" variant="outline" onClick={async () => {
            if (bulkDownloading) return;
            const selected = docs.filter((d) => selectedDocs.has(d.id));
            if (selected.length === 0) return;
            setBulkDownloading(true);
            try {
              const { default: JSZip } = await import("jszip");
              const { getSignedUrl } = await import("@/lib/signed-url");
              const zip = new JSZip();
              const used = new Set<string>();
              await Promise.all(selected.map(async (d) => {
                const url = await getSignedUrl(d.storage_path, 600);
                if (!url) return;
                const res = await fetch(url);
                const blob = await res.blob();
                let name = d.original_filename || d.filename;
                let n = name; let i = 1;
                while (used.has(n)) {
                  const dot = name.lastIndexOf(".");
                  n = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`;
                  i++;
                }
                used.add(n);
                zip.file(n, blob);
                void logAudit("download", d.id, { filename: d.filename, bulk: true });
              }));
              const blob = await zip.generateAsync({ type: "blob" });
              const catLabel = activeCat ? getCategory(activeCat).label : "vegyes";
              const safeCat = catLabel.replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ_-]+/g, "_");
              const date = new Date().toISOString().slice(0, 10);
              const a = document.createElement("a");
              const objUrl = URL.createObjectURL(blob);
              a.href = objUrl;
              a.download = `Archivai_${safeCat}_${date}.zip`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(objUrl);
              toast.success(`${selected.length} dokumentum letöltve`);
            } catch (e: unknown) {
              toast.error("Letöltés sikertelen", { description: e instanceof Error ? e.message : String(e) });
            } finally {
              setBulkDownloading(false);
            }
          }} disabled={bulkDownloading}>
            {bulkDownloading ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Csomagolás…</>
            ) : (
              <><Download className="h-4 w-4 mr-1.5" /> Letöltés</>
            )}
          </Button>
          <Button size="sm" onClick={() => setBulkMoveOpen(true)} disabled={bulkDownloading}>
            <ArrowRightLeft className="h-4 w-4 mr-1.5" /> Áthelyezés
          </Button>
        </div>
      )}
      <BulkMoveDialog
        open={bulkMoveOpen}
        onOpenChange={setBulkMoveOpen}
        docs={docs.filter((d) => selectedDocs.has(d.id))}
        onMoved={(ids, target) => {
          setDocs((prev) =>
            prev.map((d) => (ids.includes(d.id) ? { ...d, category: target } : d)),
          );
          setSelectedDocs(new Set());
        }}
      />
      <MoveFolderDialog
        open={moveFolderId !== null}
        onOpenChange={(v) => { if (!v) setMoveFolderId(null); }}
        folderId={moveFolderId}
        onMoved={() => { void loadDocs(); }}
      />
      <RenameFolderDialog
        open={renameFolderId !== null}
        onOpenChange={(v) => { if (!v) setRenameFolderId(null); }}
        folderId={renameFolderId}
      />

      </div>
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
        Húzza ide a fájlokat vagy kattintson a feltöltéshez
      </p>
      {large && (
        <p className="text-xs text-muted-foreground mt-2">
          PDF, DOCX, XLSX, JPG, PNG — max 50 MB
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

// Category stripe colors (left border + icon tint)
const MOBILE_CAT_COLORS: Record<string, string> = {
  szamlak: "#C17B2F",
  szerzodesek: "#1A2B4A",
  szallitolevek: "#0F6E56",
  munkaugyi: "#5B3A8C",
  adobevallasok: "#8B1A1A",
  kozuzemi: "#2B4B7A",
  banki: "#0D5F6B",
  muszaki: "#5F5E5A",
  belso: "#4A7A9B",
  egyeb: "#A8A49E",
};

const BUILTIN_ORDER = [
  "beerkezett",
  "szamlak", "szerzodesek", "szallitolevek", "munkaugyi", "adobevallasok",
  "kozuzemi", "banki", "muszaki", "belso", "egyeb",
];

function sortCategories(cats: Category[]): Category[] {
  const builtIns = cats.filter((c) => !c.custom);
  const customs = cats.filter((c) => c.custom);
  const ordered = [...BUILTIN_ORDER]
    .map((id) => builtIns.find((c) => c.id === id))
    .filter((c): c is Category => !!c);
  const rest = builtIns.filter((c) => !BUILTIN_ORDER.includes(c.id));
  return [...ordered, ...rest, ...customs];
}

type MobileHomeProps = {
  docs: DocumentRow[];
  counts: Record<string, number>;
  allCats: Category[];
  onOpenCategory: (id: string) => void;
  onOpenDoc: (d: DocumentRow) => void;
  onNewCategory: () => void;
  onDeleteCustomCat: (catId: string) => void | Promise<void>;
};

function MobileHome({ docs, counts, allCats, onOpenCategory, onOpenDoc, onNewCategory, onDeleteCustomCat }: MobileHomeProps) {
  const recent = docs.slice(0, 3);
  const total = docs.length;

  return (
    <div className="md:hidden space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-3xl font-bold text-brand leading-none">{total}</div>
          <div className="text-xs text-muted-foreground mt-2">Összes dokumentum</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-lock">
            <ShieldCheck className="h-4 w-4" /> Törvényi védelem
          </div>
          <div className="text-xs text-muted-foreground mt-2">Integritás: 100%</div>
        </div>
      </div>

      {/* Inbox banner */}
      {(() => {
        const inbox = allCats.find((c) => c.id === "beerkezett");
        if (!inbox) return null;
        const inboxCount = counts[inbox.id] ?? 0;
        const hasInboxDocs = inboxCount > 0;
        const InboxIcon = inbox.icon;
        return (
          <button
            onClick={() => onOpenCategory(inbox.id)}
            className={`w-full text-left rounded-xl flex items-center gap-3 transition-all ${
              hasInboxDocs
                ? "bg-[#F59E0B] active:bg-[#D97706] text-white p-4 shadow-md ring-1 ring-amber-600/30"
                : "bg-amber-50 active:bg-amber-100 text-amber-900 p-3 border border-amber-200/70"
            }`}
          >
            <div className={`rounded-lg flex items-center justify-center shrink-0 ${hasInboxDocs ? "h-12 w-12 bg-white/20" : "h-9 w-9 bg-amber-200/60"}`}>
              <InboxIcon className={hasInboxDocs ? "h-6 w-6" : "h-4 w-4"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-bold truncate ${hasInboxDocs ? "text-lg" : "text-sm"}`}>{inbox.label}</div>
              <div className={`truncate ${hasInboxDocs ? "text-xs text-white/90" : "text-[11px] text-amber-800/80"}`}>
                Rendszerezésre váró dokumentumok
              </div>
            </div>
            {hasInboxDocs ? (
              <div className="rounded-full bg-white text-[#B45309] font-extrabold tabular-nums px-3 py-1.5 text-xl shadow-sm min-w-[44px] text-center shrink-0">
                {inboxCount}
              </div>
            ) : (
              <span className="text-sm tabular-nums text-amber-800/70 shrink-0">0</span>
            )}
          </button>
        );
      })()}

      {/* Categories list */}
      <div>
        <h3 className="text-sm font-semibold text-brand px-1 mb-2">Kategóriák</h3>
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {allCats.filter((c) => c.id !== "beerkezett" && !c.parentCatId).map((cat) => {
            const strict = cat.mode === "strict";
            const color = cat.color ?? MOBILE_CAT_COLORS[cat.id] ?? "#9CA3AF";
            const count = counts[cat.id] ?? 0;
            const retentionText = cat.retentionYears
              ? `Megőrzés: ${cat.retentionYears} év`
              : strict
              ? "Határozatlan megőrzés"
              : "Szabad tárolás";
            return (
              <div key={cat.id} className="relative flex items-center">
                <button
                  onClick={() => onOpenCategory(cat.id)}
                  className="flex-1 min-h-[60px] flex items-center gap-3 px-4 py-3 text-left active:bg-muted transition-colors"
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-brand truncate">{cat.label}</span>
                      {strict && <Lock className="h-3.5 w-3.5 text-lock shrink-0" />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{retentionText}</div>
                  </div>
                  <span className="text-base font-bold text-brand tabular-nums">{count}</span>
                  {!cat.custom && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
                {cat.custom && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteCustomCat(cat.id); }}
                    className="px-3 py-3 text-muted-foreground hover:text-destructive"
                    aria-label="Kategória törlése"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={onNewCategory}
            className="w-full min-h-[52px] flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-brand active:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" /> Új kategória
          </button>
        </div>
      </div>


      {/* Recent uploads */}
      {recent.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-brand px-1 mb-2">Legutóbbi feltöltések</h3>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {recent.map((doc) => {
              const cat = allCats.find((c) => c.id === doc.category);
              const date = new Date(doc.created_at).toLocaleDateString("hu-HU", {
                year: "numeric", month: "short", day: "numeric",
              });
              return (
                <button
                  key={doc.id}
                  onClick={() => onOpenDoc(doc)}
                  className="w-full min-h-[60px] flex items-center gap-3 px-4 py-3 text-left active:bg-muted transition-colors"
                >
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <FileIcon className="h-4 w-4 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-brand truncate">{doc.filename}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {cat && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-soft text-brand font-medium truncate max-w-[140px]">
                          {cat.label}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">{date}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type CategoryGridProps = {
  allCats: Category[];
  counts: Record<string, number>;
  onOpen: (id: string) => void;
  onNewCategory: () => void;
  onNewSubfolder: (parentId: string) => void;
  onDeleteCustomCat: (catId: string) => void | Promise<void>;
};

function CategoryGrid({ allCats, counts, onOpen, onNewCategory, onNewSubfolder, onDeleteCustomCat }: CategoryGridProps) {
  const ordered = sortCategories(allCats);
  const inbox = ordered.find((c) => c.id === "beerkezett");
  const rest = ordered.filter((c) => c.id !== "beerkezett" && !c.parentCatId);
  const inboxCount = inbox ? counts[inbox.id] ?? 0 : 0;
  const hasInboxDocs = inboxCount > 0;

  return (
    <div className="space-y-3">
      {inbox && (
        <button
          onClick={() => onOpen(inbox.id)}
          className={`w-full text-left rounded-xl flex items-center gap-4 transition-all ${
            hasInboxDocs
              ? "bg-[#F59E0B] hover:bg-[#D97706] text-white p-5 md:p-6 shadow-md hover:shadow-lg ring-1 ring-amber-600/30"
              : "bg-amber-50 hover:bg-amber-100 text-amber-900 p-3.5 md:p-4 border border-amber-200/70"
          }`}
        >
          <div
            className={`rounded-lg flex items-center justify-center shrink-0 ${
              hasInboxDocs ? "h-14 w-14 bg-white/20" : "h-10 w-10 bg-amber-200/60"
            }`}
          >
            <inbox.icon className={hasInboxDocs ? "h-7 w-7" : "h-5 w-5"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-bold truncate ${hasInboxDocs ? "text-xl md:text-2xl" : "text-base"}`}>
              {inbox.label}
            </div>
            <div className={`truncate ${hasInboxDocs ? "text-sm text-white/90 mt-0.5" : "text-xs text-amber-800/80 mt-0.5"}`}>
              Rendszerezésre váró dokumentumok
            </div>
          </div>
          {hasInboxDocs ? (
            <div className="flex items-center gap-3 shrink-0">
              <div className="rounded-full bg-white text-[#B45309] font-extrabold tabular-nums px-4 py-2 text-2xl md:text-3xl shadow-sm min-w-[56px] text-center">
                {inboxCount}
              </div>
              <ChevronRight className="h-6 w-6 text-white/90" />
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0 text-amber-800/70">
              <span className="text-sm tabular-nums">0</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          )}
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rest.map((cat) => {
          const strict = cat.mode === "strict";
          const color = cat.color ?? MOBILE_CAT_COLORS[cat.id] ?? "#9CA3AF";
          const count = counts[cat.id] ?? 0;
          const retentionText = cat.retentionYears
            ? `Megőrzés: ${cat.retentionYears} év`
            : strict
            ? "Határozatlan megőrzés"
            : "Szabad tárolás";
          const Icon = cat.icon;
          return (
            <div key={cat.id} className="relative group bg-white rounded-md border border-border/40 overflow-hidden transition-all hover:shadow-md hover:border-border/70" style={{ borderLeft: `5px solid ${color}` }}>
              <button
                onClick={() => onOpen(cat.id)}
                className="w-full text-left pl-4 pr-4 py-3 min-h-[90px] flex items-center gap-3"
              >
                <div
                  className="h-10 w-10 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${color}14`, color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px] text-brand truncate">{cat.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {count} dokumentum
                  </div>
                  <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
                    {retentionText}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {strict && <Lock className="h-4 w-4 text-[#0F6E56]" />}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
              <div className="border-t border-border/40 px-3 py-1.5 flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); onNewSubfolder(cat.id); }}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/60"
                  aria-label="Új almappa"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>Új almappa</span>
                </button>
              </div>
              {cat.custom && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteCustomCat(cat.id); }}
                  className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-destructive transition-opacity"
                  aria-label="Kategória törlése"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={onNewCategory}
          className="rounded-md border border-dashed border-border bg-muted/20 min-h-[90px] flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-border transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">Új kategória</span>
        </button>
      </div>
    </div>
  );
}


