import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Upload, Search, FolderOpen, Share2, Shield, Mail, FileText, Sparkles, Inbox, Camera, Users, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sugo")({
  head: () => ({
    meta: [
      { title: "Súgó — Archivai" },
      { name: "description", content: "Útmutató az Archivai használatához: feltöltés, kategorizálás, keresés, megosztás és további funkciók." },
    ],
  }),
  component: SugoPage,
});

const BRAND = "#1A2B4A";

type Section = {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
};

const sections: Section[] = [
  {
    icon: <Upload className="h-5 w-5" />,
    title: "Dokumentumok feltöltése",
    body: (
      <>
        <p>A vezérlőpulton kattints a <strong>Feltöltés</strong> gombra (mobilon a középső kör alakú gomb az alsó sávban). Húzd be a fájlokat, vagy válaszd ki őket a készülékedről.</p>
        <p>Támogatott formátumok: PDF, JPG, PNG, DOCX, XLSX és további irodai fájlok. Egyszerre több fájl is feltölthető.</p>
      </>
    ),
  },
  {
    icon: <Camera className="h-5 w-5" />,
    title: "Szkennelés telefonnal",
    body: (
      <>
        <p>A mobil alsó sávjában lévő <strong>Szken</strong> gombbal közvetlenül a kamerából tudsz dokumentumot beolvasni. Az alkalmazás automatikusan felismeri a dokumentum széleit.</p>
        <p>Részletes lépésről lépésre útmutató: <Link to="/scan-guide" className="underline" style={{ color: BRAND }}>Hogyan szkennelj</Link>.</p>
      </>
    ),
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "AI alapú kategorizálás",
    body: (
      <p>Feltöltés után az Archivai mesterséges intelligenciája elolvassa és automatikusan besorolja a dokumentumot (pl. számla, szerződés, igazolás). A javasolt kategóriát bármikor módosíthatod a dokumentum részleteinél.</p>
    ),
  },
  {
    icon: <FolderOpen className="h-5 w-5" />,
    title: "Kategóriák kezelése",
    body: (
      <>
        <p>A <strong>Kategóriák</strong> oldalon átláthatóan rendezheted dokumentumaidat. Pro és Vállalati csomagban egyéni kategóriákat is létrehozhatsz a saját igényeid szerint.</p>
      </>
    ),
  },
  {
    icon: <Search className="h-5 w-5" />,
    title: "Keresés",
    body: (
      <p>A teljes szöveges kereső a dokumentumok tartalmában is keres — nem csak a fájlnévben. Használhatsz részleges szavakat, dátumot vagy kategóriát szűrőként.</p>
    ),
  },
  {
    icon: <Inbox className="h-5 w-5" />,
    title: "Dedikált Archivai e-mail cím",
    body: (
      <>
        <p>Pro és Vállalati csomagban minden felhasználó saját <strong>@inbox.archivai.hu</strong> címet kap. Az erre a címre küldött csatolmányok automatikusan bekerülnek az archívumba és kategorizálódnak.</p>
        <p>A címedet a vezérlőpulton találod, egy kattintással másolható.</p>
      </>
    ),
  },
  {
    icon: <Share2 className="h-5 w-5" />,
    title: "Megosztás",
    body: (
      <p>Pro és Vállalati csomagban dokumentumokat és mappákat oszthatsz meg más felhasználókkal vagy generálhatsz biztonságos megosztási linket. A hozzáférés bármikor visszavonható.</p>
    ),
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Több felhasználó (Vállalati)",
    body: (
      <p>Vállalati csomagban kollégákat hívhatsz meg a közös archívumba. A meghívásokat e-mailben küldheted ki a <strong>Megosztás</strong> oldalról.</p>
    ),
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Biztonság és integritás",
    body: (
      <p>Minden dokumentumhoz SHA-256 alapú integritási ujjlenyomatot készítünk, és minden műveletet rögzítünk az audit naplóban. Az archiválás megfelel az ITM rendelet előírásainak.</p>
    ),
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Audit napló",
    body: (
      <p>Az <strong>Audit</strong> oldalon visszanézheted, ki és mikor férkőzött hozzá egy dokumentumhoz vagy módosította azt. Ez törvényi megfelelőséghez is felhasználható.</p>
    ),
  },
  {
    icon: <Download className="h-5 w-5" />,
    title: "GDPR adatexport",
    body: (
      <p>A <strong>Profil</strong> oldalon bármikor letöltheted az összes dokumentumodat és adatodat egyetlen csomagban, a GDPR előírásainak megfelelően.</p>
    ),
  },
  {
    icon: <Mail className="h-5 w-5" />,
    title: "Segítségre van szükséged?",
    body: (
      <p>Írj nekünk a <a href="mailto:help@archivai.hu" className="underline" style={{ color: BRAND }}>help@archivai.hu</a> címre. Vállalati csomagban prioritásos ügyfélszolgálatot biztosítunk.</p>
    ),
  },
];

function SugoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Vissza
            </Link>
          </Button>
          <h1 className="text-lg font-semibold" style={{ color: BRAND }}>Súgó</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <section className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: BRAND }}>
            Üdvözlünk az Archivai-ban!
          </h2>
          <p className="text-muted-foreground">
            Ez az útmutató végigvezet az alkalmazás legfontosabb funkcióin. Ha bármi nem világos, írj nekünk bátran.
          </p>
        </section>

        <div className="grid gap-4">
          {sections.map((s, i) => (
            <article
              key={i}
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white"
                  style={{ backgroundColor: BRAND }}
                  aria-hidden
                >
                  {s.icon}
                </span>
                <div className="space-y-2 text-sm leading-relaxed">
                  <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
                  <div className="text-muted-foreground space-y-2">{s.body}</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="pt-4">
          <Button asChild className="w-full sm:w-auto" style={{ backgroundColor: BRAND }}>
            <Link to="/dashboard">Vissza a vezérlőpultra</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
