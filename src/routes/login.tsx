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
  component: () => <AuthPage initialMode="login" />,
});

export function AuthPage({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, company },
          },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName,
            company,
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
      navigate({ to: "/" });
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
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
