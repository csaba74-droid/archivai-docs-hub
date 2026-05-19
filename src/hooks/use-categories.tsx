import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, type CustomCategoryRow } from "@/lib/supabase";
import {
  BUILT_IN_CATEGORIES,
  mergeCategories,
  customToCategory,
  getCategory as getCategoryFn,
  isStrict as isStrictFn,
  getRetentionDeadline as deadlineFn,
  type Category,
} from "@/lib/categories";

type Ctx = {
  customRows: CustomCategoryRow[];
  all: Category[];
  reload: () => Promise<void>;
  create: (input: { name: string; color: string; mode: "strict" | "normal"; retentionYears: number | null }) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const CategoriesContext = createContext<Ctx | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [customRows, setCustomRows] = useState<CustomCategoryRow[]>([]);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("custom_categories")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setCustomRows(data as CustomCategoryRow[]);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create: Ctx["create"] = useCallback(async ({ name, color, mode, retentionYears }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("not auth");
    const { error } = await supabase.from("custom_categories").insert({
      user_id: u.user.id,
      name,
      color,
      mode,
      retention_years: retentionYears,
    });
    if (error) throw error;
    await reload();
  }, [reload]);

  const remove: Ctx["remove"] = useCallback(async (id) => {
    // id may be prefixed with "custom:"
    const realId = id.startsWith("custom:") ? id.slice(7) : id;
    const { error } = await supabase.from("custom_categories").delete().eq("id", realId);
    if (error) throw error;
    await reload();
  }, [reload]);

  const all = useMemo(() => mergeCategories(customRows), [customRows]);

  return (
    <CategoriesContext.Provider value={{ customRows, all, reload, create, remove }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) {
    // safe fallback (built-in only)
    return {
      customRows: [] as CustomCategoryRow[],
      all: BUILT_IN_CATEGORIES,
      reload: async () => {},
      create: async () => {},
      remove: async () => {},
    };
  }
  return ctx;
}

export function useCategoryHelpers() {
  const { all } = useCategories();
  return {
    all,
    getCategory: (id: string) => getCategoryFn(id, all),
    isStrict: (id: string) => isStrictFn(id, all),
    getRetentionDeadline: (id: string, base: string | Date) => deadlineFn(id, base, all),
  };
}

export { customToCategory };
