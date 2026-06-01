import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCategories, useCategoryHelpers } from "@/hooks/use-categories";
import { Lock } from "lucide-react";

/**
 * Moves an entire custom subfolder (with all its documents and sub-subfolders)
 * under a different root category. Documents reference the folder by id, so
 * they follow automatically — we only re-parent the custom_categories row.
 * The existing `custom_categories_validate` trigger recomputes `root_builtin`.
 */
export function MoveFolderDialog({
  open,
  onOpenChange,
  folderId,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Tree-id of the folder being moved, e.g. "custom:<uuid>". */
  folderId: string | null;
  onMoved?: () => void;
}) {
  const { all } = useCategories();
  const { getRoot, getCategory } = useCategoryHelpers();
  const { reload } = useCategories();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSelected(null);
  }, [open]);

  const folder = folderId ? getCategory(folderId) : null;
  const currentRoot = folderId ? getRoot(folderId) : null;

  // Destination options: all top-level categories except the folder's current
  // root and the folder itself (a folder can't be its own ancestor).
  const options = useMemo(() => {
    if (!folder) return [];
    return all.filter(
      (c) =>
        c.parentCatId == null &&
        c.id !== folder.id &&
        c.id !== currentRoot?.id,
    );
  }, [all, folder, currentRoot]);

  const handleMove = async () => {
    if (!folder || !selected || !folder.custom) {
      onOpenChange(false);
      return;
    }
    const realId = folder.id.startsWith("custom:") ? folder.id.slice(7) : folder.id;
    const targetIsCustom = selected.startsWith("custom:");
    const payload: Record<string, unknown> = targetIsCustom
      ? { parent_id: selected.slice(7), parent_builtin: null }
      : { parent_id: null, parent_builtin: selected };

    setSaving(true);
    try {
      const { error } = await supabase
        .from("custom_categories")
        .update(payload as never)
        .eq("id", realId);
      if (error) throw error;
      const targetLabel = getCategory(selected).label;
      toast.success(`Mappa áthelyezve: ${targetLabel}`);
      await reload();
      onMoved?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Áthelyezés sikertelen", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mappa áthelyezése</DialogTitle>
          <DialogDescription>
            {folder
              ? `"${folder.label}" — válassz új főkategóriát. A mappa és minden dokumentuma az új helyre kerül.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 max-h-80 overflow-y-auto space-y-0.5">
          {options.map((c) => {
            const isSelected = selected === c.id;
            const dot = c.custom && c.color ? c.color : "#9CA3AF";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                  isSelected ? "bg-brand text-brand-foreground" : "hover:bg-muted"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: dot }}
                />
                <span className="flex-1 truncate">{c.label}</span>
                {c.mode === "strict" && <Lock className="h-3 w-3 text-lock" />}
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="text-sm text-muted-foreground px-3 py-2">
              Nincs elérhető célmappa.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button onClick={handleMove} disabled={!selected || saving}>
            Áthelyezés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
