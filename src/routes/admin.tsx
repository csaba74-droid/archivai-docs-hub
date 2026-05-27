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

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_users_overview");
    if (error) {
      toast.error("Nem sikerült betölteni: " + error.message);
      setRows([]);
    } else {
      setRows(
        ((data ?? []) as any[]).map((r) => ({
          user_id: r.user_id,
          email: r.email,
          created_at: r.created_at,
          plan: r.plan,
          status: r.status,
          trial_end: r.trial_end,
          partner_type: r.partner_type,
          document_count: Number(r.document_count ?? 0),
          storage_bytes: Number(r.storage_bytes ?? 0),
        })),
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
    setBusyId(userId);
    const { error } = await supabase.rpc("admin_set_partner_type", {
      _user: userId,
      _type: enable ? "accountant_lifetime" : null,
    });
    setBusyId(null);
    if (error) {
      toast.error("Hiba: " + error.message);
      return;
    }
    toast.success(enable ? "Élethosszig hozzáférés bekapcsolva." : "Élethosszig hozzáférés kikapcsolva.");
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
                  const isLifetime = r.partner_type === "accountant_lifetime";
                  return (
                    <TableRow key={r.user_id}>
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
                          disabled={busyId === r.user_id}
                          onCheckedChange={(v) => toggleLifetime(r.user_id, v)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            placeholder="napok"
                            className="w-20"
                            value={extendDays[r.user_id] ?? ""}
                            onChange={(e) =>
                              setExtendDays((p) => ({ ...p, [r.user_id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            disabled={busyId === r.user_id}
                            onClick={() => extendTrial(r.user_id)}
                          >
                            {busyId === r.user_id ? (
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
