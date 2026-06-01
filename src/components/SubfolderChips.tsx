import { useState } from "react";
import { Folder, Lock, MoreHorizontal, Move, Pencil, Trash2 } from "lucide-react";
import type { Category } from "@/lib/categories";
import { getChildren, getSubtreeIds } from "@/lib/categories";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  onRename,
  onDelete,
}: {
  parentId: string;
  all: Category[];
  counts: Record<string, number>;
  onOpen: (id: string) => void;
  onDropDocs: (targetCatId: string, docIds: string[]) => void;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string) => void;
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
        const canDelete = !!onDelete && (c.custom === true || c.isSystem === false);
        const canRename = !!onRename;
        return (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(c.id);
              }
            }}
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
            className={`group flex items-center gap-2.5 pl-4 pr-2 py-2.5 rounded-xl border bg-card text-sm transition-all hover:border-primary/50 hover:shadow-md cursor-pointer ${
              isHover ? "border-primary ring-2 ring-primary/30 bg-primary/5" : ""
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: dot }}
            />
            <Folder className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium truncate max-w-[200px]">{c.label}</span>
            {c.mode === "strict" && <Lock className="h-3.5 w-3.5 text-lock" />}
            <span className="text-xs text-muted-foreground tabular-nums bg-muted px-1.5 py-0.5 rounded-md">
              {count}
            </span>
            {(canRename || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    title="További műveletek"
                    aria-label="További műveletek"
                    className="h-7 w-7 ml-0.5 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {canRename && (
                    <DropdownMenuItem onSelect={() => onRename?.(c.id)}>
                      <Pencil className="h-4 w-4 mr-2" /> Átnevezés
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      {canRename && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        onSelect={() => onDelete?.(c.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Törlés
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </div>
  );
}
