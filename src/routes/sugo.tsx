import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

export const Route = createFileRoute("/sugo")({
  head: () => ({
    meta: [
      { title: "Súgó — Archivai" },
      { name: "description", content: "Útmutató az Archivai használatához." },
    ],
  }),
  component: SugoPage,
});

function SugoPage() {
  // Cache-busting query param ensures iframe always fetches the latest HTML
  const src = useMemo(
    () => `/archivai-utmutato.html?v=${Date.now()}`,
    [],
  );

  return (
    <iframe
      key={src}
      src={src}
      title="Archivai útmutató"
      style={{ width: "100%", height: "100vh", border: "none" }}
    />
  );
}
