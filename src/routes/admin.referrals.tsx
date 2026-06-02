import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

type ReferredUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

type Row = {
  referrer_id: string;
  referrer_email: string;
  referrer_partner_type: string | null;
  referred_count: number;
  referred: ReferredUser[];
};

export const Route = createFileRoute("/admin/referrals")({
  component: AdminReferralsPage,
});

function AdminReferralsPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_referral_list");
    if (error) {
      toast.error("Nem sikerült betölteni az adatokat: " + error.message);
      setRows([]);
    } else {
      setRows(
        ((data ?? []) as any[]).map((r) => ({
          referrer_id: r.referrer_id,
          referrer_email: r.referrer_email,
          referrer_partner_type: r.referrer_partner_type,
          referred_count: Number(r.referred_count),
          referred: (r.referred ?? []) as ReferredUser[],
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
        return;
      }
      setAllowed(true);
      setAuthChecked(true);
      await load();
    })();
  }, [load]);

  const makeLifetime = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase.rpc("admin_set_partner_type", {
      _user: userId,
      _type: "accountant_lifetime",
    });
    setBusyId(null);
    if (error) {
      toast.error("Hiba: " + error.message);
      return;
    }
    toast.success("Élethosszig tartó hozzáférés beállítva.");
    await load();
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold mb-2">Hozzáférés megtagadva</h1>
        <p className="text-muted-foreground mb-6">Ehhez az oldalhoz adminisztrátori jogosultság szükséges.</p>
        <Button onClick={() => navigate({ to: "/" })}>Vissza</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Ajánlások (admin)</h1>
          <p className="text-muted-foreground mt-1">
            Felhasználók, akik másokat regisztráltak az Archivai-ba.
          </p>
        </div>

        <Card className="p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              Még nincs ajánló felhasználó.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ajánló e-mail</TableHead>
                  <TableHead>Ajánlott felhasználók</TableHead>
                  <TableHead>Részletek</TableHead>
                  <TableHead className="text-right">Művelet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isLifetime = r.referrer_partner_type === "accountant_lifetime";
                  return (
                    <TableRow key={r.referrer_id}>
                      <TableCell className="font-medium align-top">
                        <div className="flex items-center gap-2">
                          {r.referrer_email}
                          {isLifetime && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              <Crown className="h-3 w-3" /> Élethosszig
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">{r.referred_count}</TableCell>
                      <TableCell className="align-top">
                        <ul className="space-y-1 text-sm">
                          {r.referred.map((u) => (
                            <li key={u.id} className="text-muted-foreground">
                              <span className="text-foreground">{u.email ?? "—"}</span>
                              {" — "}
                              {new Date(u.created_at).toLocaleDateString("hu-HU")}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button
                          size="sm"
                          variant={isLifetime ? "outline" : "default"}
                          disabled={isLifetime || busyId === r.referrer_id}
                          onClick={() => makeLifetime(r.referrer_id)}
                        >
                          {busyId === r.referrer_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isLifetime ? (
                            "Beállítva"
                          ) : (
                            "Élethosszig ingyenes"
                          )}
                        </Button>
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
