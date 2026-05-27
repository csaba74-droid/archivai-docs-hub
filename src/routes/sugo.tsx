import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <iframe
      src="/archivai-utmutato.html"
      title="Archivai útmutató"
      style={{ width: "100%", height: "100vh", border: "none" }}
    />
  );
}
