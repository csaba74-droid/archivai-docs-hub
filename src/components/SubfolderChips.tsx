import { useState } from "react";
import { Folder, Lock } from "lucide-react";
import type { Category } from "@/lib/categories";
import { getChildren, getSubtreeIds } from "@/lib/categories";

const CATEGORY_COLORS: Record<string, string> = {
  szamlak: "#F59E0B",
  szerzodesek: "#1A2B4A",
  szallitolevek: "#10B981",
  munkaugyi: "#8B5CF6",
  adobevallasok: "#EF4444",
  kozuzemi: "#3B82F6",
  banki: "#14B8A6",
  muszaki: "#6B7280",
  belso: "#7DD3FC",
  egyeb: "#9CA3AF",
  beerkezett: "#3B82F6",
};

export function SubfolderChips({
  parentId,
  all,
  counts,
  onOpen,
  onDropDocs,
}: {
  parentId: string;
  all: Category[];
  counts: Record<string, number>;
  onOpen: (id: string) => void;
  onDropDocs: (targetCatId: string, docIds: string[]) => void;
}) {
  const children = getChildren(parentId, all);
  const [hoverId, setHoverId] = useState<string | null>(null);
  if (children.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {children.map((c) => {
        const subtree = getSubtreeIds(c.id, all);
        const count = subtree.reduce((s, id) => s + (counts[id] ?? 0), 0);
        const dot = c.custom && c.color ? c.color : (CATEGORY_COLORS[c.id] ?? "#9CA3AF");
        const isHover = hoverId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/x-doc-ids")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setHoverId(c.id);
              }
            }}
            onDragLeave={() => setHoverId((h) => (h === c.id ? null : h))}
            onDrop={(e) => {
              e.preventDefault();
              setHoverId(null);
              const raw = e.dataTransfer.getData("application/x-doc-ids");
              if (!raw) return;
              try {
                const ids = JSON.parse(raw) as string[];
                if (Array.isArray(ids) && ids.length > 0) onDropDocs(c.id, ids);
              } catch {
                /* ignore */
              }
            }}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card text-sm transition-all hover:border-primary/50 hover:shadow-sm ${
              isHover ? "border-primary ring-2 ring-primary/30 bg-primary/5" : ""
            }`}
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: dot }}
            />
            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium truncate max-w-[180px]">{c.label}</span>
            {c.mode === "strict" && <Lock className="h-3 w-3 text-lock" />}
            <span className="text-xs text-muted-foreground tabular-nums">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
