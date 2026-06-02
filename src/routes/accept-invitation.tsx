import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Archive, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { BUILT_IN_CATEGORIES } from "@/lib/categories";
import { acceptInvitation } from "@/lib/invitations.functions";

export const Route = createFileRoute("/accept-invitation")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: AcceptInvitationPage,
});

type Invitation = {
  id: string;
  owner_user_id: string;
  invited_email: string;
  invited_user_id: string | null;
  categories: string[];
  status: "pending" | "active" | "revoked";
};

function categoryLabel(id: string) {
  const found = BUILT_IN_CATEGORIES.find((c) => c.id === id);
  return found?.label ?? id;
}

function AcceptInvitationPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [ownerName, setOwnerName] = useState<string>("Egy felhasználó");
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (!token) {
        setError("Hiányzó meghívó token");
        setLoading(false);
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      if (cancelled) return;
      setUserEmail(u.user?.email ?? null);

      console.log("Token from URL:", token);
      try {
        const { data: inv, error } = await supabase
          .from("shared_access")
          .select("*")
          .eq("id", token)
          .maybeSingle();
        console.log("Query result:", inv, error);
        if (cancelled) return;
        if (error) throw new Error(error.message);
        if (!inv) {
          setError("Érvénytelen vagy lejárt meghívó");
        } else {
          setInvitation(inv as Invitation);
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Érvénytelen vagy lejárt meghívó",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const loginWithRedirect = `/login?redirect=${encodeURIComponent(
    `/accept-invitation?token=${token}`,
  )}`;

  const handleAccept = async () => {
    if (!invitation) return;
    setAccepting(true);
    try {
      // Refresh the session so the bearer token sent to the server is
      // signed with the current JWT signing key (avoids "unrecognized kid"
      // 403s after Supabase rotated the signing key).
      await supabase.auth.refreshSession().catch(() => null);
      await acceptInvitation({ data: { token: invitation.id } });
      toast.success("Meghívó elfogadva");
      navigate({ to: "/dashboard" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ismeretlen hiba";
      toast.error("Sikertelen elfogadás", { description: msg });
      // If the session is truly stale, sign out and bounce to login with redirect
      if (/munkamenet|Unauthorized|token|JWT/i.test(msg)) {
        await supabase.auth.signOut().catch(() => null);
        window.location.href = loginWithRedirect;
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await supabase.auth.signOut().catch(() => null);
    window.location.href = loginWithRedirect;
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#1A2B4A" }}
          >
            <Archive className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Archivai</h1>
            <p className="text-xs text-muted-foreground">Dokumentumarchiválás</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center space-y-4 py-4">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">{error}</h2>
            <p className="text-sm text-muted-foreground">
              Kérd meg a meghívót küldő felhasználót, hogy küldjön egy újat.
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                Bejelentkezés
              </Button>
            </Link>
          </div>
        ) : invitation?.status === "active" ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: "#0F6E56" }} />
            <h2 className="text-lg font-semibold">Már elfogadta ezt a meghívót</h2>
            <Link to="/dashboard">
              <Button className="w-full" style={{ backgroundColor: "#1A2B4A" }}>
                Tovább a dokumentumokhoz
              </Button>
            </Link>
          </div>
        ) : invitation?.status === "revoked" ? (
          <div className="text-center space-y-4 py-4">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Ez a meghívó visszavonásra került</h2>
          </div>
        ) : invitation ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold leading-snug">
                <span style={{ color: "#1A2B4A" }}>{ownerName}</span> meghívta Önt az
                Archivai rendszerbe
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Elfogadás után hozzáférést kap az alábbi dokumentumkategóriákhoz:
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {invitation.categories.length === 0 ? (
                <span className="text-xs text-muted-foreground">Nincs kategória</span>
              ) : (
                invitation.categories.map((cid) => (
                  <span
                    key={cid}
                    className="text-xs px-2.5 py-1 rounded font-medium border"
                    style={{
                      backgroundColor: "#1A2B4A0d",
                      color: "#1A2B4A",
                      borderColor: "#1A2B4A33",
                    }}
                  >
                    {categoryLabel(cid)}
                  </span>
                ))
              )}
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Meghívott email: <strong>{invitation.invited_email}</strong>
            </div>

            {userEmail ? (
              <>
                {userEmail.toLowerCase() !== invitation.invited_email.toLowerCase() && (
                  <p className="text-xs text-amber-700">
                    Figyelem: Ön <strong>{userEmail}</strong> címmel van bejelentkezve,
                    de a meghívó a(z) <strong>{invitation.invited_email}</strong> címre
                    érkezett.
                  </p>
                )}
                <Button
                  className="w-full"
                  style={{ backgroundColor: "#1A2B4A" }}
                  onClick={handleAccept}
                  disabled={accepting}
                >
                  {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Meghívó elfogadása
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  A meghívó elfogadásához jelentkezzen be vagy regisztráljon.
                </p>
                <a href={loginWithRedirect}>
                  <Button className="w-full" style={{ backgroundColor: "#1A2B4A" }}>
                    Bejelentkezés
                  </Button>
                </a>
                <a href={loginWithRedirect}>
                  <Button variant="outline" className="w-full">
                    Regisztráció
                  </Button>
                </a>
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
