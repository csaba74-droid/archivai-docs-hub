import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/scan-guide")({
  head: () => ({
    meta: [
      { title: "Hogyan szkennelj — Archivai" },
      { name: "description", content: "Lépésről lépésre útmutató: hogyan szkennelj dokumentumokat iPhone-on és Androidon." },
    ],
  }),
  component: ScanGuidePage,
});

const BRAND = "#1A2B4A";
const STEP_MS = 6000;

type Step = { title: string; description: string };

const iphoneSteps: Step[] = [
  { title: "Nyisd meg a Fájlok appot", description: "Keresd a kék mappa ikont a főképernyőn. Ez minden iPhone-on alapból megtalálható — nem kell letölteni." },
  { title: 'Kattints a "..." gombra', description: "A Fájlok app jobb felső sarkában találod a három pontot. Kattints rá — megjelenik a menü." },
  { title: "Szkenneld be a dokumentumot", description: "A kamera automatikusan felismeri a dokumentum széleit és sárga kerettel jelöli. Tartsd egyenesen és jó megvilágításban." },
  { title: "Mentsd el PDF-ként", description: "A szkennelés után az iPhone automatikusan PDF-et készít. Adj neki megfelelő fájlnevet, majd kattints a Mentés gombra." },
  { title: "Töltsd fel az Archivai-ba", description: "Nyisd meg az Archivai-t, kattints a Feltöltés gombra, és válaszd ki a Fájlok appból a szkennelt PDF-et. Az AI automatikusan kategorizálja!" },
];

const androidSteps: Step[] = [
  { title: "Nyisd meg a Google Drive appot", description: "Keresd a Drive ikont. Szinte minden Androidon alapból megtalálható — ha nincs, töltsd le ingyen a Play Store-ból." },
  { title: 'Kattints a "+" gombra', description: "A jobb alsó sarokban találod a kék + gombot. Kattints rá — megjelenik a menü a lehetőségekkel." },
  { title: 'Válaszd a "Szkennelés" opciót', description: "A menüből válaszd a Szkennelés lehetőséget. A kamera megnyílik és automatikusan felismeri a dokumentum széleit." },
  { title: "Mentsd el PDF-ként a Drive-ra", description: "A szkennelés után a Google Drive automatikusan PDF-et készít. Adj neki megfelelő fájlnevet, majd mentsd el." },
  { title: "Töltsd fel az Archivai-ba", description: "Nyisd meg az Archivai-t, kattints a Feltöltés gombra, és válaszd ki a Google Drive-ból a szkennelt PDF-et. Az AI automatikusan kategorizálja!" },
];

function StepPlayer({ steps }: { steps: Step[] }) {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setElapsed(0);
  }, [index]);

  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now() - elapsed;
    const tick = setInterval(() => {
      const e = Date.now() - startedAt;
      if (e >= STEP_MS) {
        setIndex((i) => (i + 1) % steps.length);
      } else {
        setElapsed(e);
      }
    }, 60);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, steps.length, paused]);

  const step = steps[index];
  const progress = ((index + 1) / steps.length) * 100;
  const timer = Math.min(100, (elapsed / STEP_MS) * 100);

  const goPrev = () => setIndex((i) => (i - 1 + steps.length) % steps.length);
  const goNext = () => setIndex((i) => (i + 1) % steps.length);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Step progress */}
      <div className="px-6 pt-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>{index + 1} / {steps.length}. lépés</span>
          <span>{Math.ceil((STEP_MS - elapsed) / 1000)}s</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: BRAND }} />
        </div>
      </div>

      {/* Step content */}
      <div className="px-6 py-8 md:py-12 min-h-[280px] flex flex-col items-center text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-5"
          style={{ backgroundColor: BRAND }}
          key={index}
        >
          {index + 1}
        </div>
        <h2 className="text-xl md:text-2xl font-bold mb-3" style={{ color: BRAND }}>
          {step.title}
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-md leading-relaxed animate-fade-in">
          {step.description}
        </p>
      </div>

      {/* Timer bar */}
      <div className="h-1 bg-muted">
        <div className="h-full transition-all" style={{ width: `${timer}%`, backgroundColor: "#F97316" }} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-muted/30">
        <Button variant="outline" size="sm" onClick={goPrev}>
          <ChevronLeft className="h-4 w-4" /> Előző
        </Button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="h-2 rounded-full transition-all"
              style={{
                width: i === index ? 24 : 8,
                backgroundColor: i === index ? BRAND : "hsl(var(--muted-foreground) / 0.3)",
              }}
              aria-label={`${i + 1}. lépés`}
            />
          ))}
        </div>
        <Button size="sm" onClick={goNext} style={{ backgroundColor: BRAND }}>
          Következő <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Pause / Play */}
      <div className="flex justify-center px-6 py-5 border-t bg-background">
        <Button
          size="lg"
          onClick={() => setPaused((p) => !p)}
          className="min-w-[200px] text-base font-semibold shadow-md"
          style={{ backgroundColor: paused ? "#F97316" : BRAND, color: "white" }}
        >
          {paused ? <><Play className="h-5 w-5" /> Folytatás</> : <><Pause className="h-5 w-5" /> Megállítás</>}
        </Button>
      </div>
    </div>
  );
}

function ScanGuidePage() {
  const iphone = useMemo(() => iphoneSteps, []);
  const android = useMemo(() => androidSteps, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Vissza</Button>
          </Link>
          <h1 className="text-lg md:text-xl font-bold" style={{ color: BRAND }}>
            Hogyan szkennelj
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 md:py-10">

        <Tabs defaultValue="iphone" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="iphone" className="gap-2">
              <Smartphone className="h-4 w-4" /> iPhone
            </TabsTrigger>
            <TabsTrigger value="android" className="gap-2">
              <Smartphone className="h-4 w-4" /> Android
            </TabsTrigger>
          </TabsList>
          <TabsContent value="iphone">
            <StepPlayer steps={iphone} />
          </TabsContent>
          <TabsContent value="android">
            <StepPlayer steps={android} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
