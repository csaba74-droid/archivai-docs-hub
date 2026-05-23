import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X, FileIcon, Clock, Filter } from "lucide-react";
import type { DocumentRow } from "@/lib/supabase";
import type { Category } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  highlightMatch,
  type SearchHit,
  type SearchFilters,
} from "@/hooks/use-document-search";

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function CategoryDot({ category }: { category: Category }) {
  const color = category.color ?? "#94a3b8";
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const parts = highlightMatch(text, query);
  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className="bg-yellow-200 text-foreground rounded-sm px-0.5">{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export type SearchPanelProps = {
  query: string;
  isSearching: boolean;
  results: SearchHit[];
  grouped: Array<{ category: Category; hits: SearchHit[] }>;
  filters: SearchFilters;
  setFilters: (f: SearchFilters) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  allCats: Category[];
  onOpenDoc: (doc: DocumentRow) => void;
  onSuggestQuery?: (q: string) => void;
};

export function SearchPanel({
  query,
  isSearching,
  results,
  grouped,
  filters,
  setFilters,
  clearFilters,
  hasActiveFilters,
  allCats,
  onOpenDoc,
  onSuggestQuery,
}: SearchPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState<number>(0);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i: number) => Math.min(results.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i: number) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const hit = results[activeIdx];
        if (hit) {
          e.preventDefault();
          onOpenDoc(hit.doc);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [results, activeIdx, onOpenDoc, setActiveIdx]);

  useEffect(() => { setActiveIdx(0); }, [query, filters, setActiveIdx]);

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.categoryId ?? "all"}
          onValueChange={(v) => setFilters({ ...filters, categoryId: v === "all" ? null : v })}
        >
          <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Kategória" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes kategória</SelectItem>
            {allCats.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.itmMode}
          onValueChange={(v) => setFilters({ ...filters, itmMode: v as SearchFilters["itmMode"] })}
        >
          <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden típus</SelectItem>
            <SelectItem value="strict">ITM kötelező</SelectItem>
            <SelectItem value="normal">Normál</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || null })}
            className="h-8 w-[150px]"
            aria-label="Dátumtól"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || null })}
            className="h-8 w-[150px]"
            aria-label="Dátumig"
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 ml-auto">
            <X className="h-3.5 w-3.5 mr-1" /> Szűrők törlése
          </Button>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        {isSearching ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Keresés...</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            <strong className="text-foreground">{results.length}</strong> találat
            {query.trim() && <> erre: <span className="text-foreground">"{query}"</span></>}
          </span>
        )}
      </div>

      {/* Empty state */}
      {!isSearching && results.length === 0 && query.trim() && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-3">
          <Search className="h-10 w-10 text-muted-foreground mx-auto" />
          <div>
            <p className="font-medium">Nincs találat erre: "{query}"</p>
            <p className="text-sm text-muted-foreground mt-1">
              Próbáld rövidebb kifejezéssel, vagy ellenőrizd a szűrőket.
            </p>
          </div>
          {onSuggestQuery && query.length > 3 && (
            <div className="flex justify-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => onSuggestQuery(query.slice(0, Math.max(3, query.length - 2)))}>
                Próbáld: "{query.slice(0, Math.max(3, query.length - 2))}"
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Grouped results */}
      <div ref={listRef} className="space-y-6">
        {grouped.map((group) => (
          <div key={group.category.id} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <CategoryDot category={group.category} />
              <span>{group.category.label}</span>
              <span className="text-xs font-normal normal-case">({group.hits.length})</span>
            </div>
            <div className="space-y-1.5">
              {group.hits.map((hit) => {
                const globalIdx = results.indexOf(hit);
                const active = globalIdx === activeIdx;
                return (
                  <button
                    key={hit.doc.id}
                    onClick={() => onOpenDoc(hit.doc)}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    className={`w-full text-left rounded-lg border bg-card p-3 transition-all flex items-start gap-3 hover:shadow-sm ${
                      active ? "ring-2 ring-primary border-primary" : ""
                    }`}
                    style={{ borderLeft: `4px solid ${hit.category.color ?? "#94a3b8"}` }}
                  >
                    <FileIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          <Highlighted text={hit.doc.filename ?? ""} query={query} />
                        </span>
                        <Badge variant="outline" className="text-xs">{hit.category.label}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDate(hit.doc.document_date ?? hit.doc.created_at)}
                        </span>
                      </div>
                      {hit.excerpt && hit.matchedField !== "filename" && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          <Highlighted text={hit.excerpt} query={query} />
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SearchHistoryDropdown({
  history,
  onPick,
  onClear,
}: {
  history: string[];
  onPick: (q: string) => void;
  onClear: () => void;
}) {
  if (history.length === 0) return null;
  return (
    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border bg-popover shadow-lg p-1 z-30">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> Legutóbbi keresések
        </span>
        <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
          Törlés
        </button>
      </div>
      {history.map((q) => (
        <button
          key={q}
          onClick={() => onPick(q)}
          className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent flex items-center gap-2"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          {q}
        </button>
      ))}
    </div>
  );
}

// Re-import useState properly (the hack above is a workaround for SSR-safe lazy import)
import { useState as _useState } from "react";
