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
import { supabase, type DocumentRow } from "@/lib/supabase";
import { useCategoryHelpers } from "@/hooks/use-categories";
import { logAudit } from "@/lib/audit";
import { ChevronRight, Lock } from "lucide-react";

export function BulkMoveDialog({
  open,
  onOpenChange,
  docs,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docs: DocumentRow[];
  onMoved?: (movedIds: string[], newCategory: string) => void;
}) {
  const { all, getRoot, getCategory } = useCategoryHelpers();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelected(null);
  }, [open]);

  // All selected docs should share the same root (UI enforces this via per-category view).
  const root = useMemo(() => {
    if (docs.length === 0) return null;
    return getRoot(docs[0].category);
  }, [docs, getRoot]);

  const options = useMemo(() => {
    if (!root) return [] as { id: string; label: string; depth: number }[];
    const result: { id: string; label: string; depth: number }[] = [];
    const visit = (id: string, depth: number) => {
      const c = getCategory(id);
      result.push({ id, label: c.label, depth });
      all
        .filter((x) => x.parentCatId === id)
        .forEach((ch) => visit(ch.id, depth + 1));
    };
    visit(root.id, 0);
    return result;
  }, [root, all, getCategory]);

  const handleMove = async () => {
    if (!selected || docs.length === 0) {
      onOpenChange(false);
      return;
    }
    const toMove = docs.filter((d) => d.category !== selected);
    if (toMove.length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const ids = toMove.map((d) => d.id);
      const { error } = await supabase
        .from("documents")
        .update({ category: selected })
        .in("id", ids);
      if (error) throw error;
      await Promise.all(
        toMove.map((d) =>
          logAudit("move", d.id, { from: d.category, to: selected, bulk: true }),
        ),
      );
      toast.success(`${toMove.length} dokumentum áthelyezve`);
      onMoved?.(ids, selected);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {docs.length} dokumentum áthelyezése
          </DialogTitle>
          <DialogDescription>
            Válassz célmappát ugyanazon a főkategórián belül.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 max-h-80 overflow-y-auto space-y-0.5">
          {options.map((o) => {
            const isSelected = selected === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                className={`w-full flex items-center gap-1.5 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  isSelected ? "bg-brand text-brand-foreground" : "hover:bg-muted"
                }`}
                style={{ paddingLeft: `${0.75 + o.depth * 1.25}rem` }}
              >
                {o.depth > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleMove} disabled={!selected || saving}>
            Áthelyezés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
