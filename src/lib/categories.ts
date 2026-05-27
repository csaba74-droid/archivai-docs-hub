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
  return {
    id: `custom:${c.id}`,
    label: c.name,
    icon: Tag,
    mode: c.is_strict_itm ? "strict" : "normal",
    retentionYears: c.retention_years,
    retentionLabel:
      c.retention_years == null
        ? c.is_strict_itm
          ? "Határozatlan megőrzés"
          : "Nincs megőrzési korlát"
        : `${c.retention_years} év ${c.is_strict_itm ? "kötelező megőrzés" : "ajánlott"}`,
    color: c.color,
    custom: true,
  };
}

export function mergeCategories(custom: CustomCategoryRow[] = []): Category[] {
  return [...BUILT_IN_CATEGORIES, ...custom.map(customToCategory)];
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
