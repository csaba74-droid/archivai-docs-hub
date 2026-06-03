import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase, type AuditLogRow, type DocumentRow } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Download, ClipboardList, Loader2 } from "lucide-react";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/audit")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuditPage,
});

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  upload: "📤 Feltöltés",
  view: "👁 Megtekintés",
  download: "⬇️ Letöltés",
  delete: "🗑 Törlés",
  delete_blocked: "🔒 Törlés megtagadva",
  search: "🔍 Keresés",
  categorize: "🤖 Kategorizálás",
};

const ACTION_PLAIN: Record<string, string> = {
  upload: "Feltöltés",
  view: "Megtekintés",
  download: "Letöltés",
  delete: "Törlés",
  delete_blocked: "Törlés megtagadva",
  search: "Keresés",
  categorize: "Kategorizálás",
};

const CATEGORY_LABELS: Record<string, string> = {
  szamlak: "Számlák",
  szerzodesek: "Szerződések",
  szallitolevelek: "Szállítólevelek",
  szallitolevek: "Szállítólevelek",
  munkaugyi_iratok: "Munkaügyi iratok",
  adobevallesok: "Adóbevallások",
  kozuzemi_szamlak: "Közüzemi számlák",
  banki_dokumentumok: "Banki dokumentumok",
  muszaki_dokumentumok: "Műszaki dokumentumok",
  belso_iratok: "Belső iratok",
  egyeb: "Egyéb",
};

const META_KEY_LABELS: Record<string, string> = {
  category: "Kategória",
  filename: "Fájlnév",
  original_filename: "Eredeti fájlnév",
  confidence: "Bizonyosság",
  ai_confidence: "Bizonyosság",
  size_bytes: "Méret",
  mime_type: "Típus",
  query: "Keresés",
  reason: "Indok",
  document_date: "Dokumentum dátuma",
};

function formatMetaValue(key: string, value: unknown): string {
  if (value == null) return "";
  if (key === "category" && typeof value === "string") {
    if (value.startsWith("custom:")) return "Egyéni kategória";
    return CATEGORY_LABELS[value] ?? value;
  }
  if ((key === "confidence" || key === "ai_confidence") && typeof value === "number") {
    return `${Math.round(value * 100)}%`;
  }
  if (key === "size_bytes" && typeof value === "number") {
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    if (value >= 1024) return `${Math.round(value / 1024)} KB`;
    return `${value} B`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatMetaReadable(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v == null || v === "") continue;
    const label = META_KEY_LABELS[k] ?? k;
    parts.push(`${label}: ${formatMetaValue(k, v)}`);
  }
  return parts.join(" | ");
}

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Összes művelet" },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
];

