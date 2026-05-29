import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Gift, Users, CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/referral")({
  head: () => ({
    meta: [
      { title: "Partneri program — Archivai" },
      {
        name: "description",
        content: "Ajánld az Archivai-t és szerezz ingyenes hónapokat.",
      },
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

    const loadReferrals = async (uid: string) => {
      const { data, error } = await (supabase.rpc as any)("get_referrals");
      if (cancelled) return;
      if (error) {
        toast.error("Nem sikerült betölteni az ajánlásokat");
        setReferrals([]);
      } else {
        setReferrals((data ?? []) as Referral[]);
      }
      setLoading(false);
    };

    const applySession = (uid: string | null) => {
      if (cancelled) return;
      setUserId(uid);
      if (uid) {
        void loadReferrals(uid);
      } else {
        setReferrals([]);
        setLoading(false);
      }
    };

    // Subscribe first so we don't miss the initial restore event.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user?.id ?? null);
    });

    // Kick off an initial session read (resolves once storage is hydrated).
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const referralLink = useMemo(
    () => (userId ? `https://archivai.hu/register?ref=${userId}` : ""),
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

  const subscribedCount = useMemo(
    () => referrals.filter((r) => r.subscribed).length,
    [referrals],
  );
  const freeMonths = subscribedCount;

  if (!loading && !userId) {
    return (
      <div className="container mx-auto max-w-3xl py-10 px-4">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-muted-foreground">
              Az ajánlási oldal megtekintéséhez jelentkezz be.
            </p>
            <Button asChild>
              <Link to="/login">Bejelentkezés</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const steps = [
    "Másold ki az egyedi linkedet lentebb",
    "Küldd el akinek szerinted hasznos lenne az Archivai",
    "Ők is 14 napos ingyenes próbával ismerkedhetnek meg a rendszersel",
    "Ha előfizetnek — az első hónapjuk ingyenes, te pedig automatikusan kapsz egy hónap jóváírást",
  ];

  return (
    <div className="container mx-auto max-w-4xl py-10 px-4 space-y-12">
      {/* SECTION 1 — Hero */}
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 text-brand">
          <Gift className="h-6 w-6" />
          <span className="text-sm font-medium uppercase tracking-wide">
            Partneri program
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Ajánld az Archivai-t — mindketten járjatok jól
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-3xl">
          Oszd meg az egyedi ajánló linkedet ismerőseiddel vagy ügyfeleiddel.
          Ha valaki a linked segítségével fizet elő, mindketten megkapjátok a
          következő hónapot ingyen — és ez minden egyes ajánlott után jár neked.
        </p>
      </section>

      {/* SECTION 2 — Steps */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Hogyan működik?</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {steps.map((s, i) => (
            <Card key={i} className="shadow-none">
              <CardContent className="flex gap-3 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand font-semibold text-sm">
                  {i + 1}
                </div>
                <p className="text-sm leading-relaxed">{s}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm italic text-muted-foreground">
          Nincs limit — minél többet ajánlasz, annál több ingyenes hónapot
          gyűjtesz. A jóváírás minden sikeres előfizetés után automatikusan
          aktiválódik.
        </p>
      </section>

      {/* SECTION 3 — Referral link */}
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
            <Button
              onClick={copyLink}
              variant="secondary"
              disabled={!referralLink}
            >
              {copied ? (
                <Check className="h-4 w-4 mr-1" />
              ) : (
                <Copy className="h-4 w-4 mr-1" />
              )}
              {copied ? "Másolva" : "Másol"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 4 — Stats */}
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <StatBox
            icon={<Users className="h-5 w-5" />}
            label="Ajánlott felhasználók"
            value={referrals.length}
          />
          <StatBox
            icon={<CreditCard className="h-5 w-5" />}
            label="Előfizetett"
            value={subscribedCount}
          />
          <StatBox
            icon={<Sparkles className="h-5 w-5" />}
            label="Megszerzett ingyenes hónapok"
            value={freeMonths}
          />
        </div>
        {!loading && (
          <p className="text-sm text-center text-muted-foreground">
            Eddig ajánlottál{" "}
            <span className="font-semibold text-foreground">
              {referrals.length}
            </span>{" "}
            ismerőst, ebből{" "}
            <span className="font-semibold text-foreground">
              {subscribedCount}
            </span>{" "}
            fő fizetett elő — ez{" "}
            <span className="font-semibold text-foreground">{freeMonths}</span>{" "}
            hónap ingyenes előfizetést jelent számodra 🎉
          </p>
        )}
      </section>

      {/* SECTION 5 — Referred users list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajánlott felhasználók</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Betöltés…
            </div>
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
                        <div className="text-xs text-muted-foreground">
                          {r.full_name}
                        </div>
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

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center gap-2 text-brand">{icon}</div>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
