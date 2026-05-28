import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse, { type FuseResult } from "fuse.js";
import type { DocumentRow } from "@/lib/supabase";
import type { Category } from "@/lib/categories";
import { logAudit } from "@/lib/audit";

export type SearchFilters = {
  categoryId: string | null;
  dateFrom: string | null; // yyyy-mm-dd
  dateTo: string | null;
  itmMode: "all" | "strict" | "normal";
};

export const EMPTY_FILTERS: SearchFilters = {
  categoryId: null,
  dateFrom: null,
  dateTo: null,
  itmMode: "all",
};

export type SearchHit = {
  doc: DocumentRow;
  category: Category;
  score: number;
  excerpt: string;
  matchedField: string;
};

const HISTORY_KEY = "archivai:search-history";
const CACHE_TTL_MS = 30_000;
const MAX_RESULTS = 50;

// Strip accents + lowercase for tolerant matching ("szamla" matches "számla")
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type Indexed = {
  doc: DocumentRow;
  category: Category;
  _filename: string;
  _original: string;
  _content: string;
  _notes: string;
  _category: string;
  _date: string;
};

function buildExcerpt(text: string, query: string, len = 140): string {
  if (!text) return "";
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
  if (idx === -1) return text.slice(0, len) + (text.length > len ? "…" : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + nQuery.length + 80);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export function highlightMatch(text: string, query: string): Array<{ text: string; match: boolean }> {
  if (!query.trim() || !text) return [{ text, match: false }];
  const nText = normalize(text);
  const nQuery = normalize(query.trim());
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  let from = 0;
  while ((from = nText.indexOf(nQuery, cursor)) !== -1) {
    if (from > cursor) parts.push({ text: text.slice(cursor, from), match: false });
    parts.push({ text: text.slice(from, from + nQuery.length), match: true });
    cursor = from + nQuery.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 5)));
  } catch {
    /* noop */
  }
}

export function useDocumentSearch(docs: DocumentRow[], allCats: Category[]) {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState(""); // debounced
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [history, setHistory] = useState<string[]>(() => loadHistory());

  // 300ms debounce
  useEffect(() => {
    if (rawQuery === query) return;
    setIsSearching(true);
    const t = setTimeout(() => {
      setQuery(rawQuery);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [rawQuery, query]);

  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    allCats.forEach((c) => m.set(c.id, c));
    return m;
  }, [allCats]);

  const indexed = useMemo<Indexed[]>(() => {
    return docs.map((d) => {
      const cat = catMap.get(d.category) ?? {
        id: d.category,
        label: d.category,
        mode: "normal" as const,
      } as Category;
      return {
        doc: d,
        category: cat,
        _filename: normalize(d.filename ?? ""),
        _original: normalize(d.original_filename ?? ""),
        _content: normalize(d.content_text ?? ""),
        _category: normalize(cat.label),
        _date: d.document_date ?? d.created_at ?? "",
      };
    });
  }, [docs, catMap]);

  const fuse = useMemo(
    () =>
      new Fuse(indexed, {
        keys: [
          { name: "_filename", weight: 0.4 },
          { name: "_original", weight: 0.25 },
          { name: "_category", weight: 0.2 },
          { name: "_content", weight: 0.15 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: 2,
      }),
    [indexed],
  );

  // 30s result cache
  const cacheRef = useRef<Map<string, { ts: number; hits: SearchHit[] }>>(new Map());

  const applyFilters = useCallback(
    (hit: { doc: DocumentRow; category: Category }) => {
      const { doc, category } = hit;
      if (filters.categoryId && doc.category !== filters.categoryId) return false;
      if (filters.itmMode !== "all" && category.mode !== filters.itmMode) return false;
      const d = doc.document_date ?? doc.created_at;
      if (filters.dateFrom && d && d < filters.dateFrom) return false;
      if (filters.dateTo && d && d > filters.dateTo + "T23:59:59") return false;
      return true;
    },
    [filters],
  );

  const results = useMemo<SearchHit[]>(() => {
    const q = query.trim();
    if (!q) {
      // No query: still apply filters (e.g. when only category filter is set)
      const hasFilter =
        filters.categoryId || filters.dateFrom || filters.dateTo || filters.itmMode !== "all";
      if (!hasFilter) return [];
      return indexed
        .filter(applyFilters)
        .slice(0, MAX_RESULTS)
        .map((i) => ({
          doc: i.doc,
          category: i.category,
          score: 0,
          excerpt: "",
          matchedField: "",
        }));
    }

    const cacheKey = `${q}|${filters.categoryId}|${filters.dateFrom}|${filters.dateTo}|${filters.itmMode}|${docs.length}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.hits;

    const nQ = normalize(q);
    const fuseResults: FuseResult<Indexed>[] = fuse.search(nQ, { limit: 200 });

    const hits: SearchHit[] = [];
    for (const r of fuseResults) {
      const item = r.item;
      if (!applyFilters(item)) continue;
      const match = r.matches?.[0];
      let excerpt = "";
      let matchedField = "filename";
      if (match) {
        const key = match.key ?? "_filename";
        matchedField = key.replace(/^_/, "");
        const sourceField =
          key === "_content" ? item.doc.content_text :
          key === "_original" ? item.doc.original_filename :
          key === "_category" ? item.category.label :
          item.doc.filename;
        excerpt = buildExcerpt(sourceField ?? "", q);
      } else {
        excerpt = item.doc.filename ?? "";
      }
      hits.push({
        doc: item.doc,
        category: item.category,
        score: r.score ?? 0,
        excerpt,
        matchedField,
      });
      if (hits.length >= MAX_RESULTS) break;
    }

    cacheRef.current.set(cacheKey, { ts: Date.now(), hits });
    return hits;
  }, [query, filters, fuse, indexed, applyFilters, docs.length]);

  // Audit log + history (only on debounced query commit, not every keystroke)
  const lastLoggedRef = useRef("");
  useEffect(() => {
    const q = query.trim();
    if (!q || q === lastLoggedRef.current) return;
    lastLoggedRef.current = q;
    void logAudit("search", null, { query: q, hits: results.length });
    setHistory((prev) => {
      const next = [q, ...prev.filter((p) => p !== q)].slice(0, 5);
      saveHistory(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);
  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { category: Category; hits: SearchHit[] }>();
    for (const h of results) {
      const key = h.category.id;
      const bucket = map.get(key);
      if (bucket) bucket.hits.push(h);
      else map.set(key, { category: h.category, hits: [h] });
    }
    return Array.from(map.values());
  }, [results]);

  const hasActiveFilters =
    !!filters.categoryId || !!filters.dateFrom || !!filters.dateTo || filters.itmMode !== "all";

  return {
    rawQuery,
    setRawQuery,
    query,
    isSearching,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    results,
    grouped,
    history,
    clearHistory,
    isActive: !!query.trim() || hasActiveFilters,
  };
}
