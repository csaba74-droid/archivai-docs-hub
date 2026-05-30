import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArrowLeft, Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/kapcsolat")({
  head: () => ({
    meta: [
      { title: "Kapcsolat — Archivai" },
      {
        name: "description",
        content: "Vedd fel velünk a kapcsolatot e-mailben vagy telefonon.",
      },
    ],
  }),
  component: KapcsolatPage,
});

function KapcsolatPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
              <Archive className="h-4 w-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-brand">Archivai</span>
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Vissza
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">
          Kapcsolat
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Kérdésed van? Írj nekünk e-mailben vagy hívj minket telefonon.
        </p>

        <div className="mt-10 space-y-4">
          <a
            href="mailto:kapcsolat@archivai.hu"
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-brand hover:bg-secondary/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand/10 text-brand">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                E-mail
              </div>
              <div className="text-base font-semibold text-foreground">
                kapcsolat@archivai.hu
              </div>
            </div>
          </a>

          <a
            href="tel:+36205590559"
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-brand hover:bg-secondary/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand/10 text-brand">
              <Phone className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Telefon
              </div>
              <div className="text-base font-semibold text-foreground">
                06 20 559-0-559
              </div>
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}