function formatHu(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

type Row = AuditLogRow & { filename?: string | null };
type ActorInfo = { full_name: string | null; email: string | null };

function AuditPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [docsMap, setDocsMap] = useState<Record<string, DocumentRow>>({});
  const [actorsMap, setActorsMap] = useState<Record<string, ActorInfo>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("audit_log").select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (fromDate) q = q.gte("created_at", new Date(fromDate).toISOString());
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }
    if (actionFilter !== "all") q = q.eq("action", actionFilter);

    const { data, error } = await q;
    if (error) {
      toast.error("Betöltési hiba", { description: error.message });
      setLoading(false);
      return;
    }
    const list = (data ?? []) as AuditLogRow[];
    setHasMore(list.length === PAGE_SIZE);

    const docIds = Array.from(new Set(list.map((r) => r.document_id).filter(Boolean) as string[]));
    if (docIds.length > 0) {
      const { data: docs } = await supabase.from("documents").select("*").in("id", docIds);
      const map: Record<string, DocumentRow> = {};
      (docs as DocumentRow[] | null)?.forEach((d) => { map[d.id] = d; });
      setDocsMap((prev) => ({ ...prev, ...map }));
    }
    const actorIds = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean) as string[]));
    if (actorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      const amap: Record<string, ActorInfo> = {};
      (profs as { id: string; full_name: string | null; email: string | null }[] | null)?.forEach((p) => {
        amap[p.id] = { full_name: p.full_name, email: p.email };
      });
      setActorsMap((prev) => ({ ...prev, ...amap }));
    }
    setRows(list);
    setLoading(false);
  }, [page, fromDate, toDate, actionFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const fn = (r.document_id ? docsMap[r.document_id]?.filename : "") ?? "";
      return fn.toLowerCase().includes(q);
    });
  }, [rows, search, docsMap]);

  const exportCsv = async () => {
    let q = supabase.from("audit_log").select("*")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (fromDate) q = q.gte("created_at", new Date(fromDate).toISOString());
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }
    if (actionFilter !== "all") q = q.eq("action", actionFilter);

    const { data, error } = await q;
    if (error) { toast.error("Exportálási hiba", { description: error.message }); return; }
    const list = (data ?? []) as AuditLogRow[];

    const docIds = Array.from(new Set(list.map((r) => r.document_id).filter(Boolean) as string[]));
    let map: Record<string, DocumentRow> = {};
    if (docIds.length > 0) {
      const { data: docs } = await supabase.from("documents").select("id,filename").in("id", docIds);
      (docs as { id: string; filename: string }[] | null)?.forEach((d) => {
        map[d.id] = d as DocumentRow;
      });
    }

    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Dátum", "Művelet", "Dokumentum", "Részletek"];
    const lines = [header.join(",")];
    for (const r of list) {
      const fn = r.document_id ? map[r.document_id]?.filename ?? "" : "";
      const meta = formatMetaReadable(r.metadata);
      lines.push([formatHu(r.created_at), ACTION_PLAIN[r.action] ?? r.action, fn, meta].map(esc).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openDoc = (docId: string | null) => {
    if (!docId) return;
    const d = docsMap[docId];
    if (d) setPreviewDoc(d);
    else toast.info("A dokumentum már nem elérhető");
  };

  const renderMeta = (m: Record<string, unknown> | null) => {
    const text = formatMetaReadable(m);
    if (!text) return <span className="text-muted-foreground">—</span>;
    return <span className="text-xs text-muted-foreground">{text}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton />
          <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">📋 Audit napló</h1>
        </div>
        <Button onClick={exportCsv} size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Exportálás CSV</span><span className="sm:hidden">CSV</span>
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Időszak (-tól)</label>
              <Input type="date" value={fromDate} onChange={(e) => { setPage(0); setFromDate(e.target.value); }} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Időszak (-ig)</label>
              <Input type="date" value={toDate} onChange={(e) => { setPage(0); setToDate(e.target.value); }} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Művelet</label>
              <Select value={actionFilter} onValueChange={(v) => { setPage(0); setActionFilter(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fájlnév keresése</label>
              <Input placeholder="pl. szamla.pdf" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Betöltés…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Még nincs naplóbejegyzés</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Dátum/Idő</th>
                      <th className="px-4 py-2 font-medium">Művelet</th>
                      <th className="px-4 py-2 font-medium">Dokumentum</th>
                      <th className="px-4 py-2 font-medium">Részletek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const doc = r.document_id ? docsMap[r.document_id] : null;
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{formatHu(r.created_at)}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{ACTION_LABELS[r.action] ?? r.action}</td>
                          <td className="px-4 py-2">
                            {doc ? (
                              <button onClick={() => openDoc(r.document_id)} className="text-brand hover:underline text-left">
                                {doc.filename}
                              </button>
                            ) : r.document_id ? (
                              <span className="text-muted-foreground italic">törölt dokumentum</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2">{renderMeta(r.metadata)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y">
                {filtered.map((r) => {
                  const doc = r.document_id ? docsMap[r.document_id] : null;
                  return (
                    <li key={r.id} className="p-4 space-y-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium">{ACTION_LABELS[r.action] ?? r.action}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatHu(r.created_at)}</span>
                      </div>
                      {doc ? (
                        <button onClick={() => openDoc(r.document_id)} className="text-sm text-brand hover:underline text-left block">
                          {doc.filename}
                        </button>
                      ) : r.document_id ? (
                        <p className="text-sm text-muted-foreground italic">törölt dokumentum</p>
                      ) : null}
                      <div>{renderMeta(r.metadata)}</div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Előző oldal
          </Button>
          <span className="text-xs text-muted-foreground">Oldal {page + 1}</span>
          <Button variant="outline" size="sm" disabled={!hasMore || loading}
            onClick={() => setPage((p) => p + 1)}>
            Következő oldal
          </Button>
        </div>

        <div className="text-center">
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:underline">← Vissza az irányítópultra</Link>
        </div>
      </main>

      <DocumentPreviewModal
        doc={previewDoc}
        open={!!previewDoc}
        onOpenChange={(v) => { if (!v) setPreviewDoc(null); }}
        onUpdated={(updated) => {
          setDocsMap((prev) => ({ ...prev, [updated.id]: updated }));
          setPreviewDoc(updated);
        }}
      />
    </div>
  );
}
