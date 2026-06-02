import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { BUILT_IN_CATEGORIES } from "@/lib/categories";
import { Card } from "@/components/ui/card";
import { Users, Folder } from "lucide-react";

type SharedRow = {
  id: string;
  owner_user_id: string;
  categories: string[];
};

type SharedCategory = {
  catId: string;
  label: string;
  color: string;
  ownerName: string;
};

export function SharedWithMeSection({
  onOpen,
}: {
  onOpen: (catId: string) => void;
}) {
  const [items, setItems] = useState<SharedCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) {
        setLoading(false);
        return;
      }
      const { data: shares } = await supabase
        .from("shared_access")
        .select("id, owner_user_id, categories")
        .eq("invited_user_id", me.user.id)
        .eq("status", "active");

      if (!shares || shares.length === 0) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      const ownerIds = Array.from(
        new Set((shares as SharedRow[]).map((s) => s.owner_user_id)),
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, company, email")
        .in("id", ownerIds);
      const ownerNameById = new Map<string, string>();
      (profiles ?? []).forEach((p) => {
        const row = p as { id: string; full_name: string | null; company: string | null; email: string | null };
        ownerNameById.set(
          row.id,
          row.full_name || row.company || row.email || "Felhasználó",
        );
      });

      const customIds: string[] = [];
      (shares as SharedRow[]).forEach((s) =>
        s.categories.forEach((c) => {
          if (c.startsWith("custom:")) customIds.push(c.slice(7));
        }),
      );
      const customLabelById = new Map<string, { name: string; color: string }>();
      if (customIds.length > 0) {
        const { data: customs } = await supabase
          .from("custom_categories")
          .select("id, name, color")
          .in("id", customIds);
        (customs ?? []).forEach((c) => {
          const row = c as { id: string; name: string; color: string };
          customLabelById.set(row.id, { name: row.name, color: row.color });
        });
      }

      const out: SharedCategory[] = [];
      (shares as SharedRow[]).forEach((s) => {
        const ownerName = ownerNameById.get(s.owner_user_id) ?? "Felhasználó";
        s.categories.forEach((cid) => {
          if (cid.startsWith("custom:")) {
            const info = customLabelById.get(cid.slice(7));
            if (info) {
              out.push({
                catId: cid,
                label: info.name,
                color: info.color || "#64748b",
                ownerName,
              });
            }
          } else {
            const builtin = BUILT_IN_CATEGORIES.find((b) => b.id === cid);
            if (builtin) {
              out.push({
                catId: cid,
                label: builtin.label,
                color: builtin.color ?? "#64748b",
                ownerName,
              });
            }
          }
        });
      });

      if (!cancelled) {
        setItems(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
            key={`${it.catId}-${i}`}
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
