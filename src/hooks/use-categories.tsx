import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, type CustomCategoryRow } from "@/lib/supabase";
import {
  BUILT_IN_CATEGORIES,
  mergeCategories,
  customToCategory,
  getCategory as getCategoryFn,
  isStrict as isStrictFn,
  getRetentionDeadline as deadlineFn,
  getChildren as getChildrenFn,
  getRoot as getRootFn,
  getSubtreeIds as getSubtreeIdsFn,
  isInTreeOf as isInTreeOfFn,
  type Category,
} from "@/lib/categories";

export type CreateCategoryInput = {
  name: string;
  color: string;
  mode: "strict" | "normal";
  retentionYears: number | null;
  /** Parent in client tree-id space: built-in id ("szamlak") or "custom:<uuid>". */
  parentCatId?: string | null;
};

type Ctx = {
  customRows: CustomCategoryRow[];
  all: Category[];
  reload: () => Promise<void>;
  create: (input: CreateCategoryInput) => Promise<string>;
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
    if (data) setCustomRows(data as unknown as CustomCategoryRow[]);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create: Ctx["create"] = useCallback(async ({ name, color, mode, retentionYears, parentCatId }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("not auth");

    let parent_id: string | null = null;
    let parent_builtin: string | null = null;
    if (parentCatId) {
      if (parentCatId.startsWith("custom:")) parent_id = parentCatId.slice(7);
      else parent_builtin = parentCatId;
    }

    const payload: Record<string, unknown> = {
      user_id: u.user.id,
      name,
      color,
      is_strict_itm: mode === "strict",
      retention_years: retentionYears,
      parent_id,
      parent_builtin,
    };
    const { data, error } = await supabase
      .from("custom_categories")
      .insert(payload as never)
      .select()
      .single();
    if (error) {
      console.log("custom_categories insert error", error);
      throw error;
    }
    await reload();
    return `custom:${(data as unknown as CustomCategoryRow).id}`;
  }, [reload]);

  const remove: Ctx["remove"] = useCallback(async (id) => {
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
    return {
      customRows: [] as CustomCategoryRow[],
      all: BUILT_IN_CATEGORIES.map((c) => ({ ...c, parentCatId: null, rootCatId: c.id })) as Category[],
      reload: async () => {},
      create: async () => "",
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
    getChildren: (parentId: string) => getChildrenFn(parentId, all),
    getRoot: (id: string) => getRootFn(id, all),
    getSubtreeIds: (rootId: string) => getSubtreeIdsFn(rootId, all),
    isInTreeOf: (descendantId: string, ancestorId: string) => isInTreeOfFn(descendantId, ancestorId, all),
  };
}

export { customToCategory };
