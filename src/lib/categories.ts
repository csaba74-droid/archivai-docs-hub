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
  type LucideIcon,
} from "lucide-react";

export type StorageMode = "strict" | "normal";

export type Category = {
  id: string;
  label: string;
  icon: LucideIcon;
  mode: StorageMode;
  /** Retention in years. null = indefinite (strict) or no limit (normal). */
  retentionYears: number | null;
  /** Short human description of the retention rule (Hungarian). */
  retentionLabel: string;
};

export const CATEGORIES: Category[] = [
  // Strict ITM archival — legally required, locked
  {
    id: "szamlak",
    label: "Számlák",
    icon: Receipt,
    mode: "strict",
    retentionYears: 10,
    retentionLabel: "10 év kötelező megőrzés",
  },
  {
    id: "szerzodesek",
    label: "Szerződések",
    icon: FileSignature,
    mode: "strict",
    retentionYears: 10,
    retentionLabel: "10 év kötelező megőrzés",
  },
  {
    id: "szallitolevek",
    label: "Szállítólevelek",
    icon: Truck,
    mode: "strict",
    retentionYears: 10,
    retentionLabel: "10 év kötelező megőrzés",
  },
  {
    id: "munkaugyi",
    label: "Munkaügyi iratok",
    icon: Briefcase,
    mode: "strict",
    retentionYears: null,
    retentionLabel: "Határozatlan megőrzés",
  },
  {
    id: "adobevallasok",
    label: "Adóbevallások",
    icon: Landmark,
    mode: "strict",
    retentionYears: 6,
    retentionLabel: "6 év kötelező megőrzés",
  },

  // Normal storage — recommended, user can delete
  {
    id: "kozuzemi",
    label: "Közüzemi számlák",
    icon: Zap,
    mode: "normal",
    retentionYears: 5,
    retentionLabel: "5 év ajánlott",
  },
  {
    id: "banki",
    label: "Banki dokumentumok",
    icon: Banknote,
    mode: "normal",
    retentionYears: 5,
    retentionLabel: "5 év ajánlott",
  },
  {
    id: "muszaki",
    label: "Műszaki dokumentumok",
    icon: Wrench,
    mode: "normal",
    retentionYears: null,
    retentionLabel: "Nincs megőrzési korlát",
  },
  {
    id: "belso",
    label: "Belső iratok",
    icon: FileText,
    mode: "normal",
    retentionYears: null,
    retentionLabel: "Nincs megőrzési korlát",
  },
  {
    id: "egyeb",
    label: "Egyéb",
    icon: Folder,
    mode: "normal",
    retentionYears: null,
    retentionLabel: "Nincs megőrzési korlát",
  },
];

export const getCategory = (id: string) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const isStrict = (id: string) => getCategory(id).mode === "strict";

/**
 * Returns the retention deadline date for a document, or null if indefinite/no limit.
 */
export function getRetentionDeadline(
  categoryId: string,
  createdAt: string | Date,
): Date | null {
  const cat = getCategory(categoryId);
  if (cat.retentionYears == null) return null;
  const d = new Date(createdAt);
  d.setFullYear(d.getFullYear() + cat.retentionYears);
  return d;
}

export function formatDeadline(date: Date): string {
  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
