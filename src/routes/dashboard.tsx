import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase, type DocumentRow } from "@/lib/supabase";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Archive,
  Search,
  Upload,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  FileIcon,
  Loader2,
} from "lucide-react";

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setDocs(data as DocumentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
    });
    loadDocs();
  }, [loadDocs]);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (activeCat && d.category !== activeCat) return false;
      if (search && !d.filename.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [docs, search, activeCat]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    docs.forEach((d) => (map[d.category] = (map[d.category] ?? 0) + 1));
    return map;
  }, [docs]);

  const inferCategory = (filename: string): string => {
    const f = filename.toLowerCase();
    if (/(invoice|szamla|számla)/.test(f)) return "szamlak";
    if (/(contract|szerzodes|szerződés)/.test(f)) return "szerzodesek";
    if (/(shipping|szallito|szállító)/.test(f)) return "szallitolevek";
    if (/(payroll|munkaugy|munkaügy|hr)/.test(f)) return "munkaugyi";
    if (/(tax|ado|adó)/.test(f)) return "adobevallasok";
    if (/(technical|muszaki|műszaki|spec)/.test(f)) return "muszaki";
    if (/(internal|belso|belső|memo)/.test(f)) return "belso";
    return "egyeb";
  };

  const handleFiles = async (files: FileList | File[]) => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      toast.error("Nincs bejelentkezett felhasználó");
      return;
    }
    setUploading(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const file of Array.from(files)) {
        try {
          const category = inferCategory(file.name);
          const hash = await sha256Hex(file);
          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${user.id}/${Date.now()}-${hash.slice(0, 8)}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("documents")
            .upload(path, file, {
              upsert: false,
              contentType: file.type || "application/octet-stream",
            });
          if (upErr) throw upErr;
          const itm_compliant =
            file.type === "application/pdf" || file.size < 25 * 1024 * 1024;
          const { error: insErr } = await supabase.from("documents").insert({
            user_id: user.id,
            filename: file.name,
            storage_path: path,
            category,
            itm_compliant,
            size_bytes: file.size,
            mime_type: file.type || null,
            sha256: hash,
          });
          if (insErr) throw insErr;
          ok++;
        } catch (e: any) {
          failed++;
          console.error("Upload failed:", file.name, e);
          toast.error(`Hiba: ${file.name}`, { description: e?.message ?? String(e) });
        }
      }
      if (ok > 0) toast.success(`${ok} fájl feltöltve`);
      if (failed === 0 && ok === 0) toast.info("Nem volt feltölthető fájl");
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
              activeCat === null
                ? "bg-brand-soft text-brand"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileIcon className="h-4 w-4" /> Összes dokumentum
            </span>
            <span className="text-xs text-muted-foreground">{docs.length}</span>
          </button>

          <div className="pt-3 pb-1 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Kategóriák
          </div>

          {CATEGORIES.map((cat) => {
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
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" /> {cat.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {counts[cat.id] ?? 0}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <div className="px-2 pb-2 text-xs text-muted-foreground truncate">
            {userEmail}
          </div>
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
              placeholder="Keresés dokumentumok között..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-background"
            />
          </div>
          <label>
            <input
              type="file"
              multiple
              hidden
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <Button asChild>
              <span className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" /> Feltöltés
              </span>
            </Button>
          </label>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {activeCat ? getCategory(activeCat).label : "Összes dokumentum"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} dokumentum
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
                <p className="text-sm">Feltöltés folyamatban...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-brand-soft flex items-center justify-center">
                  <Upload className="h-5 w-5 text-brand" />
                </div>
                <p className="text-sm font-medium">
                  Húzd ide a fájlokat vagy kattints a Feltöltés gombra
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOCX, XLSX, képek — automatikus kategorizálással
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
                const Icon = cat.icon;
                return (
                  <Card
                    key={doc.id}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-brand" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate group-hover:text-brand transition-colors">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(doc.created_at).toLocaleDateString("hu-HU", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {cat.label}
                      </Badge>
                      {doc.itm_compliant ? (
                        <Badge className="text-[10px] font-normal bg-brand text-brand-foreground hover:bg-brand/90 gap-1">
                          <ShieldCheck className="h-3 w-3" /> ITM
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal gap-1 text-muted-foreground"
                        >
                          <ShieldAlert className="h-3 w-3" /> Nem ITM
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
