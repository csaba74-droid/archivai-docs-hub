import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, User as UserIcon, CreditCard, Shield, Loader2, AlertTriangle, Receipt, Bell, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase, type ProfileRow } from "@/lib/supabase";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { GdprExportButton } from "@/components/GdprExportButton";
import { CancelSubscriptionDialog } from "@/components/CancelSubscriptionDialog";
import { ChangePlanDialog } from "@/components/ChangePlanDialog";
import { BackButton } from "@/components/BackButton";
import { deleteAccount } from "@/lib/account.functions";

type NotificationSettings = {
  incoming_document: boolean;
  trial_expiry: boolean;
  shared_upload: boolean;
};
const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  incoming_document: true,
  trial_expiry: true,
  shared_upload: true,
};

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
  const [billingName, setBillingName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [savingBilling, setSavingBilling] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const deleteAccountFn = useServerFn(deleteAccount);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const isVallalati = subscription?.plan === "vallalati";

  const [memberCount, setMemberCount] = useState<{ total: number; accepted: number }>({ total: 0, accepted: 0 });
  useEffect(() => {
    if (!isVallalati) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("shared_access")
        .select("status")
        .eq("owner_user_id", u.user.id);
      const rows = (data ?? []) as { status: string }[];
      const active = rows.filter((r) => r.status !== "revoked");
      setMemberCount({
        total: active.length,
        accepted: active.filter((r) => r.status === "accepted").length,
      });
    })();
  }, [isVallalati]);

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
      const row = p as (ProfileRow & { billing_name?: string | null; billing_address?: string | null; tax_number?: string | null; notification_settings?: Partial<NotificationSettings> | null }) | null;
      setFullName(row?.full_name ?? "");
      setCompany(row?.company ?? "");
      setBillingName(row?.billing_name ?? "");
      setBillingAddress(row?.billing_address ?? "");
      setTaxNumber(row?.tax_number ?? "");
      setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(row?.notification_settings ?? {}) });
      setProfileLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (window.location.hash === "#billing-section") {
      const el = document.getElementById("billing-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  const saveBilling = async () => {
    setSavingBilling(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: u.user.id,
        billing_name: billingName || null,
        billing_address: billingAddress || null,
        tax_number: taxNumber || null,
      });
    setSavingBilling(false);
    if (error) {
      toast.error("Mentési hiba", { description: error.message });
      return;
    }
    toast.success("Számlázási adatok mentve");
  };

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
    if (!currentPassword) {
      toast.error("Add meg a jelenlegi jelszót");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Jelszó túl rövid", { description: "Legalább 8 karakter szükséges" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A jelszavak nem egyeznek");
      return;
    }
    setChangingPassword(true);
    // Verify current password by attempting a sign-in.
    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.email) {
      setChangingPassword(false);
      toast.error("Nincs bejelentkezve");
      return;
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: u.user.email,
      password: currentPassword,
    });
    if (signInErr) {
      setChangingPassword(false);
      toast.error("Hibás jelenlegi jelszó");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error("Hiba", { description: error.message });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Jelszó megváltoztatva");
  };

  const saveNotifications = async (next: NotificationSettings) => {
    setNotifications(next);
    setSavingNotifications(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSavingNotifications(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: u.user.id, notification_settings: next } as never);
    setSavingNotifications(false);
    if (error) {
      toast.error("Mentési hiba", { description: error.message });
      return;
    }
    toast.success("Értesítési beállítások mentve");
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await deleteAccountFn();
      if (!res.ok) {
        toast.error("Törlési hiba", { description: res.error });
        return;
      }
      toast.success("Fiók törölve");
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (e) {
      toast.error("Törlési hiba", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setDeletingAccount(false);
      setDeleteOpen(false);
    }
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

        {/* Billing info */}
        <Card className="p-6" id="billing-section">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="h-5 w-5 text-brand" />
            <h2 className="text-base font-semibold">Számlázási adatok</h2>
          </div>
          {profileLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Betöltés…
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="billingName">Számlázási név</Label>
                <Input
                  id="billingName"
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                  placeholder="pl. Példa Kft."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="billingAddress">Számlázási cím</Label>
                <Input
                  id="billingAddress"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="pl. 1011 Budapest, Fő utca 1."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="taxNumber">Adószám</Label>
                <Input
                  id="taxNumber"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  placeholder="pl. 12345678-1-23"
                  className="mt-1"
                />
              </div>
              <Button onClick={saveBilling} disabled={savingBilling}>
                {savingBilling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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

        {/* Password change */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-brand" />
            <h2 className="text-base font-semibold">Jelszó módosítása</h2>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Jelenlegi jelszó</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1"
              />
            </div>
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
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Jelszó mentése
            </Button>
          </div>
        </Card>

        {/* Workspace members — Vállalati only */}
        {isVallalati && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold">Munkaterület tagok</h2>
              <Badge variant="secondary" className="ml-auto">
                {memberCount.total} / 5 aktív
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Hívj meg legfeljebb 5 munkatársat e-mailben. A meghívottak a kiválasztott
              kategóriák tartalmát látják (Olvasó), vagy fel is tölthetnek (Szerkesztő).
              Minden műveletet a közös audit napló rögzít.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link to="/sharing">Tagok kezelése</Link>
              </Button>
              <span className="text-xs text-muted-foreground">
                {memberCount.accepted} elfogadta a meghívót
              </span>
            </div>
          </Card>
        )}

        {/* Notification settings */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-brand" />
            <h2 className="text-base font-semibold">Értesítési beállítások</h2>
          </div>
          {profileLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Betöltés…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-incoming" className="text-sm font-medium">Beérkező dokumentum értesítő</Label>
                  <p className="text-xs text-muted-foreground">Email értesítés új beérkezett dokumentumról.</p>
                </div>
                <Switch
                  id="notif-incoming"
                  checked={notifications.incoming_document}
                  disabled={savingNotifications}
                  onCheckedChange={(v) => saveNotifications({ ...notifications, incoming_document: v })}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-trial" className="text-sm font-medium">Próbaidőszak lejárat értesítő</Label>
                  <p className="text-xs text-muted-foreground">Emlékeztető a próbaidőszak vége előtt.</p>
                </div>
                <Switch
                  id="notif-trial"
                  checked={notifications.trial_expiry}
                  disabled={savingNotifications}
                  onCheckedChange={(v) => saveNotifications({ ...notifications, trial_expiry: v })}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-shared" className="text-sm font-medium">Megosztott mappába feltöltés értesítő</Label>
                  <p className="text-xs text-muted-foreground">Értesítés, ha valaki feltölt egy önnel megosztott mappába.</p>
                </div>
                <Switch
                  id="notif-shared"
                  checked={notifications.shared_upload}
                  disabled={savingNotifications}
                  onCheckedChange={(v) => saveNotifications({ ...notifications, shared_upload: v })}
                />
              </div>
            </div>
          )}
        </Card>


        {/* Account deletion */}
        <Card className="p-6 border-destructive/40">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <h2 className="text-base font-semibold text-destructive">Fiók törlése</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            A fiók és az összes hozzá tartozó adat (dokumentumok, kategóriák, megosztások, előfizetés) véglegesen törlésre kerül. Ez a művelet nem visszavonható.
          </p>
          <Button variant="destructive" onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 mr-2" />
            Fiók végleges törlése
          </Button>
        </Card>
      </main>


      <CancelSubscriptionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        currentPlan={subscription?.plan ?? null}
      />

      <ChangePlanDialog open={changePlanOpen} onOpenChange={setChangePlanOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Biztosan törlöd a fiókod?</AlertDialogTitle>
            <AlertDialogDescription>
              Ez a művelet véglegesen törli a fiókodat és minden hozzá tartozó adatot
              (dokumentumok, kategóriák, megosztások, előfizetés). A művelet nem visszavonható.
              <br /><br />
              A megerősítéshez írd be: <strong>TÖRLÉS</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="TÖRLÉS"
            autoComplete="off"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
              disabled={deleteConfirm !== "TÖRLÉS" || deletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Fiók törlése
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
