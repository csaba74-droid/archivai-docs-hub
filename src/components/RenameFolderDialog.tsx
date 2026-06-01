import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCategories, useCategoryHelpers } from "@/hooks/use-categories";

/**
 * Inline-style rename dialog for a custom folder (root category or subfolder).
 * Built-in / system categories are not renameable.
 */
export function RenameFolderDialog({
  open,
  onOpenChange,
  folderId,
  onRenamed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string | null;
  onRenamed?: () => void;
}) {
  const { rename } = useCategories();
  const { getCategory } = useCategoryHelpers();
  const folder = folderId ? getCategory(folderId) : null;
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && folder) setName(folder.label);
  }, [open, folder]);

  const canSave =
    !!folder &&
    folder.custom &&
    !folder.isSystem &&
    name.trim().length > 0 &&
    name.trim() !== folder.label;

  const handleSave = async () => {
    if (!folder || !canSave) return;
    setSaving(true);
    try {
      await rename(folder.id, name);
      toast.success("Átnevezve");
      onRenamed?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Átnevezés sikertelen", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mappa átnevezése</DialogTitle>
          <DialogDescription>
            {folder ? `Add meg az új nevet: "${folder.label}"` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="folder-name">Új név</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave && !saving) {
                e.preventDefault();
                void handleSave();
              }
            }}
            autoFocus
            maxLength={64}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
