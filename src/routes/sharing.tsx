import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCategories } from "@/hooks/use-categories";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Trash2, Copy, ChevronRight } from "lucide-react";
import type { Category } from "@/lib/categories";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/sharing")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: SharingPage,
});

type ShareRow = {
  id: string;
  owner_user_id: string;
  invited_email: string;
  invited_user_id: string | null;
  categories: string[];
  status: "pending" | "accepted" | "revoked";
  access_type: string;
  created_at: string;
};

// Vendég hozzáférés limit: Alap = 0, Pro = 3, Vállalati = korlátlan.
const PLAN_LIMITS: Record<string, number> = {
  alap: 0,
  pro: 3,
  vallalati: Number.POSITIVE_INFINITY,
};

const CAT_COLORS: Record<string, string> = {
  szamlak: "#C17B2F",
  szerzodesek: "#1A2B4A",
  szallitolevek: "#0F6E56",
  munkaugyi: "#5B3A8C",
  adobevallasok: "#8B1A1A",
  kozuzemi: "#2B4B7A",
  banki: "#0D5F6B",
  muszaki: "#5F5E5A",
  belso: "#4A7A9B",
  egyeb: "#A8A49E",
};

function SharingPage() {
  const { all: allCats } = useCategories();
  const { subscription } = useSubscription();
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCats, setEditCats] = useState<string[]>([]);

  const plan = subscription?.plan ?? "alap";
  const limit = PLAN_LIMITS[plan] ?? 0;
  const usedCount = shares.filter((s) => s.status !== "revoked").length;
  const limitReached = usedCount >= limit;

  const reload = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("shared_access")
      .select("*")
      .eq("owner_user_id", u.user.id)
      .eq("access_type", "guest")
      .order("created_at", { ascending: false });
    if (error) toast.error("Betöltési hiba", { description: error.message });
    else setShares((data as ShareRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleCat = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Érvénytelen email cím");
      return;
    }
    if (selectedCats.length === 0) {
      toast.error("Válassz ki legalább egy kategóriát");
      return;
    }
    if (limitReached) {
      toast.error("Elérted a meghívók maximumát", {
        description: `A ${PLAN_INFO[plan].label} csomag max ${limit} meghívottat enged. Válts magasabb csomagra.`,
      });
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSubmitting(false);
      return;
    }
    const insertPayload = {
      owner_user_id: u.user.id,
      invited_email: trimmed,
      categories: selectedCats,
      role: "viewer" as const,
      access_type: "guest" as const,
      status: "pending" as const,
    };
    console.log("[sharing] Inserting shared_access row:", insertPayload);
    const { data: inserted, error } = await supabase
      .from("shared_access")
      .insert(insertPayload)
      .select("*")
      .single();
    console.log("[sharing] Insert result:", { inserted, error });
    if (error || !inserted) {
      setSubmitting(false);
      toast.error("Meghívó sikertelen", {
        description: error?.message ?? "Nem sikerült létrehozni a meghívót",
      });
      console.error("[sharing] Insert failed:", error);
      return;
    }

    // Verify the row actually persisted before sending the email
    const { data: verifyRow, error: verifyErr } = await supabase
      .from("shared_access")
      .select("id, status, invited_email")
      .eq("id", inserted.id)
      .maybeSingle();
    console.log("[sharing] Verify row:", { verifyRow, verifyErr });
    if (verifyErr || !verifyRow) {
      setSubmitting(false);
      toast.error("Meghívó nem található az adatbázisban", {
        description: verifyErr?.message ?? "A beszúrt sor nem érhető el (RLS?)",
      });
      return;
    }

    try {
      console.log("Sending invitation to:", trimmed);
      console.log("Calling edge function...");
      const { data: fnData, error: fnError } = await supabase.functions.invoke("send-invitation", {
        body: {
          to_email: trimmed,
          owner_name: u.user.email ?? "",
          categories: selectedCats
            .map((c) => allCats.find((cat) => cat.id === c)?.label ?? c)
            .join(", "),
          invitation_link: `https://archivai-docs-hub.lovable.app/accept-invitation?token=${inserted.id}`,
        },
      });
      console.log("Edge function result:", fnData, fnError);
      if (fnError) throw fnError;
      if (fnData && typeof fnData === "object" && "error" in fnData && fnData.error) {
        throw new Error(String((fnData as { error: unknown }).error));
      }
      toast.success("Meghívó elküldve", {
        description: `${trimmed} email értesítést kapott a hozzáférésről.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ismeretlen hiba";
      toast.warning("Meghívó létrejött, de az email nem ment ki", {
        description: msg,
      });
    }
    setSubmitting(false);
    setEmail("");
    setSelectedCats([]);
    void reload();
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Biztosan visszavonod ezt a hozzáférést?")) return;
    const { error } = await supabase.from("shared_access").delete().eq("id", id);
    if (error) {
      toast.error("Sikertelen", { description: error.message });
      return;
    }
    toast.success("Hozzáférés visszavonva");
    void reload();
  };

  const startEdit = (s: ShareRow) => {
    setEditingId(s.id);
    setEditCats(s.categories);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (editCats.length === 0) {
      toast.error("Legalább egy kategóriát válassz");
      return;
    }
    const { error } = await supabase
      .from("shared_access")
      .update({ categories: editCats, updated_at: new Date().toISOString() })
      .eq("id", editingId);
    if (error) {
      toast.error("Mentés sikertelen", { description: error.message });
      return;
    }
    toast.success("Frissítve");
    setEditingId(null);
    void reload();
  };

  const inviteLink = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/login` : ""),
    [],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 md:px-8 py-4 flex items-center gap-3">
        <BackButton />
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-brand" />
          <h1 className="text-lg font-semibold tracking-tight">Hozzáférés megosztása</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Hívjon meg könyvelőt vagy munkatársat. A meghívott csak az Ön által kijelölt mappákat
          láthatja.
        </p>

        {/* Plan limit indicator */}
        <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">
              {PLAN_INFO[plan].label} csomag — {usedCount}/{limit === Infinity ? "∞" : limit}{" "}
              {plan === "vallalati" ? "munkatárs" : "meghívott"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {plan === "alap" && "Max 1 meghívott felhasználó"}
              {plan === "pro" && "Max 3 meghívott felhasználó"}
              {plan === "vallalati" && "Akár 5 munkatárs — közös munkaterület audit naplóval"}
            </div>
          </div>
          {plan !== "vallalati" && (
            <Link to="/subscription">
              <Button variant="outline" size="sm">
                Csomag váltás
              </Button>
            </Link>
          )}
        </div>

        {/* Invite form */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Új meghívó</h2>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Meghívott email címe</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="konyvelo@pelda.hu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={limitReached}
            />
          </div>

          {plan === "vallalati" && (
            <div className="space-y-2">
              <Label>Szerepkör</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole("viewer")}
                  disabled={limitReached}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                    selectedRole === "viewer" ? "border-brand bg-brand/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="font-medium">Olvasó</div>
                  <div className="text-xs text-muted-foreground">Csak megtekintés</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("editor")}
                  disabled={limitReached}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                    selectedRole === "editor" ? "border-brand bg-brand/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="font-medium">Szerkesztő</div>
                  <div className="text-xs text-muted-foreground">Feltöltés és szerkesztés (törlés nélkül)</div>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Megosztott kategóriák</Label>
            <CategoryPicker
              cats={allCats}
              selected={selectedCats}
              onToggle={(id) => toggleCat(id, selectedCats, setSelectedCats)}
              disabled={limitReached}
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting || limitReached}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Meghívó küldése
          </Button>

          {limitReached && (
            <p className="text-xs text-destructive">
              Elérted a {PLAN_INFO[plan].label} csomag meghívó-limitjét. Magasabb csomagban többet
              hívhatsz meg.
            </p>
          )}
        </section>

        {/* Active shares */}
        <section className="space-y-3">
          <h2 className="font-semibold">Megosztott hozzáférések</h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : shares.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              Még nincs megosztott hozzáférés.
            </div>
          ) : (
            <div className="space-y-2">
              {shares.map((s) => (
                <div key={s.id} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{s.invited_email}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Meghívva: {new Date(s.created_at).toLocaleDateString("hu-HU")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {plan === "vallalati" && (
                        <Badge variant="outline" className="capitalize">
                          {s.role === "editor" ? "Szerkesztő" : "Olvasó"}
                        </Badge>
                      )}
                      <Badge
                        variant={s.status === "accepted" ? "default" : "secondary"}
                        className={
                          s.status === "accepted"
                            ? "bg-[#0F6E56] text-white hover:bg-[#0F6E56]/90"
                            : ""
                        }
                      >
                        {s.status === "accepted"
                          ? "Elfogadva"
                          : s.status === "pending"
                            ? "Függőben"
                            : "Visszavonva"}
                      </Badge>
                    </div>
                  </div>

                  {editingId === s.id ? (
                    <div className="space-y-3">
                      {plan === "vallalati" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Szerepkör</Label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditRole("viewer")}
                              className={`flex-1 rounded-md border px-3 py-1.5 text-xs ${
                                editRole === "viewer" ? "border-brand bg-brand/5" : "border-border"
                              }`}
                            >
                              Olvasó
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditRole("editor")}
                              className={`flex-1 rounded-md border px-3 py-1.5 text-xs ${
                                editRole === "editor" ? "border-brand bg-brand/5" : "border-border"
                              }`}
                            >
                              Szerkesztő
                            </button>
                          </div>
                        </div>
                      )}
                      <CategoryPicker
                        cats={allCats}
                        selected={editCats}
                        onToggle={(id) => toggleCat(id, editCats, setEditCats)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          Mentés
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Mégse
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {s.categories.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Nincs kategória</span>
                        ) : (
                          s.categories.map((cid) => {
                            const cat = allCats.find((c) => c.id === cid);
                            const color = cat?.color ?? CAT_COLORS[cid] ?? "#9CA3AF";
                            return (
                              <span
                                key={cid}
                                className="text-[11px] px-2 py-0.5 rounded font-medium"
                                style={{
                                  backgroundColor: `${color}1f`,
                                  color,
                                  border: `1px solid ${color}40`,
                                }}
                              >
                                {cat?.label ?? cid}
                              </span>
                            );
                          })
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                          Szerkesztés
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevoke(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Visszavonás
                        </Button>
                        {s.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(inviteLink);
                                toast.success("Belépési link kimásolva");
                              } catch {
                                toast.error("Másolás sikertelen");
                              }
                            }}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Link másolása
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function CategoryPicker({
  cats,
  selected,
  onToggle,
  disabled,
}: {
  cats: Category[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  const roots = cats.filter((c) => !c.parentCatId && c.id !== "beerkezett");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-md border bg-background divide-y">
      {roots.map((cat) => {
        const children = cats.filter((c) => c.parentCatId === cat.id);
        const hasChildren = children.length > 0;
        const isExpanded = expanded.has(cat.id);
        const color = cat.color ?? CAT_COLORS[cat.id] ?? "#9CA3AF";
        const checked = selected.includes(cat.id);
        return (
          <div key={cat.id}>
            <div
              className={`flex items-center gap-1 px-2 py-2 text-sm hover:bg-muted/50 transition-colors ${
                disabled ? "opacity-50" : ""
              }`}
              style={{ borderLeft: `4px solid ${color}` }}
            >
              <button
                type="button"
                onClick={() => hasChildren && toggleExpand(cat.id)}
                className={`h-6 w-6 flex items-center justify-center shrink-0 ${
                  hasChildren ? "opacity-80 hover:opacity-100" : "opacity-0 pointer-events-none"
                }`}
                aria-label={isExpanded ? "Összecsuk" : "Kinyit"}
                disabled={!hasChildren}
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                />
              </button>
              <label
                className={`flex-1 flex items-center gap-2 min-w-0 ${
                  disabled ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => !disabled && onToggle(cat.id)}
                  disabled={disabled}
                />
                <span className="truncate font-medium">{cat.label}</span>
              </label>
            </div>
            {isExpanded && hasChildren && (
              <div className="bg-muted/20">
                {children.map((sub) => {
                  const subChecked = selected.includes(sub.id);
                  const subColor = sub.color ?? color;
                  return (
                    <label
                      key={sub.id}
                      className={`flex items-center gap-2 pl-10 pr-3 py-2 text-sm border-t hover:bg-muted/50 transition-colors ${
                        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      <Checkbox
                        checked={subChecked}
                        onCheckedChange={() => !disabled && onToggle(sub.id)}
                        disabled={disabled}
                      />
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: subColor }}
                      />
                      <span className="truncate">{sub.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
