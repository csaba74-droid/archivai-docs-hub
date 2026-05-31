import {
  Receipt,
  FileSignature,
  Truck,
  Briefcase,
  Landmark,
  Zap,
  Banknote,
  Wrench,
  FileText,
  Folder,
  Inbox,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type { CustomCategoryRow } from "./supabase";

export type StorageMode = "strict" | "normal";

export type Category = {
  id: string;
  label: string;
  icon: LucideIcon;
  mode: StorageMode;
  retentionYears: number | null;
  retentionLabel: string;
  color?: string;
  custom?: boolean;
  /** Parent category id in client tree-id space (built-in id like "szamlak" or "custom:<uuid>"). null = top-level. */
  parentCatId?: string | null;
  /** Root of the tree this category belongs to. For built-ins == own id. For top-level customs == own id. */
  rootCatId?: string;
  isSystem?: boolean;
};

export const BUILT_IN_CATEGORIES: Category[] = [
  { id: "beerkezett", label: "Beérkezett", icon: Inbox, mode: "normal", retentionYears: null, retentionLabel: "Beérkezett dokumentumok", color: "#3b82f6" },
  { id: "szamlak", label: "Számlák", icon: Receipt, mode: "strict", retentionYears: 10, retentionLabel: "10 év kötelező megőrzés" },
  { id: "szerzodesek", label: "Szerződések", icon: FileSignature, mode: "strict", retentionYears: 10, retentionLabel: "10 év kötelező megőrzés" },
  { id: "szallitolevek", label: "Szállítólevelek", icon: Truck, mode: "strict", retentionYears: 10, retentionLabel: "10 év kötelező megőrzés" },
  { id: "munkaugyi", label: "Munkaügyi iratok", icon: Briefcase, mode: "strict", retentionYears: null, retentionLabel: "Határozatlan megőrzés" },
  { id: "adobevallasok", label: "Adóbevallások", icon: Landmark, mode: "strict", retentionYears: 6, retentionLabel: "6 év kötelező megőrzés" },
  { id: "kozuzemi", label: "Közüzemi számlák", icon: Zap, mode: "normal", retentionYears: 5, retentionLabel: "5 év ajánlott" },
  { id: "banki", label: "Banki dokumentumok", icon: Banknote, mode: "normal", retentionYears: 5, retentionLabel: "5 év ajánlott" },
  { id: "muszaki", label: "Műszaki dokumentumok", icon: Wrench, mode: "normal", retentionYears: null, retentionLabel: "Nincs megőrzési korlát" },
  { id: "belso", label: "Belső iratok", icon: FileText, mode: "normal", retentionYears: null, retentionLabel: "Nincs megőrzési korlát" },
  { id: "egyeb", label: "Egyéb", icon: Folder, mode: "normal", retentionYears: null, retentionLabel: "Nincs megőrzési korlát" },
];

// Backwards-compat export (still used in a few places)
export const CATEGORIES = BUILT_IN_CATEGORIES;

export function customToCategory(c: CustomCategoryRow): Category {
  const strict = c.is_strict_itm;
  let parentCatId: string | null = null;
  if (c.parent_builtin) parentCatId = c.parent_builtin;
  else if (c.parent_id) parentCatId = `custom:${c.parent_id}`;
  return {
    id: `custom:${c.id}`,
    label: c.name,
    icon: Tag,
    mode: strict ? "strict" : "normal",
    retentionYears: c.retention_years,
    retentionLabel:
      c.retention_years == null
        ? strict
          ? "Határozatlan megőrzés"
          : "Nincs megőrzési korlát"
        : `${c.retention_years} év ${strict ? "kötelező megőrzés" : "ajánlott"}`,
    color: c.color,
    custom: true,
    parentCatId,
    isSystem: !!c.is_system,
  };
}

export function mergeCategories(custom: CustomCategoryRow[] = []): Category[] {
  const builtIns = BUILT_IN_CATEGORIES.map((c) => ({ ...c, parentCatId: null, rootCatId: c.id }));
  const customs = custom.map(customToCategory);
  // Compute rootCatId for customs by walking up parentCatId chain
  const byId = new Map<string, Category>();
  builtIns.forEach((c) => byId.set(c.id, c));
  customs.forEach((c) => byId.set(c.id, c));
  for (const c of customs) {
    let cur: Category | undefined = c;
    let depth = 0;
    while (cur && cur.parentCatId && depth < 64) {
      const p = byId.get(cur.parentCatId);
      if (!p) break;
      cur = p;
      depth++;
    }
    c.rootCatId = cur?.id ?? c.id;
  }
  return [...builtIns, ...customs];
}

/** Direct children of a given category id (one level only). */
export function getChildren(parentId: string, all: Category[]): Category[] {
  return all.filter((c) => c.parentCatId === parentId);
}

/** Returns true if `descendantId` is the same as `ancestorId` or a descendant of it. */
export function isInTreeOf(descendantId: string, ancestorId: string, all: Category[]): boolean {
  if (descendantId === ancestorId) return true;
  const byId = new Map(all.map((c) => [c.id, c]));
  let cur = byId.get(descendantId);
  let depth = 0;
  while (cur && depth < 64) {
    if (cur.id === ancestorId) return true;
    if (!cur.parentCatId) return false;
    cur = byId.get(cur.parentCatId);
    depth++;
  }
  return false;
}

/** Top of the tree the given category belongs to. */
export function getRoot(catId: string, all: Category[]): Category {
  const cat = getCategory(catId, all);
  if (!cat.rootCatId || cat.rootCatId === cat.id) return cat;
  return getCategory(cat.rootCatId, all);
}

/** Whole subtree (including the node itself). */
export function getSubtreeIds(rootId: string, all: Category[]): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    out.push(id);
    for (const ch of getChildren(id, all)) visit(ch.id);
  };
  visit(rootId);
  return out;
}


export const FALLBACK = BUILT_IN_CATEGORIES[BUILT_IN_CATEGORIES.length - 1];

export const getCategory = (id: string, all: Category[] = BUILT_IN_CATEGORIES): Category =>
  all.find((c) => c.id === id) ?? FALLBACK;

export const isStrict = (id: string, all: Category[] = BUILT_IN_CATEGORIES) =>
  getCategory(id, all).mode === "strict";

export function getRetentionDeadline(
  categoryId: string,
  baseDate: string | Date,
  all: Category[] = BUILT_IN_CATEGORIES,
): Date | null {
  const cat = getCategory(categoryId, all);
  if (cat.retentionYears == null) return null;
  const d = new Date(baseDate);
  d.setFullYear(d.getFullYear() + cat.retentionYears);
  return d;
}

export function formatDeadline(date: Date): string {
  return date.toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
}

export function isExpired(deadline: Date | null): boolean {
  if (!deadline) return false;
  return deadline.getTime() < Date.now();
}
