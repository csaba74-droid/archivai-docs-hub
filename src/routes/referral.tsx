import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Gift } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/referral")({
  head: () => ({
    meta: [
      { title: "Ajánlások — Archivai" },
      { name: "description", content: "Ajánld az Archivai-t és kövesd nyomon az ajánlott felhasználókat." },
    ],
  }),
  component: ReferralPage,
});

type Referral = {
  user_id: string;
  full_name: string | null;
  email: string;
  created_at: string;
  subscribed: boolean;
};

function ReferralPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!userRes.user) {
        setLoading(false);
        return;
      }
      setUserId(userRes.user.id);
      const { data, error } = await (supabase.rpc as any)("get_referrals");
      if (cancelled) return;
      if (error) {
        toast.error("Nem sikerült betölteni az ajánlásokat");
        setReferrals([]);
      } else {
        setReferrals((data ?? []) as Referral[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const referralLink = useMemo(
    () => (userId && typeof window !== "undefined" ? `${window.location.origin}/register?ref=${userId}` : ""),
    [userId],
  );

  const copyLink = useCallback(async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link kimásolva");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Másolás sikertelen");
    }
  }, [referralLink]);

  const subscribedCount = useMemo(() => referrals.filter((r) => r.subscribed).length, [referrals]);

  if (!loading && !userId) {
    return (
      <div className="container mx-auto max-w-3xl py-10 px-4">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-muted-foreground">Az ajánlási oldal megtekintéséhez jelentkezz be.</p>
            <Button asChild>
              <Link to="/login">Bejelentkezés</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-10 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Gift className="h-6 w-6 text-brand" /> Ajánld az Archivai-t
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Oszd meg a linkedet, és minden előfizető ajánlott felhasználóért 1 hónap kreditet kapsz.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajánlási linked</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={referralLink}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <Button onClick={copyLink} variant="secondary" disabled={!referralLink}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "Másolva" : "Másol"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajánlott felhasználók</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Betöltés…"
              : `${referrals.length} embert ajánlottál eddig.${
                  subscribedCount > 0 ? ` Ebből ${subscribedCount} előfizetett.` : ""
                }`}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Betöltés…</div>
          ) : referrals.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Még nincs ajánlott felhasználód. Oszd meg a linkedet!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Regisztráció</TableHead>
                  <TableHead className="text-right">Státusz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">
                      {r.email}
                      {r.full_name ? (
                        <div className="text-xs text-muted-foreground">{r.full_name}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("hu-HU")}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.subscribed ? (
                        <Badge>Előfizetett</Badge>
                      ) : (
                        <Badge variant="secondary">Próbaidőszak</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
