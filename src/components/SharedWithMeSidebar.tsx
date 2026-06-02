import { Users, Folder } from "lucide-react";
import { useSharedWithMe } from "@/hooks/use-shared-with-me";

export function SharedWithMeSidebar({
  activeCat,
  onSelect,
}: {
  activeCat: string | null;
  onSelect: (catId: string) => void;
}) {
  const { items, loading } = useSharedWithMe();

  if (loading || items.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Users className="h-3 w-3" />
        Megosztott velem
      </div>
      <div className="space-y-0.5">
        {items.map((it, i) => {
          const active = activeCat === it.catId;
          return (
            <button
              key={`${it.catId}-${it.ownerUserId}-${i}`}
              type="button"
              onClick={() => onSelect(it.catId)}
              title={`${it.label} — ${it.ownerName}`}
              className={`group w-full flex items-start gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors ${
                active ? "bg-brand text-brand-foreground" : "hover:bg-muted"
              }`}
            >
              <Folder
                className="h-3.5 w-3.5 mt-0.5 shrink-0"
                style={{ color: active ? undefined : it.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate leading-tight">{it.label}</span>
                <span
                  className={`block truncate text-[11px] leading-tight ${
                    active ? "opacity-80" : "text-muted-foreground"
                  }`}
                >
                  {it.ownerName}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
