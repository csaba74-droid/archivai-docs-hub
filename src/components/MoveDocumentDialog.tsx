import { useMemo, useState } from "react";
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
import { ChevronRight } from "lucide-react";

export function MoveDocumentDialog({
  open,
  onOpenChange,
  doc,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: DocumentRow | null;
  onMoved?: (doc: DocumentRow, newCategory: string) => void;
}) {
  const { all, getRoot, getCategory } = useCategoryHelpers();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const options = useMemo(() => {
    if (!doc) return [] as { id: string; label: string; depth: number }[];
    const root = getRoot(doc.category);
    const result: { id: string; label: string; depth: number }[] = [];
    const visit = (id: string, depth: number) => {
      const c = getCategory(id);
      result.push({ id, label: c.label, depth });
      all
        .filter((x) => x.parentCatId === id)
        .forEach((ch) => visit(ch.id, depth + 1));
    };
    if (root.mode === "strict") {
      // Strict categories: only allow moving within the same protected tree
      visit(root.id, 0);
      return result;
    } else {
      // Normal categories: allow moving to any category except Beérkezett
      all
        .filter((c) => c.parentCatId == null)
        .forEach((c) => visit(c.id, 0));
      return result.filter((o) => o.id !== "beerkezett");
    }
  }, [doc, all, getRoot, getCategory]);

  const handleMove = async () => {
    if (!doc || !selected || selected === doc.category) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("documents")
        .update({ category: selected })
        .eq("id", doc.id);
      if (error) throw error;
      await logAudit("move", doc.id, {
        from: doc.category,
        to: selected,
      });
      toast.success("Áthelyezve");
      onMoved?.(doc, selected);
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
          <DialogTitle>Dokumentum áthelyezése</DialogTitle>
          <DialogDescription>
            Válassz másik mappát ugyanazon a főkategórián belül.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 max-h-80 overflow-y-auto space-y-0.5">
          {options.map((o) => {
            const isCurrent = doc?.category === o.id;
            const isSelected = selected === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                disabled={isCurrent}
                className={`w-full flex items-center gap-1.5 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  isSelected
                    ? "bg-brand text-brand-foreground"
                    : isCurrent
                      ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                      : "hover:bg-muted"
                }`}
                style={{ paddingLeft: `${0.75 + o.depth * 1.25}rem` }}
              >
                {o.depth > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                <span className="truncate">{o.label}</span>
                {isCurrent && <span className="ml-auto text-xs">(jelenlegi)</span>}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleMove} disabled={!selected || selected === doc?.category || saving}>
            Áthelyezés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
