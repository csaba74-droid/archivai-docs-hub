import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { matchFilenameCategory } from "@/config/document-rules";


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

const HARD_CATEGORY_ID_BY_LABEL: Record<string, string> = {
  "Számlák": "szamlak",
  "Szerződések": "szerzodesek",
  "Szállítólevelek": "szallitolevek",
  "Munkaügyi iratok": "munkaugyi",
};



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
    // Auth guard: require an authenticated user (prevents AI API key abuse)
    const authHeader = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : null;
    if (!token) {
      throw new Error("Unauthorized");
    }
    const supabaseUrl = process.env.SUPABASE_URL ?? "https://jofxnjtktwuzmjjcgofw.supabase.co";
    const supabaseAnon =
      process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_UvtuR3PW0qi6ia8Y07kwFQ_p5dbL2Ix";
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      throw new Error("Unauthorized");
    }
    // Require active subscription (AI is a paid feature)
    const { data: sub } = await authClient
      .from("subscriptions")
      .select("status, plan")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!sub || sub.status !== "active") {
      throw new Error("Active subscription required");
    }

    // HARD RULE: filename keyword match locks the category and skips AI.
    const hardLabel = matchFilenameCategory(data.filename);
    const hard = hardLabel ? HARD_CATEGORY_ID_BY_LABEL[hardLabel] : null;
    if (hard) {
      return { category: hard, confidence: 1, reasoning: "filename keyword match", documentDate: null };
    }



    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return { category: hard ?? "egyeb", confidence: hard ? 1 : 0, reasoning: "missing api key", documentDate: null };
    }


    const customList = (data.customCategories ?? []).map((c) => ({
      id: `custom:${c.id}`,
      label: `${c.name} (custom, ${c.mode})`,
      mode: c.mode,
    }));
    const allowed: AllowedCategory[] = [...BUILT_IN, ...customList];
    const allowedIds = new Set(allowed.map((a) => a.id));

    const customKeywordsBlock = customList.length
      ? `\n\nCUSTOM USER CATEGORIES (also check filename + content for the category name and any obvious synonyms):\n${customList
          .map((c) => `- ${c.id}: ${c.label}`)
          .join("\n")}`
      : "";

    const system = `You are an expert classifier for Hungarian business documents (magyar üzleti dokumentumok). You receive a FILENAME, MIME type, and a CONTENT SAMPLE extracted from the file. You must check BOTH the filename AND the content for keywords. Hungarian diacritics, casing, and English/German/Spanish equivalents all count as matches.

Allowed category ids and their detection keywords (match ANY keyword in filename OR content):

1) szamlak — SZÁMLÁK (Invoices), 10 év kötelező megőrzés, ITM strict
   Keywords: invoice, számla, rechnung, factura, bill, receipt, nyugta, proforma, díjbekérő, "előleg számla", végszámla, "storno számla", "credit note", "debit note", "NAV online számla"
   Strong signal: presence of invoice number ("számlaszám", "Invoice No"), VAT/ÁFA line, nettó/bruttó totals, "fizetési határidő", "teljesítés kelte". If document clearly has price + VAT + invoice number → ALWAYS szamlak even without keyword match.

2) szerzodesek — SZERZŐDÉSEK (Contracts), 10 év, strict
   Keywords: contract, agreement, szerződés, megállapodás, keretszerződés, "bérleti szerződés", adásvételi, "vállalkozási szerződés", "megbízási szerződés"

3) szallitolevek — SZÁLLÍTÓLEVELEK (Delivery notes), 10 év, strict
   Keywords: delivery, szállítólevél, fuvarlevél, EKÁER, CMR, "packing list", csomagjegyzék, "szállítási dokumentum", "átadás-átvétel"

4) munkaugyi — MUNKAÜGYI IRATOK (HR/employment), határozatlan, strict
   Keywords: munkaszerződés, "employment contract", payslip, bérjegyzék, munkabér, HR, munkaügyi, "jelenléti ív", "szabadság nyilvántartás", "kilépő papír", "belépő nyilatkozat"

5) adobevallasok — ADÓBEVALLÁSOK (Tax returns), 6 év, strict
   Keywords: NAV, APEH, "tax return", adóbevallás, bevallás, "08-as bevallás", "áfa bevallás", "iparűzési adó", "társasági adó", "szja bevallás", "1953", "2265"

6) kozuzemi — KÖZÜZEMI SZÁMLÁK (Utility bills), 5 év ajánlott
   Keywords: közüzemi, villany, víz, gáz, távhő, "internet számla", "telefon számla", E.ON, MVM, ELMŰ, ÉMÁSZ, NKM, TIGÁZ, Telekom, Vodafone, Telenor, UPC, Digi
   Note: utility provider invoices go HERE, not szamlak.

7) banki — BANKI DOKUMENTUMOK (Bank docs), 5 év ajánlott
   Keywords: bank, bankszámlakivonat, számlakivonat, hitelszerződés, kölcsönszerződés, törlesztési, OTP, K&H, Raiffeisen, UniCredit, CIB, MKB, Erste, SWIFT, IBAN

8) muszaki — MŰSZAKI DOKUMENTUMOK (Technical), nincs korlát
   Keywords: kézikönyv, manual, műszaki, specifikáció, tervrajz, dokumentáció, "használati utasítás", "garancia levél", szerviz

9) belso — BELSŐ IRATOK (Internal), nincs korlát
   Keywords: belső, feljegyzés, emlékeztető, előterjesztés, szabályzat, SZMSZ, házirend, protokoll, "belső utasítás"

10) egyeb — EGYÉB (Other) — only when nothing else clearly matches.${customKeywordsBlock}

CONFIDENCE RULES:
- Any clear keyword match in filename OR content → confidence ≥ 0.90.
- Invoice-shape detected (price + VAT/ÁFA + invoice number) → szamlak, confidence ≥ 0.92.
- Ambiguous between two categories → choose the most specific (utility-provider invoice → kozuzemi over szamlak; bank statement → banki) and use 0.70–0.85.
- Truly unclear / no signal → egyeb with confidence < 0.5.
- Never invent matches. If you cannot justify a keyword/structural cue, lower the confidence.

DATE EXTRACTION:
- Extract the document's OWN date: invoice date ("számla kelte", "kelt", "issue date", "invoice date"), contract signing date, statement period end, tax return period end. NOT the upload date and NOT due date ("fizetési határidő") unless no other date exists.
- Accept Hungarian formats (2024.03.15, 2024. március 15., 15/03/2024, etc.) and normalize to ISO YYYY-MM-DD.
- If unsure, return null. Do not guess.

OUTPUT: Respond with STRICT JSON only, no prose, no markdown:
{"category":"<id from list above>","confidence":<0..1 number>,"reasoning":"<short Hungarian explanation, mention which keyword matched>","documentDate":"YYYY-MM-DD" or null}`;

    const userPrompt = `FILENAME: ${data.filename}
MIME: ${data.mimeType ?? "unknown"}
${data.sample ? `CONTENT SAMPLE (first 3000 chars):\n${data.sample.slice(0, 3000)}` : "CONTENT SAMPLE: (none — classify from filename only)"}`;

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
          max_tokens: 400,
          system,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Anthropic error", res.status, text);
        return { category: hard ?? "egyeb", confidence: hard ? 1 : 0, reasoning: `http ${res.status}`, documentDate: null };
      }
      const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = json.content?.find((p) => p.type === "text")?.text?.trim() ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { category: hard ?? "egyeb", confidence: hard ? 1 : 0, documentDate: null };
      const parsed = JSON.parse(match[0]) as Partial<CategorizeResult>;
      const aiCategory = parsed.category && allowedIds.has(parsed.category) ? parsed.category : "egyeb";
      const category = hard ?? aiCategory;
      const confidence = hard ? 1 : Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
      let documentDate: string | null = null;
      if (parsed.documentDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.documentDate)) {
        documentDate = parsed.documentDate;
      }
      return { category, confidence, reasoning: hard ? "filename keyword match" : parsed.reasoning, documentDate };
    } catch (e) {
      console.error("categorize failed", e);
      return { category: hard ?? "egyeb", confidence: hard ? 1 : 0, reasoning: String(e), documentDate: null };
    }
  });
