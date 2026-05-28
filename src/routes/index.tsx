import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Archive,
  FolderCheck,
  ShieldCheck,
  Search,
  Lock,
  ClipboardList,
  Check,
  ArrowRight,
  Menu,
  X,
  Calculator,
  Store,
  Wrench,
  Home,
  Briefcase,
  User,
  FileText,
  Image as ImageIcon,
  Folder,
} from "lucide-react";
import heroImage from "@/assets/hero-archivai.png";
import { CookieConsent } from "@/components/CookieConsent";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Archivai – Digitális dokumentumarchiváló rendszer" },
      {
        name: "description",
        content:
          "Az Archivai automatikusan kategorizálja és biztonságosan archiválja céges dokumentumait a hatályos megőrzési szabályok szerint. 14 napos ingyenes próba.",
      },
      { property: "og:title", content: "Archivai – Digitális dokumentumarchiváló rendszer" },
      {
        property: "og:description",
        content:
          "Az Archivai automatikusan kategorizálja és biztonságosan archiválja céges dokumentumait a hatályos megőrzési szabályok szerint. 14 napos ingyenes próba.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [refParam, setRefParam] = useState<string | null>(null);

  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
        setRefParam(ref);
        sessionStorage.setItem("archivai_ref", ref);
      } else {
        const stored = sessionStorage.getItem("archivai_ref");
        if (stored) setRefParam(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const goRegister = () =>
    navigate({ to: "/register", search: refParam ? { ref: refParam } : undefined });


  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (checking) {
    return <div className="min-h-screen bg-background" />;
  }

  const navLinks = [
    { href: "#funkciok", label: "Funkciók" },
    { href: "#hogyan", label: "Hogyan működik?" },
    { href: "#arazas", label: "Árazás" },
    { href: "#kapcsolat", label: "Kapcsolat" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header
        className={`sticky top-0 z-50 w-full bg-background/90 backdrop-blur transition-shadow ${
          scrolled ? "shadow-sm border-b border-border" : ""
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
              <Archive className="h-4 w-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-brand">Archivai</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-brand"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/login" })}
              className="border-brand/20 text-brand hover:bg-brand-soft"
            >
              Belépés
            </Button>
            <Button
              onClick={() => goRegister()}
              className="bg-brand text-brand-foreground hover:bg-brand-hover"
            >
              Kipróbálom ingyen
            </Button>
          </div>

          <button
            className="inline-flex items-center justify-center rounded-md p-2 text-brand md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menü"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-background md:hidden">
            <div className="space-y-1 px-4 py-3">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-brand"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/login" })}
                  className="border-brand/20 text-brand"
                >
                  Belépés
                </Button>
                <Button
                  onClick={() => goRegister()}
                  className="bg-brand text-brand-foreground"
                >
                  Kipróbálom ingyen
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-4 pb-16 pt-0 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-24 lg:pt-0">
          <div className="self-start pt-0 mt-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              <ShieldCheck className="h-3.5 w-3.5" />
              Törvényi előírás szerint archiválva
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-brand sm:text-5xl lg:text-6xl">
              A dokumentumai megvannak — de találja is meg őket.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Az Archivai automatikusan kategorizálja és biztonságosan archiválja
              céges dokumentumait a hatályos megőrzési szabályok szerint.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => goRegister()}
                className="bg-brand text-brand-foreground hover:bg-brand-hover"
              >
                Kipróbálom ingyen <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-brand/20 text-brand hover:bg-brand-soft"
              >
                <a href="#hogyan">Hogyan működik?</a>
              </Button>
            </div>
            <ul className="mt-7 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {[
                "14 napos ingyenes próba",
                "Kártyaadat nélkül",
                "EU-s szervereken",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-brand" />
                  {t}
                </li>
              ))}
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand" />
                Kettős szerveres védelem
              </li>
            </ul>
          </div>

          <div className="relative self-start">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-brand-soft/60 blur-2xl" />
            <img
              src={heroImage}
              alt="Rendetlen papírhalom és a rendezett Archivai felület"
              className="w-full rounded-2xl border border-border shadow-xl"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      {/* FEATURES */}
      <section id="funkciok" className="bg-secondary/60 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold tracking-tight text-brand sm:text-3xl">
            Iratkezelés és törvényi iratmegőrzés — egy helyen
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: FolderCheck,
                title: "Automatikus rendezés",
                text: "Feltöltés után azonnal felismeri és a megfelelő kategóriába helyezi dokumentumait — számlák, szerződések, szállítólevelek és még sok más.",
              },
              {
                icon: ShieldCheck,
                title: "Törvényi megfelelőség",
                text: "Dokumentumai az 1/2018. ITM rendelet szerint kerülnek archiválásra. Integritás védelem, audit napló, megőrzési határidők — automatikusan.",
              },
              {
                icon: Search,
                title: "Azonnali visszakeresés",
                text: "Másodpercek alatt megtalálja bármely iratát — akár elírással is. Teljes szöveges keresés a dokumentumok tartalmában.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-3 text-base font-semibold text-brand">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="bg-brand py-8 text-brand-foreground">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div className="md:max-w-sm">
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                Kettős szerveres biztonság
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-brand-foreground/80">
                Két független EU-s adatközpont — folyamatos elérhetőség és maximális biztonság.
              </p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 md:w-auto md:flex-1 md:max-w-2xl">
              {[
                { icon: Lock, text: "SHA-256 integritás" },
                { icon: ShieldCheck, text: "EU adatközpontok (Frankfurt + Ireland)" },
                { icon: ClipboardList, text: "Teljes audit napló" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-foreground/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-xs text-brand-foreground/90">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="hogyan" className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold tracking-tight text-brand sm:text-3xl">
            Három lépés és kész
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Feltöltés",
                text: "Töltse fel dokumentumait számítógépéről, vagy szkennelје be telefonnal egyetlen gombnyomással.",
              },
              {
                n: "02",
                title: "Automatikus rendezés",
                text: "A rendszer felismeri a dokumentum típusát és a megfelelő kategóriába helyezi. Bizonytalan esetben megkérdezi.",
              },
              {
                n: "03",
                title: "Megtalálja bármikor",
                text: "Szabadszavas kereséssel másodpercek alatt visszakereshető bármely irat — törvényileg védve, biztonságosan tárolva.",
              },
            ].map((s) => (
              <div key={s.n} className="relative rounded-xl border border-border bg-background p-5">
                <span className="text-xs font-semibold tracking-widest text-brand/50">
                  {s.n}
                </span>
                <h3 className="mt-1 text-base font-semibold text-brand">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* AUDIENCE */}
      <AudienceSection />



      {/* PRICING */}
      <section id="arazas" className="bg-secondary/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">
              Átlátható árazás
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              14 napos ingyenes próba — előfizetés esetén minden addig
              feltöltött dokumentuma automatikusan megmarad.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                name: "ALAP",
                price: "2 990",
                yearly: "30 490",
                features: [
                  "5 GB tárhely",
                  "200 dokumentum/hó",
                  "1 meghívott felhasználó",
                  "3 egyéni kategória",
                  "AI kategorizálás",
                  "Audit napló",
                ],
                cta: "Kipróbálom ingyen",
                highlight: false,
              },
              {
                name: "PRO",
                price: "4 990",
                yearly: "50 890",
                features: [
                  "25 GB tárhely",
                  "500 dokumentum/hó",
                  "3 meghívott felhasználó",
                  "10 egyéni kategória",
                  "AI kategorizálás",
                  "Audit napló",
                  "Archivai postafiók",
                ],
                cta: "Kipróbálom ingyen",
                highlight: true,
              },
              {
                name: "VÁLLALATI",
                price: "9 990",
                yearly: "101 890",
                features: [
                  "100 GB tárhely",
                  "Korlátlan dokumentum",
                  "Korlátlan meghívott felhasználó",
                  "Korlátlan egyéni kategória",
                  "Minden Pro funkció",
                  "NAV API integráció",
                  "Prioritás support",
                ],
                cta: "Kipróbálom ingyen",
                highlight: false,
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl border bg-background p-7 shadow-sm ${
                  p.highlight
                    ? "border-brand shadow-lg ring-1 ring-brand/20 lg:-mt-4 lg:mb-[-1rem]"
                    : "border-border"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
                    Ajánlott
                  </span>
                )}
                <h3 className="text-sm font-semibold tracking-widest text-brand/70">
                  {p.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-brand">{p.price}</span>
                  <span className="text-sm text-muted-foreground">Ft/hó</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Éves: <span className="font-semibold text-foreground">{p.yearly} Ft / év</span>
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    2 hónap grátisz!
                  </span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-foreground/80">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => goRegister()}
                  className={`mt-7 w-full ${
                    p.highlight
                      ? "bg-brand text-brand-foreground hover:bg-brand-hover"
                      : "bg-secondary text-brand hover:bg-brand-soft"
                  }`}
                >
                  {p.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand py-20 text-brand-foreground">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Kezdje el még ma
          </h2>
          <p className="mt-4 text-base leading-relaxed text-brand-foreground/80">
            Próbálja ki 14 napig ingyen. Amit feltölt, az nem vész el — előfizetés után ugyanott folytatja.
          </p>
          <Button
            size="lg"
            onClick={() => goRegister()}
            className="mt-8 bg-brand-foreground text-brand hover:bg-brand-foreground/90"
          >
            Kipróbálom ingyen <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="kapcsolat" className="scroll-mt-20 border-t border-border bg-background py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
                <Archive className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-brand">Archivai</div>
                <div className="text-xs text-muted-foreground">
                  Törvényi előírás szerint archiválva
                </div>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link to="/aszf" className="hover:text-brand">
                ÁSZF
              </Link>
              <Link to="/adatkezeles" className="hover:text-brand">
                Adatkezelési tájékoztató
              </Link>
              <a href="/archivai-utmutato.html" className="hover:text-brand">
                Súgó
              </a>
              <a href="mailto:kapcsolat@archivai.hu" className="hover:text-brand">
                kapcsolat@archivai.hu
              </a>
            </nav>
          </div>
          <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            © 2026 Archivai — Minden jog fenntartva
          </div>
        </div>
      </footer>
      <CookieConsent />
    </div>
  );
}

type AudienceCard = {
  icon: typeof Calculator;
  title: string;
  pain: string;
  checks: string[];
  tag: string;
  accent: string; // tailwind classes for tinted accent bg/text
  tagClass: string;
  preview: React.ReactNode;
};

function MiniRow({
  icon: Icon,
  label,
  meta,
  badge,
  badgeClass,
}: {
  icon: typeof FileText;
  label: string;
  meta?: string;
  badge?: string;
  badgeClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-[11px]">
      <Icon className="h-3.5 w-3.5 shrink-0 text-brand/70" />
      <span className="truncate font-medium text-foreground">{label}</span>
      {meta && <span className="ml-auto shrink-0 text-muted-foreground">{meta}</span>}
      {badge && (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            badgeClass ?? "bg-brand-soft text-brand"
          }`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function AudienceSection() {
  const cards: AudienceCard[] = [
    {
      icon: Calculator,
      title: "Könyvelőirodák",
      pain: "Több ügyfél, rengeteg dokumentum egyszerre",
      checks: [
        "Ügyfelek dokumentumai szétválasztva",
        "E-mailben küldhetnek be iratokat",
        "Bevallási időszak megjegyzéssel jelölhető",
      ],
      tag: "Partneri program könyvelőknek",
      accent: "bg-blue-50 text-blue-700 ring-blue-200",
      tagClass: "bg-blue-100 text-blue-800",
      preview: (
        <div className="space-y-1.5">
          <MiniRow icon={Folder} label="Kovács Kft." meta="247 dok" />
          <MiniRow icon={Folder} label="Szabó Bt." meta="182 dok" />
          <MiniRow icon={Folder} label="Nagy és Társa Kft." meta="311 dok" />
        </div>
      ),
    },
    {
      icon: Store,
      title: "Kisvállalkozások",
      pain: "Számlák, szerződések szétszórva — megtalálni lehetetlen",
      checks: [
        "Minden irat egy helyen, kereshető",
        "AI automatikusan kategorizál",
        "NAV ellenőrzésnél azonnal megtalál mindent",
      ],
      tag: "14 nap ingyen, kártya nélkül",
      accent: "bg-teal-50 text-teal-700 ring-teal-200",
      tagClass: "bg-teal-100 text-teal-800",
      preview: (
        <div className="space-y-1.5">
          <MiniRow icon={Folder} label="Számlák" meta="48 dok" badge="10 év" />
          <MiniRow icon={Folder} label="Szerződések" meta="12 dok" badge="10 év" />
          <MiniRow icon={Folder} label="Közüzemi" meta="23 dok" badge="5 év" />
        </div>
      ),
    },
    {
      icon: Wrench,
      title: "Kivitelezők",
      pain: "Helyszíni fotók, szállítólevelek, szerződések mindenfelé",
      checks: [
        "Projektenként rendezett dokumentumok",
        "Fotók, PDF-ek, szállítólevelek egy helyen",
        "Alvállalkozói iratok is kezelhetők",
      ],
      tag: "Projektalapú rendszerezés",
      accent: "bg-amber-50 text-amber-800 ring-amber-200",
      tagClass: "bg-amber-100 text-amber-900",
      preview: (
        <div className="space-y-1.5">
          <MiniRow icon={FileText} label="Vállalkozási szerződés.pdf" />
          <MiniRow icon={FileText} label="Teljesítésigazolás.pdf" />
          <MiniRow icon={ImageIcon} label="Helyszíni fotók" meta="12 db" />
          <MiniRow icon={FileText} label="Szállítólevél_042.pdf" />
        </div>
      ),
    },
    {
      icon: Home,
      title: "Ingatlanközvetítők",
      pain: "Adásvételek, bérleti szerződések — papírhegyek ügyfelenként",
      checks: [
        "Ügyfelenként rendezett szerződések",
        "10 éves megőrzési kötelezettség automatikusan",
        "Biztonságos megosztás ügyvéddel, vevővel",
      ],
      tag: "Szerződések biztonságban",
      accent: "bg-purple-50 text-purple-700 ring-purple-200",
      tagClass: "bg-purple-100 text-purple-800",
      preview: (
        <div className="space-y-1.5">
          <MiniRow
            icon={FileText}
            label="Adásvételi szerz. Bp.II."
            badge="Archivált"
            badgeClass="bg-emerald-100 text-emerald-700"
          />
          <MiniRow
            icon={FileText}
            label="Bérleti szerz. Miskolc"
            badge="Archivált"
            badgeClass="bg-emerald-100 text-emerald-700"
          />
          <MiniRow
            icon={FileText}
            label="Előszerződés Győr"
            badge="Folyamatban"
            badgeClass="bg-amber-100 text-amber-800"
          />
        </div>
      ),
    },
    {
      icon: Briefcase,
      title: "Ügyvédi irodák",
      pain: "Ügyiratokat keresni — az idő pénz, és mindkettő fogy",
      checks: [
        "Ügyenként rendezett, azonnal kereshető iratok",
        "Hamisításbiztos audit napló",
        "Ügyfeleknek megosztható olvasási hozzáférés",
      ],
      tag: "Bizonyítható hitelesség",
      accent: "bg-rose-50 text-rose-700 ring-rose-200",
      tagClass: "bg-rose-100 text-rose-800",
      preview: (
        <div className="space-y-1.5">
          <MiniRow icon={Folder} label="Polgári ügy — Kovács J." meta="34 dok" />
          <MiniRow icon={Folder} label="Cégeljárás — ABC Kft." meta="18 dok" />
          <MiniRow icon={Folder} label="Ingatlan — Bp.XIV" meta="27 dok" />
        </div>
      ),
    },
    {
      icon: User,
      title: "Egyéni vállalkozók",
      pain: "Mindent egyedül — és a NAV sem vár",
      checks: [
        "Egyszerű feltöltés, automatikus rendszerezés",
        "NAV integráció — számlák automatikusan érkeznek",
        "Könyvelőnek egy kattintással megosztható",
      ],
      tag: "Alap csomag: 2 990 Ft/hó",
      accent: "bg-slate-100 text-slate-700 ring-slate-200",
      tagClass: "bg-slate-200 text-slate-800",
      preview: (
        <div className="space-y-1.5">
          <div className="rounded-md border border-border/60 bg-background px-2.5 py-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Havi keret</span>
              <span className="font-semibold text-foreground">34 / 200</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[17%] bg-brand" />
            </div>
          </div>
          <MiniRow
            icon={FileText}
            label="NAV_2026_04_szamla.xml"
            badge="NAV"
            badgeClass="bg-blue-100 text-blue-700"
          />
          <MiniRow icon={FileText} label="Megbízási szerződés.pdf" />
        </div>
      ),
    },
  ];

  return (
    <section id="kinek-szol" className="scroll-mt-20 bg-secondary/60 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-brand/15 bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
            Kinek szól?
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand sm:text-4xl">
            Rendszer a dokumentumaiban, biztonság a működésében.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Bármilyen vállalkozást vezet, a dokumentumkezelés időt és energiát visz el.
            Az Archivai rendet teremt.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${c.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-lg font-semibold text-brand">{c.title}</h3>
                  </div>
                  <p className="mt-4 text-sm italic leading-relaxed text-muted-foreground">
                    „{c.pain}"
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {c.checks.map((t) => (
                      <li key={t} className="flex items-start gap-2 text-foreground/85">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.tagClass}`}
                    >
                      {c.tag}
                    </span>
                  </div>
                </div>

                <div className="border-t border-dashed border-border bg-secondary/50 p-4">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-brand text-brand-foreground">
                        <Archive className="h-2.5 w-2.5" />
                      </span>
                      Archivai
                    </span>
                    <span>Előnézet</span>
                  </div>
                  {c.preview}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

