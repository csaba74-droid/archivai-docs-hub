import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/adatkezeles")({
  head: () => ({
    meta: [
      { title: "Adatkezelési Tájékoztató — Archivai" },
      {
        name: "description",
        content:
          "Az Archivai adatkezelési tájékoztatója a GDPR rendelkezéseinek megfelelően.",
      },
    ],
  }),
  component: AdatkezelesPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-brand sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/85 sm:text-base">
        {children}
      </div>
    </section>
  );
}

function AdatkezelesPage() {
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
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Vissza a főoldalra
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">
          Adatkezelési Tájékoztató
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Hatályos: 2026. január 16.</p>

        <Section title="1. Adatkezelő adatai">
          <p>
            Adatkezelő: <strong>Lénárd Csaba egyéni vállalkozó</strong>
            <br />
            E-mail: <a className="text-brand hover:underline" href="mailto:kapcsolat@archivai.hu">kapcsolat@archivai.hu</a>
          </p>
          <p>
            A jelen tájékoztató a természetes személyeknek a személyes adatok
            kezelése tekintetében történő védelméről szóló (EU) 2016/679
            rendelet (GDPR) és az Infotv. (2011. évi CXII. tv.) alapján készült.
          </p>
        </Section>

        <Section title="2. Az adatkezelés jogalapjai">
          <ul className="list-disc space-y-1 pl-5">
            <li>Szerződés teljesítése (GDPR 6. cikk (1) b)) — szolgáltatás nyújtása, számlázás.</li>
            <li>Jogi kötelezettség (GDPR 6. cikk (1) c)) — számviteli és adójogi előírások.</li>
            <li>Az érintett hozzájárulása (GDPR 6. cikk (1) a)) — hírlevél, marketing.</li>
            <li>Jogos érdek (GDPR 6. cikk (1) f)) — visszaélések megelőzése, biztonság.</li>
          </ul>
        </Section>

        <Section title="3. A kezelt adatok köre">
          <ul className="list-disc space-y-1 pl-5">
            <li>Azonosítási adatok: név, e-mail cím, cégnév.</li>
            <li>Fiók adatok: jelszó (titkosítva), regisztráció időpontja.</li>
            <li>Számlázási adatok: cím, adószám, fizetési mód metaadatok.</li>
            <li>Feltöltött dokumentumok és azok tartalma.</li>
            <li>Technikai adatok: IP cím, böngésző típusa, audit naplók.</li>
          </ul>
        </Section>

        <Section title="4. Kettős EU-s adattárolás">
          <p>
            A Felhasználó dokumentumai egyidejűleg <strong>két független
            EU-s adatközpontban</strong> tárolódnak, biztosítva a folyamatos
            elérhetőséget és az adatvesztés elleni védelmet:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Elsődleges régió: <strong>Frankfurt — eu-central-1</strong></li>
            <li>Másodlagos régió: <strong>Írország — eu-west-1</strong></li>
          </ul>
          <p>
            Az infrastruktúrát az Amazon Web Services (AWS) biztosítja. Az
            adatok mind a tárolás (at-rest), mind az átvitel (in-transit)
            során <strong>AES-256 titkosítással</strong> védettek. Az adatok az
            Európai Unió területét nem hagyják el.
          </p>
        </Section>

        <Section title="5. Adatfeldolgozók">
          <p>Az alábbi adatfeldolgozókat vesszük igénybe:</p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-brand">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Szolgáltató</th>
                  <th className="px-3 py-2 text-left font-semibold">Cél</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr><td className="px-3 py-2">Supabase Inc.</td><td className="px-3 py-2">Adatbázis, hitelesítés</td></tr>
                <tr><td className="px-3 py-2">Amazon Web Services EMEA SARL</td><td className="px-3 py-2">Tárhely (Frankfurt, Írország)</td></tr>
                <tr><td className="px-3 py-2">Stripe Payments Europe Ltd.</td><td className="px-3 py-2">Fizetésfeldolgozás</td></tr>
                <tr><td className="px-3 py-2">Resend</td><td className="px-3 py-2">Tranzakciós e-mailek</td></tr>
                <tr><td className="px-3 py-2">Cloudflare Inc.</td><td className="px-3 py-2">CDN, biztonsági szolgáltatások</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="6. Adatmegőrzési idő">
          <p>
            A fiók adatait az előfizetés időtartama alatt, valamint a
            felmondást követő 30 napig tároljuk. A számviteli bizonylatokat a
            hatályos jogszabályok szerint 8 évig őrizzük meg. A feltöltött
            dokumentumok megőrzési idejét a Felhasználó határozza meg.
          </p>
        </Section>

        <Section title="7. Érintetti jogok">
          <p>A Felhasználó (érintett) az alábbi jogokat gyakorolhatja:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Hozzáférés joga</strong> — tájékoztatás a kezelt adatokról.</li>
            <li><strong>Helyesbítés joga</strong> — pontatlan adatok módosítása.</li>
            <li><strong>Törlés joga</strong> („elfeledtetéshez való jog").</li>
            <li><strong>Adathordozhatóság joga</strong> — adatok géppel olvasható formátumú exportálása.</li>
            <li><strong>Tiltakozás joga</strong> — bizonyos adatkezelések ellen.</li>
            <li><strong>Korlátozáshoz való jog</strong> — adatkezelés ideiglenes felfüggesztése.</li>
          </ul>
          <p>
            Jogait a{" "}
            <a className="text-brand hover:underline" href="mailto:kapcsolat@archivai.hu">
              kapcsolat@archivai.hu
            </a>{" "}
            e-mail címen gyakorolhatja. Kérelmét 30 napon belül elbíráljuk.
          </p>
        </Section>

        <Section title="8. Adatbiztonság">
          <p>
            Megfelelő technikai és szervezési intézkedésekkel biztosítjuk az
            adatok védelmét: AES-256 titkosítás, kétfaktoros hozzáférés-kezelés,
            rendszeres biztonsági mentések, SHA-256 integritás védelem,
            részletes audit napló, hozzáférés-korlátozás a need-to-know elv alapján.
          </p>
        </Section>

        <Section title="9. Felügyeleti hatóság (NAIH)">
          <p>
            Az adatkezeléssel kapcsolatos panasz esetén a Nemzeti Adatvédelmi
            és Információszabadság Hatósághoz fordulhat:
          </p>
          <p>
            <strong>Nemzeti Adatvédelmi és Információszabadság Hatóság</strong>
            <br />
            Cím: 1055 Budapest, Falk Miksa utca 9-11.
            <br />
            Postacím: 1363 Budapest, Pf. 9.
            <br />
            Telefon: +36 (1) 391-1400
            <br />
            E-mail:{" "}
            <a className="text-brand hover:underline" href="mailto:ugyfelszolgalat@naih.hu">
              ugyfelszolgalat@naih.hu
            </a>
            <br />
            Web:{" "}
            <a className="text-brand hover:underline" href="https://naih.hu" target="_blank" rel="noopener noreferrer">
              naih.hu
            </a>
          </p>
        </Section>

        <footer className="mt-16 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          Hatályos: 2026. január 16. · Lénárd Csaba egyéni vállalkozó ·{" "}
          <a className="hover:text-brand" href="mailto:kapcsolat@archivai.hu">
            kapcsolat@archivai.hu
          </a>
        </footer>
      </main>
    </div>
  );
}
