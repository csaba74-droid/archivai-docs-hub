import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/aszf")({
  head: () => ({
    meta: [
      { title: "Általános Szerződési Feltételek — Archivai" },
      {
        name: "description",
        content:
          "Az Archivai szolgáltatás Általános Szerződési Feltételei. Hatályos: 2026. január 16.",
      },
    ],
  }),
  component: AszfPage,
});

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-brand sm:text-2xl">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/85 sm:text-base">
        {children}
      </div>
    </section>
  );
}

function AszfPage() {
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
          Általános Szerződési Feltételek
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Hatályos: 2026. január 16.</p>

        <Section n={1} title="Szolgáltató adatai">
          <p>
            Szolgáltató: <strong>Lénárd Csaba egyéni vállalkozó</strong>
            <br />
            Kapcsolat: <a className="text-brand hover:underline" href="mailto:kapcsolat@archivai.hu">kapcsolat@archivai.hu</a>
            <br />
            Tárhelyszolgáltató: Amazon Web Services EMEA SARL (Frankfurt eu-central-1, Írország eu-west-1)
          </p>
        </Section>

        <Section n={2} title="ÁSZF hatálya">
          <p>
            A jelen ÁSZF a Szolgáltató által üzemeltetett Archivai
            dokumentumarchiváló szolgáltatás (a továbbiakban: Szolgáltatás)
            igénybevételére vonatkozó feltételeket szabályozza, és valamennyi
            Felhasználóra kiterjed.
          </p>
        </Section>

        <Section n={3} title="Fogalommeghatározások">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Felhasználó:</strong> a Szolgáltatást igénybe vevő természetes vagy jogi személy.</li>
            <li><strong>Előfizetés:</strong> a Szolgáltatás díjfizetés ellenében történő igénybevétele.</li>
            <li><strong>Dokumentum:</strong> a Felhasználó által feltöltött, archiválás céljából átadott fájl.</li>
          </ul>
        </Section>

        <Section n={4} title="Szolgáltatás leírása">
          <p>
            Az Archivai automatikus kategorizálást, biztonságos tárolást és
            visszakeresést biztosít a hatályos megőrzési előírásoknak megfelelően.
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-brand">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Csomag</th>
                  <th className="px-4 py-2 text-right font-semibold">Havi díj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-2">Alap</td>
                  <td className="px-4 py-2 text-right">2 990 Ft/hó</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Pro</td>
                  <td className="px-4 py-2 text-right">4 990 Ft/hó</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Vállalati</td>
                  <td className="px-4 py-2 text-right">9 990 Ft/hó</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            Minden új Felhasználó 14 napos ingyenes próbaidőszakra jogosult,
            kártyaadat megadása nélkül.
          </p>
        </Section>

        <Section n={5} title="Regisztráció">
          <p>
            A Szolgáltatás igénybevételének feltétele a regisztráció. A
            Felhasználó köteles valós adatokat megadni és gondoskodni a
            belépési adatok biztonságos kezeléséről. A regisztráció során a
            Felhasználó kifejezetten elfogadja a jelen ÁSZF rendelkezéseit.
          </p>
        </Section>

        <Section n={6} title="Fizetési feltételek">
          <p>
            A díjak havi rendszerességgel, előre fizetendők. A fizetést a
            Stripe Payments Europe Ltd. dolgozza fel. A díj a Felhasználó
            által megadott bankkártyáról automatikusan levonásra kerül a
            tárgyhónap kezdő napján. A Szolgáltató elektronikus számlát állít
            ki, amelyet a Felhasználó e-mail címére küld meg.
          </p>
        </Section>

        <Section n={7} title="Adatbiztonság">
          <p>
            A dokumentumok két független EU-s adatközpontban (Frankfurt
            eu-central-1 és Írország eu-west-1) kerülnek tárolásra, AES-256
            titkosítással. A Szolgáltató SHA-256 integritás védelmet és teljes
            audit naplót biztosít minden műveletről.
          </p>
        </Section>

        <Section n={8} title="Szellemi tulajdon">
          <p>
            Az Archivai szoftver, valamint a hozzá kapcsolódó valamennyi
            szellemi alkotás a Szolgáltató kizárólagos tulajdona. A
            Felhasználó az általa feltöltött dokumentumok feletti minden jogát
            megőrzi.
          </p>
        </Section>

        <Section n={9} title="Felelősségkorlátozás">
          <p>
            A Szolgáltató felelőssége a havi előfizetési díj 12-szeresének
            erejéig terjed. A Szolgáltató nem felelős a Felhasználó által
            feltöltött dokumentumok tartalmáért, valamint vis maior, harmadik
            fél hibája vagy a Felhasználó által okozott károkért.
          </p>
        </Section>

        <Section n={10} title="Elállási jog">
          <p>
            A Felhasználó a szerződés megkötésétől számított 14 napon belül
            indokolás nélkül elállhat. Tekintettel arra, hogy a Szolgáltatás
            digitális tartalom, az elállási jog a Szolgáltatás megkezdéséig
            gyakorolható.
          </p>
        </Section>

        <Section n={11} title="Felmondás">
          <p>
            Az Előfizetés bármikor felmondható a fiók beállításai között. A
            felmondás a folyó hónap végén lép hatályba. A Felhasználó a
            felmondást követő 30 napig hozzáférhet adataihoz exportálás céljából.
          </p>
        </Section>

        <Section n={12} title="Titoktartás">
          <p>
            A Szolgáltató a Felhasználó dokumentumaihoz kizárólag a
            Szolgáltatás technikai üzemeltetése érdekében férhet hozzá, azokat
            harmadik félnek nem adja át, kivéve, ha azt jogszabály kötelezően
            előírja.
          </p>
        </Section>

        <Section n={13} title="Ajánlói program">
          <p>
            A Felhasználó az ajánlói program keretében egyedi ajánlókódot
            kaphat. Sikeres ajánlás esetén a Szolgáltató előfizetési kedvezményt
            biztosít az ajánló és az ajánlott számára egyaránt. A program
            részletes feltételei a fiókban érhetők el.
          </p>
        </Section>

        <Section n={14} title="Panaszkezelés">
          <p>
            A Felhasználó panaszát a
            {" "}
            <a className="text-brand hover:underline" href="mailto:kapcsolat@archivai.hu">kapcsolat@archivai.hu</a>
            {" "}
            e-mail címen terjesztheti elő. A Szolgáltató a panaszt 30 napon
            belül kivizsgálja és írásban megválaszolja. Jogvita esetén a
            Felhasználó a lakóhelye szerint illetékes békéltető testülethez
            fordulhat.
          </p>
        </Section>

        <Section n={15} title="Egyéb rendelkezések">
          <p>
            A Szolgáltató jogosult az ÁSZF egyoldalú módosítására, amelyről a
            Felhasználót a hatálybalépés előtt legalább 15 nappal e-mailben
            értesíti. A jelen ÁSZF-ben nem szabályozott kérdésekben a magyar
            jog rendelkezései az irányadóak.
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
