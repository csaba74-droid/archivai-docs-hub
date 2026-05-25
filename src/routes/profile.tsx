import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, User as UserIcon, CreditCard, Shield, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase, type ProfileRow } from "@/lib/supabase";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { GdprExportButton } from "@/components/GdprExportButton";
import { CancelSubscriptionDialog } from "@/components/CancelSubscriptionDialog";
import { ChangePlanDialog } from "@/components/ChangePlanDialog";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profil & Beállítások — Archivai" },
      { name: "description", content: "Felhasználói adatok, előfizetés és biztonsági beállítások." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { subscription, active } = useSubscription();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const canCancel = subscription?.status !== "canceled";
  const canChangePlan = subscription?.status === "active" && !!subscription?.stripe_subscription_id;

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      const row = p as ProfileRow | null;
      setFullName(row?.full_name ?? "");
      setCompany(row?.company ?? "");
      setProfileLoading(false);
    })();
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: u.user.id, full_name: fullName || null, company: company || null });
    setSavingProfile(false);
    if (error) {
      console.error(error);
      toast.error("Mentési hiba", { description: error.message });
      return;
    }
    toast.success("Profil mentve");
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Jelszó túl rövid", { description: "Legalább 8 karakter szükséges" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A jelszavak nem egyeznek");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error("Hiba", { description: error.message });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Jelszó megváltoztatva");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Vissza
        </Button>
        <h1 className="text-lg font-semibold">Profil & Beállítások</h1>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
        {/* User data */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserIcon className="h-5 w-5 text-brand" />
            <h2 className="text-base font-semibold">Felhasználói adatok</h2>
          </div>
          {profileLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Betöltés…
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} disabled className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Az email cím nem módosítható.</p>
              </div>
              <div>
                <Label htmlFor="fullName">Teljes név</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="pl. Kovács János"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="company">Cégnév (opcionális)</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="pl. Példa Kft."
                  className="mt-1"
                />
              </div>
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Mentés
              </Button>
            </div>
          )}
        </Card>

        {/* Subscription */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-brand" />
            <h2 className="text-base font-semibold">Előfizetés</h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  {subscription ? PLAN_INFO[subscription.plan].label : "—"}
                </span>
                <Badge variant={active ? "secondary" : "destructive"}>
                  {subscription?.status === "active" ? "Aktív"
                    : subscription?.status === "trialing" ? "Próbaidőszak"
                    : subscription?.status === "past_due" ? "Fizetés esedékes"
                    : subscription?.status === "canceled" ? "Lemondva" : "Inaktív"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {subscription ? PLAN_INFO[subscription.plan].priceLabel : ""}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link to="/subscription">Csomagok megtekintése</Link>
              </Button>
              {canChangePlan && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setChangePlanOpen(true)}
                >
                  Csomag váltása
                </Button>
              )}
            </div>
          </div>

          {/* Cancel subscription — always visible below plan info */}
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={!canCancel}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <XCircle className="h-4 w-4 mr-2" /> Előfizetés felmondása
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {canCancel
                ? "Az előfizetés felmondása után adatai megmaradnak az aktuális időszak végéig."
                : "Az előfizetés már fel van mondva."}
            </p>
          </div>

          <div className="pt-6 mt-4 border-t">
            <h3 className="text-sm font-semibold mb-2">Adataim exportálása</h3>
            <GdprExportButton />
          </div>
        </Card>

        {/* Security */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-brand" />
            <h2 className="text-base font-semibold">Biztonsági beállítások</h2>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Új jelszó</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Legalább 8 karakter"
                autoComplete="new-password"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Új jelszó megerősítése</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1"
              />
            </div>
            <Button
              onClick={changePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}
            >
              {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Jelszó megváltoztatása
            </Button>
          </div>
        </Card>
      </main>

      <CancelSubscriptionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        currentPlan={subscription?.plan ?? null}
      />

      <ChangePlanDialog open={changePlanOpen} onOpenChange={setChangePlanOpen} />
    </div>
  );
}
