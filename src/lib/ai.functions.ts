import { createServerFn } from "@tanstack/react-start";

export type CategorizeResult = {
  category: string;
  confidence: number;
  reasoning?: string;
  documentDate?: string | null; // ISO yyyy-mm-dd
};

type AllowedCategory = { id: string; label: string; mode: "strict" | "normal" };

const BUILT_IN: AllowedCategory[] = [
  { id: "szamlak", label: "Számlák (invoices)", mode: "strict" },
  { id: "szerzodesek", label: "Szerződések (contracts)", mode: "strict" },
  { id: "szallitolevek", label: "Szállítólevelek (delivery notes)", mode: "strict" },
  { id: "munkaugyi", label: "Munkaügyi iratok (HR/employment)", mode: "strict" },
  { id: "adobevallasok", label: "Adóbevallások (tax returns)", mode: "strict" },
  { id: "kozuzemi", label: "Közüzemi számlák (utility bills)", mode: "normal" },
  { id: "banki", label: "Banki dokumentumok (bank docs)", mode: "normal" },
  { id: "muszaki", label: "Műszaki dokumentumok (technical)", mode: "normal" },
  { id: "belso", label: "Belső iratok (internal)", mode: "normal" },
  { id: "egyeb", label: "Egyéb (other)", mode: "normal" },
];

export const categorizeDocument = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      filename: string;
      mimeType?: string;
      sample?: string;
      customCategories?: { id: string; name: string; mode: "strict" | "normal" }[];
    }) => input,
  )
  .handler(async ({ data }): Promise<CategorizeResult> => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return { category: "egyeb", confidence: 0, reasoning: "missing api key", documentDate: null };
    }

    const customList = (data.customCategories ?? []).map((c) => ({
      id: `custom:${c.id}`,
      label: `${c.name} (custom, ${c.mode})`,
      mode: c.mode,
    }));
    const allowed: AllowedCategory[] = [...BUILT_IN, ...customList];
    const allowedIds = new Set(allowed.map((a) => a.id));

    const system = `You categorize Hungarian business documents.
Allowed category ids:
${allowed.map((a) => `- ${a.id}: ${a.label}`).join("\n")}

Also try to extract the document's own date (invoice date, contract date, statement date, NOT the upload date) from the filename or content sample. Format as ISO YYYY-MM-DD. If unsure, return null.

Respond with strict JSON: {"category":"<id>","confidence":<0..1>,"reasoning":"<short>","documentDate":"YYYY-MM-DD" or null}`;

    const userPrompt = `Filename: ${data.filename}
MIME: ${data.mimeType ?? "unknown"}
${data.sample ? `Content sample:\n${data.sample.slice(0, 3000)}` : ""}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Anthropic error", res.status, text);
        return { category: "egyeb", confidence: 0, reasoning: `http ${res.status}`, documentDate: null };
      }
      const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = json.content?.find((p) => p.type === "text")?.text?.trim() ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { category: "egyeb", confidence: 0, documentDate: null };
      const parsed = JSON.parse(match[0]) as Partial<CategorizeResult>;
      const category = parsed.category && allowedIds.has(parsed.category) ? parsed.category : "egyeb";
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
      let documentDate: string | null = null;
      if (parsed.documentDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.documentDate)) {
        documentDate = parsed.documentDate;
      }
      return { category, confidence, reasoning: parsed.reasoning, documentDate };
    } catch (e) {
      console.error("categorize failed", e);
      return { category: "egyeb", confidence: 0, reasoning: String(e), documentDate: null };
    }
  });
