import { createFileRoute } from "@tanstack/react-router";
import html from "../../public/archivai-utmutato.html?raw";

export const Route = createFileRoute("/archivai-utmutato.html")({
  server: {
    handlers: {
      GET: () =>
        new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-cache, no-store, must-revalidate",
            pragma: "no-cache",
            expires: "0",
          },
        }),
    },
  },
});
