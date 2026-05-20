import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCategories } from "@/hooks/use-categories";

const COLOR_OPTIONS = ["#64748b", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#0ea5e9"];

export function CustomCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (categoryId: string) => void;
}) {
  const { create } = useCategories();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [mode, setMode] = useState<"strict" | "normal">("normal");
  const [retention, setRetention] = useState<string>("none"); // 'none' or year number
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Adj meg egy nevet");
      return;
    }
    setSaving(true);
    try {
      const retentionYears = retention === "none" ? null : parseInt(retention, 10);
      const newId = await create({ name: name.trim(), color, mode, retentionYears });
      toast.success("Kategória létrehozva");
      setName("");
      setColor(COLOR_OPTIONS[0]);
      setMode("normal");
      setRetention("none");
      onOpenChange(false);
      onCreated?.(newId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Sikertelen", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Új kategória</DialogTitle>
          <DialogDescription>
            Hozz létre egyéni kategóriát saját megőrzési szabállyal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Név</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. Marketing anyagok" />
          </div>

          <div>
            <Label>Szín</Label>
            <div className="flex gap-2 mt-1.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                  aria-label={`color ${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Tárolás típusa</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "strict" | "normal")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normál (felhasználó törölheti)</SelectItem>
                <SelectItem value="strict">Szigorú ITM (nem törölhető)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Megőrzési idő</Label>
            <Select value={retention} onValueChange={setRetention}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nincs korlát / határozatlan</SelectItem>
                <SelectItem value="1">1 év</SelectItem>
                <SelectItem value="3">3 év</SelectItem>
                <SelectItem value="5">5 év</SelectItem>
                <SelectItem value="6">6 év</SelectItem>
                <SelectItem value="10">10 év</SelectItem>
                <SelectItem value="15">15 év</SelectItem>
                <SelectItem value="20">20 év</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleSave} disabled={saving}>Létrehozás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
