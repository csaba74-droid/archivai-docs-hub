import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, User as UserIcon, CreditCard, Shield, Loader2, AlertTriangle, FileText, Lock } from "lucide-react";
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
  const isVallalati = subscription?.plan === "vallalati";
  const [navTaxNumber, setNavTaxNumber] = useState("");
  const [navUsername, setNavUsername] = useState("");
  const [navPassword, setNavPassword] = useState("");
  const [navSignatureKey, setNavSignatureKey] = useState("");
  const [navExchangeKey, setNavExchangeKey] = useState("");
  const [navSaving, setNavSaving] = useState(false);
  const [navTesting, setNavTesting] = useState(false);

  const saveNav = async () => {
    if (!/^\d{8}-\d-\d{2}$/.test(navTaxNumber)) {
      toast.error("Érvénytelen adószám", { description: "Formátum: 12345678-1-23" });
      return;
    }
    if (!navUsername || !navPassword || !navSignatureKey || !navExchangeKey) {
      toast.error("Hiányzó mezők", { description: "Töltsön ki minden mezőt." });
      return;
    }
    setNavSaving(true);
    const { data: u, error: userErr } = await supabase.auth.getUser();
    console.log("[NAV save] auth.getUser:", { user: u?.user?.id, userErr });
    if (!u.user) {
      setNavSaving(false);
      toast.error("Nincs bejelentkezve");
      return;
    }
    const payload = {
      user_id: u.user.id,
      adoszam: navTaxNumber,
      technical_username: navUsername,
      password: navPassword,
      signature_key: navSignatureKey,
      exchange_key: navExchangeKey,
    };
    console.log("[NAV save] upserting payload:", payload);
    const { data: upsertData, error } = await supabase
      .from("nav_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select();
    console.log("[NAV save] upsert result:", { upsertData, error });
    setNavSaving(false);
    if (error) {
      console.error("[NAV save] error:", error);
      toast.error("Mentési hiba", { description: error.message });
      return;
    }
    toast.success("NAV beállítások mentve");
  };

  const testNav = async () => {
    setNavTesting(true);
    try {
      const { data: u, error: userErr } = await supabase.auth.getUser();
      if (userErr || !u.user) {
        toast.error("Nincs bejelentkezve");
        return;
      }
      const { data, error } = await supabase.functions.invoke("nav-sync", {
        body: { userId: u.user.id },
      });
      if (error) {
        toast.error("Kapcsolódási hiba", {
          description: error.message,
          className: "text-destructive",
        });
        return;
      }
      const count = (data as { count?: number } | null)?.count ?? 0;
      toast.success(`Kapcsolat sikeres! ${count} számla található az elmúlt 30 napban.`);
    } catch (e) {
      toast.error("Kapcsolódási hiba", {
        description: e instanceof Error ? e.message : String(e),
        className: "text-destructive",
      });
    } finally {
      setNavTesting(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("nav_settings")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (data) {
        setNavTaxNumber(data.adoszam ?? "");
        setNavUsername(data.technical_username ?? "");
        setNavPassword((data as { password?: string }).password ?? "");
        setNavSignatureKey(data.signature_key ?? "");
        setNavExchangeKey(data.exchange_key ?? "");
      }
    })();
  }, []);

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
        <BackButton />
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-lg font-bold">
                {subscription ? PLAN_INFO[subscription.plan].label : "—"}
              </span>
              <Badge variant={active ? "secondary" : "destructive"}>
                {subscription?.status === "active" ? "Aktív"
                  : subscription?.status === "trialing" ? "Próbaidőszak"
                  : subscription?.status === "past_due" ? "Fizetés esedékes"
                  : subscription?.status === "canceled" ? "Lemondva" : "Inaktív"}
              </Badge>
              <span className="text-sm text-muted-foreground ml-auto">
                {subscription ? PLAN_INFO[subscription.plan].priceLabel : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" asChild>
                <Link to="/subscription">Csomagok megtekintése</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => setChangePlanOpen(true)}
                disabled={!canChangePlan}
              >
                Csomag váltása
              </Button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              disabled={!canCancel}
              className="inline-flex items-center gap-1.5 text-xs text-destructive/80 hover:text-destructive hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {canCancel ? "Előfizetés felmondása" : "Előfizetés felmondva"}
            </button>
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

        {/* NAV API integráció */}
        <Card id="nav" className="p-6 scroll-mt-20">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-brand" />
            <h2 className="text-base font-semibold">NAV számlaadatok importálása</h2>
            {!isVallalati && (
              <Badge variant="secondary" className="ml-auto gap-1">
                <Lock className="h-3 w-3" /> Vállalati
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Adja meg NAV Online Számla rendszer technikai felhasználójának adatait az automatikus számla letöltéshez. Az adatok titkosítva kerülnek tárolásra.
          </p>

          {!isVallalati ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center space-y-3">
              <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="text-sm">
                A NAV számlaadatok importálása csak <strong>Vállalati</strong> csomaggal érhető el.
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/subscription">Csomag frissítése</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="navTaxNumber">Adószám</Label>
                <Input
                  id="navTaxNumber"
                  value={navTaxNumber}
                  onChange={(e) => setNavTaxNumber(e.target.value)}
                  placeholder="12345678-1-23"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="navUsername">NAV technikai felhasználónév</Label>
                <Input
                  id="navUsername"
                  value={navUsername}
                  onChange={(e) => setNavUsername(e.target.value)}
                  placeholder="pl. abc123xyz"
                  autoComplete="off"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="navPassword">NAV jelszó</Label>
                <Input
                  id="navPassword"
                  type="password"
                  value={navPassword}
                  onChange={(e) => setNavPassword(e.target.value)}
                  autoComplete="off"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="navSignatureKey">Aláírási kulcs (signatureKey)</Label>
                <Input
                  id="navSignatureKey"
                  type="password"
                  value={navSignatureKey}
                  onChange={(e) => setNavSignatureKey(e.target.value)}
                  autoComplete="off"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="navExchangeKey">Titkosítási kulcs (exchangeKey)</Label>
                <Input
                  id="navExchangeKey"
                  type="password"
                  value={navExchangeKey}
                  onChange={(e) => setNavExchangeKey(e.target.value)}
                  autoComplete="off"
                  className="mt-1"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={saveNav} disabled={navSaving}>
                  {navSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Mentés
                </Button>
                <Button variant="outline" onClick={testNav} disabled={navTesting}>
                  {navTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Kapcsolat tesztelése
                </Button>
              </div>
            </div>
          )}
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
