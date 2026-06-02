import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Users, Folder } from "lucide-react";
import { useSharedWithMe } from "@/hooks/use-shared-with-me";

export function SharedWithMeSection({
  onOpen,
}: {
  onOpen: (catId: string) => void;
}) {
  const { items, loading } = useSharedWithMe();

  if (loading || items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-bold tracking-tight">Megosztott velem</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((it, i) => (
          <Card
            key={`${it.catId}-${it.ownerUserId}-${i}`}
            onClick={() => onOpen(it.catId)}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4"
            style={{ borderLeftColor: it.color }}
          >
            <div className="flex items-start gap-3">
              <div
                className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${it.color}1a` }}
              >
                <Folder className="h-4 w-4" style={{ color: it.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{it.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  Megosztotta: {it.ownerName}
                </div>
                {it.ownerEmail && it.ownerEmail !== it.ownerName && (
                  <div className="text-[11px] text-muted-foreground/80 truncate">
                    {it.ownerEmail}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <Link to="/sharing" className="underline hover:text-foreground">
          Hozzáférések kezelése
        </Link>
      </p>
    </div>
  );
}
