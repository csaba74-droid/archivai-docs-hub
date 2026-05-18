import {
  Receipt,
  FileSignature,
  Truck,
  Briefcase,
  Landmark,
  Wrench,
  FileText,
  Folder,
  type LucideIcon,
} from "lucide-react";

export type Category = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const CATEGORIES: Category[] = [
  { id: "szamlak", label: "Számlák", icon: Receipt },
  { id: "szerzodesek", label: "Szerződések", icon: FileSignature },
  { id: "szallitolevek", label: "Szállítólevelek", icon: Truck },
  { id: "munkaugyi", label: "Munkaügyi iratok", icon: Briefcase },
  { id: "adobevallasok", label: "Adóbevallások", icon: Landmark },
  { id: "muszaki", label: "Műszaki dokumentumok", icon: Wrench },
  { id: "belso", label: "Belső iratok", icon: FileText },
  { id: "egyeb", label: "Egyéb", icon: Folder },
];

export const getCategory = (id: string) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
