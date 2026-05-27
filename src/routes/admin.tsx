import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Crown } from "lucide-react";

const ADMIN_EMAIL = "lenard.csaba74@gmail.com";

type UserRow = {
  id: string;
  user_id: string;
  email: string | null;
  created_at: string;
  plan: string | null;
  status: string | null;
  trial_end: string | null;
  partner_type: string | null;
  document_count: number;
  storage_bytes: number;
};

type AdminOverviewRow = Partial<UserRow> & {
  document_count?: number | string | null;
  storage_bytes?: number | string | null;
};

type ReferralStatRow = {
  referrer_id: string;
  referrer_email: string;
  referred_count: number;
  subscribed_count: number;
};

function rewardLevel(n: number): { label: string; tone: string } {
  if (n >= 20) return { label: "Lifetime Vállalati", tone: "bg-purple-100 text-purple-800" };
  if (n >= 10) return { label: "Lifetime Pro", tone: "bg-amber-100 text-amber-800" };
  if (n >= 5) return { label: "1 év Pro", tone: "bg-emerald-100 text-emerald-800" };
  if (n >= 1) return { label: "Havi jóváírás", tone: "bg-sky-100 text-sky-800" };
  return { label: "—", tone: "bg-muted text-muted-foreground" };
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("hu-HU");
}

function fmtBytes(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});
  const [referralStats, setReferralStats] = useState<ReferralStatRow[]>([]);
  const [referralLoading, setReferralLoading] = useState(true);

  

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_users_overview");
    if (error) {
      toast.error("Nem sikerült betölteni: " + error.message);
      setRows([]);
    } else {
      setRows(
        ((data ?? []) as AdminOverviewRow[]).map((r) => {
          const userId = r.user_id ?? r.id ?? "";
          return {
            id: userId,
            user_id: userId,
            email: r.email ?? null,
            created_at: r.created_at ?? "",
            plan: r.plan ?? null,
            status: r.status ?? null,
            trial_end: r.trial_end ?? null,
            partner_type: r.partner_type ?? null,
            document_count: Number(r.document_count ?? 0),
            storage_bytes: Number(r.storage_bytes ?? 0),
          };
        }),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email?.toLowerCase() ?? "";
      if (email !== ADMIN_EMAIL) {
        setAuthChecked(true);
        setAllowed(false);
        navigate({ to: "/dashboard" });
        return;
      }
      setAllowed(true);
      setAuthChecked(true);
      await load();
    })();
  }, [load, navigate]);

  const toggleLifetime = async (userId: string, enable: boolean) => {
    console.log("[admin] toggleLifetime userId:", userId, "enable:", enable);
    if (!userId) {
      toast.error("Hiányzó user id.");
      return;
    }
    setBusyId(userId);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "admin-partner-type",
        { body: { userId, partnerType: enable ? "accountant_lifetime" : null } },
      );
      if (fnError) throw fnError;
      if (result && typeof result === "object" && "error" in result && result.error) {
        throw new Error(String((result as { error: unknown }).error));
      }
      console.log("[admin] admin-partner-type result:", result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[admin] setPartnerType error:", e);
      setBusyId(null);
      toast.error("Hiba: " + msg);
      return;
    }
    setBusyId(null);
    toast.success(
      enable ? "Élethosszig hozzáférés bekapcsolva." : "Élethosszig hozzáférés kikapcsolva.",
    );
    await load();
  };

  const extendTrial = async (userId: string) => {
    const days = parseInt(extendDays[userId] ?? "", 10);
    if (!Number.isFinite(days) || days <= 0) {
      toast.error("Adj meg érvényes napszámot.");
      return;
    }
    setBusyId(userId);
    const { error } = await supabase.rpc("admin_extend_trial_days", {
      _user: userId,
      _days: days,
    });
    setBusyId(null);
    if (error) {
      toast.error("Hiba: " + error.message);
      return;
    }
    toast.success(`Próbaidő ${days} nappal meghosszabbítva.`);
    setExtendDays((p) => ({ ...p, [userId]: "" }));
    await load();
  };

  if (!authChecked || (authChecked && !allowed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-brand">Admin – Felhasználók</h1>
          <p className="text-muted-foreground mt-1">
            Az összes regisztrált felhasználó és előfizetési állapotuk.
          </p>
        </div>

        <Card className="p-4 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nincs felhasználó.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Regisztráció</TableHead>
                  <TableHead>Csomag</TableHead>
                  <TableHead>Állapot</TableHead>
                  <TableHead>Próbaidő vége</TableHead>
                  <TableHead className="text-right">Dok.</TableHead>
                  <TableHead className="text-right">Tárhely</TableHead>
                  <TableHead className="text-center">Élethosszig</TableHead>
                  <TableHead>Próbaidő +napok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const rowUserId = r.user_id ?? r.id;
                  const isLifetime = r.partner_type === "accountant_lifetime";
                  return (
                    <TableRow key={rowUserId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {r.email ?? "—"}
                          {isLifetime && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              <Crown className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{fmtDate(r.created_at)}</TableCell>
                      <TableCell>{r.plan ?? "—"}</TableCell>
                      <TableCell>{r.status ?? "—"}</TableCell>
                      <TableCell>{fmtDate(r.trial_end)}</TableCell>
                      <TableCell className="text-right">{r.document_count}</TableCell>
                      <TableCell className="text-right">{fmtBytes(r.storage_bytes)}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={isLifetime}
                          disabled={busyId === rowUserId}
                          onCheckedChange={(v) => toggleLifetime(rowUserId, v)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            placeholder="napok"
                            className="w-20"
                            value={extendDays[rowUserId] ?? ""}
                            onChange={(e) =>
                              setExtendDays((p) => ({ ...p, [rowUserId]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            disabled={busyId === rowUserId}
                            onClick={() => extendTrial(rowUserId)}
                          >
                            {busyId === rowUserId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "+"
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
