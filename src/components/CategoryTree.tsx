import { useState, type ReactNode } from "react";
import { ChevronRight, Plus, X, Lock, ArrowRightLeft, Pencil } from "lucide-react";
import type { Category } from "@/lib/categories";

type Props = {
  allCats: Category[];
  counts: Record<string, number>;
  activeCat: string | null;
  onSelect: (id: string) => void;
  onAddSub: (parentId: string) => void;
  onDelete: (id: string) => void;
  /** Called when the user wants to move a (custom) folder under a different root. */
  onMoveFolder?: (id: string) => void;
  /** Called when the user wants to rename a (custom) folder. */
  onRenameFolder?: (id: string) => void;
  /** Pre-expanded ids (e.g. the active path). */
  initiallyExpanded?: Set<string>;
};

export function CategoryTree({
  allCats,
  counts,
  activeCat,
  onSelect,
  onAddSub,
  onDelete,
  onMoveFolder,
  onRenameFolder,
  initiallyExpanded,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>(initiallyExpanded ?? []);
    return s;
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const roots = allCats.filter((c) => !c.parentCatId);
  return (
    <div className="space-y-0.5">
      {roots.map((c) => (
        <TreeNode
          key={c.id}
          cat={c}
          allCats={allCats}
          counts={counts}
          activeCat={activeCat}
          expanded={expanded}
          toggle={toggle}
          onSelect={onSelect}
          onAddSub={onAddSub}
          onDelete={onDelete}
          onMoveFolder={onMoveFolder}
          onRenameFolder={onRenameFolder}
          depth={0}
        />
      ))}
    </div>
  );
}

function TreeNode({
  cat,
  allCats,
  counts,
  activeCat,
  expanded,
  toggle,
  onSelect,
  onAddSub,
  onDelete,
  onMoveFolder,
  onRenameFolder,
  depth,
}: {
  cat: Category;
  allCats: Category[];
  counts: Record<string, number>;
  activeCat: string | null;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onSelect: (id: string) => void;
  onAddSub: (parentId: string) => void;
  onDelete: (id: string) => void;
  onMoveFolder?: (id: string) => void;
  onRenameFolder?: (id: string) => void;
  depth: number;
}) {
  const children = allCats.filter((c) => c.parentCatId === cat.id);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(cat.id);
  const active = activeCat === cat.id;
  const Icon = cat.icon;
  const canDelete = cat.custom && !cat.isSystem;
  // Only user-created custom folders can be moved (not built-in roots, not
  // the system "Beérkezett" inbox).
  const canMove = !!onMoveFolder && cat.custom && !cat.isSystem;
  const canRename = !!onRenameFolder && cat.custom && !cat.isSystem;

  return (
    <div>
      <div
        className={`group flex items-center rounded-md text-sm transition-colors ${
          active ? "bg-brand text-brand-foreground" : "hover:bg-muted"
        }`}
        style={{ paddingLeft: `${0.25 + depth * 0.85}rem` }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle(cat.id);
          }}
          className={`h-7 w-5 flex items-center justify-center shrink-0 ${
            hasChildren ? "opacity-80 hover:opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-label={isExpanded ? "Összecsuk" : "Kinyit"}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelect(cat.id)}
          className="flex-1 flex items-center gap-2 min-w-0 py-1.5 pr-1 text-left"
        >
          {cat.custom && cat.color ? (
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: cat.color }}
            />
          ) : (
            <Icon className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{cat.label}</span>
          {cat.mode === "strict" && (
            <Lock className="h-3 w-3 opacity-60 shrink-0" />
          )}
        </button>
        <span className="text-[11px] tabular-nums opacity-70 mr-1 shrink-0">
          {counts[cat.id] ?? 0}
        </span>
        <IconBtn
          onClick={(e) => {
            e.stopPropagation();
            onAddSub(cat.id);
          }}
          title="Új almappa"
        >
          <Plus className="h-3 w-3" />
        </IconBtn>
        {canRename && (
          <IconBtn
            onClick={(e) => {
              e.stopPropagation();
              onRenameFolder?.(cat.id);
            }}
            title="Átnevezés"
          >
            <Pencil className="h-3 w-3" />
          </IconBtn>
        )}
        {canMove && (
          <IconBtn
            onClick={(e) => {
              e.stopPropagation();
              onMoveFolder?.(cat.id);
            }}
            title="Mappa áthelyezése"
          >
            <ArrowRightLeft className="h-3 w-3" />
          </IconBtn>
        )}
        {canDelete && (
          <IconBtn
            onClick={(e) => {
              e.stopPropagation();
              onDelete(cat.id);
            }}
            title="Törlés"
            danger
          >
            <X className="h-3 w-3" />
          </IconBtn>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div>
          {children.map((ch) => (
            <TreeNode
              key={ch.id}
              cat={ch}
              allCats={allCats}
              counts={counts}
              activeCat={activeCat}
              expanded={expanded}
              toggle={toggle}
              onSelect={onSelect}
              onAddSub={onAddSub}
              onDelete={onDelete}
              onMoveFolder={onMoveFolder}
              onRenameFolder={onRenameFolder}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity ${
        danger ? "hover:text-destructive" : "hover:bg-muted-foreground/10"
      }`}
    >
      {children}
    </button>
  );
}
