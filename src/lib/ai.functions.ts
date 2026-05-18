import { createServerFn } from "@tanstack/react-start";

export type CategorizeResult = {
  category: string;
  confidence: number;
  reasoning?: string;
};

const ALLOWED_CATEGORIES = [
  "szamlak",
  "szerzodesek",
  "szallitolevek",
  "munkaugyi",
  "adobevallasok",
  "kozuzemi",
  "banki",
  "muszaki",
  "belso",
  "egyeb",
] as const;

export const categorizeDocument = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { filename: string; mimeType?: string; sample?: string }) => input,
  )
  .handler(async ({ data }): Promise<CategorizeResult> => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return { category: "egyeb", confidence: 0, reasoning: "missing api key" };
    }

    const system = `You categorize Hungarian business documents into ONE of these ids:
szamlak (invoices), szerzodesek (contracts), szallitolevek (delivery notes),
munkaugyi (employment/HR), adobevallasok (tax returns), kozuzemi (utility bills),
banki (bank statements/documents), muszaki (technical docs), belso (internal docs),
egyeb (other).
Respond with strict JSON: {"category":"<id>","confidence":<0..1>,"reasoning":"<short>"}.`;

    const userPrompt = `Filename: ${data.filename}
MIME: ${data.mimeType ?? "unknown"}
${data.sample ? `Content sample:\n${data.sample.slice(0, 2000)}` : ""}`;

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
          max_tokens: 200,
          system,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Anthropic error", res.status, text);
        return { category: "egyeb", confidence: 0, reasoning: `http ${res.status}` };
      }
      const json = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text =
        json.content?.find((p) => p.type === "text")?.text?.trim() ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { category: "egyeb", confidence: 0 };
      const parsed = JSON.parse(match[0]) as Partial<CategorizeResult>;
      const category =
        ALLOWED_CATEGORIES.find((c) => c === parsed.category) ?? "egyeb";
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
      return { category, confidence, reasoning: parsed.reasoning };
    } catch (e) {
      console.error("categorize failed", e);
      return { category: "egyeb", confidence: 0, reasoning: String(e) };
    }
  });
