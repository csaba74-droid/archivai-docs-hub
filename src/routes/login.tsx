import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Archive } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "",
  }),
  component: LoginPage,
});

function safeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function LoginPage() {
  const { redirect } = Route.useSearch();
  return <AuthPage initialMode="login" redirectTo={redirect} />;
}

export function AuthPage({
  initialMode = "login",
  redirectTo,
}: {
  initialMode?: "login" | "register";
  redirectTo?: string;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTarget = safeRedirectPath(
    redirectTo ??
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("redirect")
        : null),
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = redirectTarget;
    });
  }, [redirectTarget]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "register" && !acceptedTerms) {
      setError("A regisztrációhoz el kell fogadnod az ÁSZF feltételeit.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        // Read referral code from URL (?ref=USER_ID) or sessionStorage fallback
        // (landing page stores it there when user clicks "Kipróbálom ingyen")
        let referredBy: string | null = null;
        try {
          const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const params = new URLSearchParams(window.location.search);
          const ref = params.get("ref");
          if (ref && uuidRe.test(ref)) {
            referredBy = ref;
          } else {
            const stored = sessionStorage.getItem("ref") || localStorage.getItem("ref");
            if (stored && uuidRe.test(stored)) referredBy = stored;
          }
        } catch {
          referredBy = null;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTarget}`,
            data: { full_name: fullName, company, referred_by: referredBy },
          },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName,
            company,
            referred_by: referredBy,
          });
          // Fallback: create trial subscription client-side in case the
          // signup trigger isn't installed. RLS allows users to insert
          // their own row; ON CONFLICT in trigger handles duplicates.
          const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
          const { error: subErr } = await supabase.from("subscriptions").insert({
            user_id: data.user.id,
            plan: "alap",
            status: "trialing",
            trial_end: trialEnd,
            current_period_end: trialEnd,
          });
          if (subErr) console.warn("[signup] trial subscription insert:", subErr.message);
        }
      } else {

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      window.location.href = redirectTarget;
    } catch (err: any) {
      setError(err.message ?? "Hiba történt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-lg bg-brand flex items-center justify-center">
            <Archive className="h-5 w-5 text-brand-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Archivai</h1>
            <p className="text-xs text-muted-foreground">Dokumentumarchiválás</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-1">
          {mode === "login" ? "Bejelentkezés" : "Regisztráció"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login"
            ? "Lépj be a fiókodba a folytatáshoz"
            : "Hozz létre új fiókot"}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name">Teljes név</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Cég</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Jelszó</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          {mode === "register" && (
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(v) => setAcceptedTerms(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-snug cursor-pointer">
                Elolvastam és elfogadom az{" "}
                <a
                  href="/aszf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline hover:no-underline"
                >
                  ÁSZF
                </a>{" "}
                feltételeit
              </Label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (mode === "register" && !acceptedTerms)}
          >
            {loading ? "Folyamatban..." : mode === "login" ? "Bejelentkezés" : "Regisztráció"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "login" ? "Nincs még fiókod? Regisztrálj" : "Van fiókod? Jelentkezz be"}
        </button>
      </Card>
    </div>
  );
}
