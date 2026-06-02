import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Archive } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hashChecked, setHashChecked] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      setError("Érvénytelen vagy lejárt visszaállítási link. Kérj újat a bejelentkezési oldalon.");
    }
    setHashChecked(true);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("A jelszavak nem egyeznek.");
      return;
    }
    if (password.length < 6) {
      setError("A jelszónak legalább 6 karakter hosszúnak kell lennie.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a jelszó módosításakor.");
    } finally {
      setLoading(false);
    }
  };

  if (!hashChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md p-8 shadow-lg text-center">
          <p className="text-muted-foreground">Betöltés...</p>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md p-8 shadow-lg text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-lg bg-brand flex items-center justify-center">
              <Archive className="h-5 w-5 text-brand-foreground" />
            </div>
          </div>
          <h2 className="text-2xl font-bold">Jelszó módosítva</h2>
          <p className="text-sm text-muted-foreground">
            A jelszavad sikeresen megváltozott. Most már bejelentkezhetsz az új jelszavaddal.
          </p>
          <Button className="w-full" onClick={() => { window.location.href = "/login"; }}>
            Bejelentkezés
          </Button>
        </Card>
      </div>
    );
  }

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

        <h2 className="text-2xl font-bold mb-1">Új jelszó megadása</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Add meg az új jelszavadat.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Új jelszó</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Jelszó megerősítése</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Folyamatban..." : "Jelszó módosítása"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
