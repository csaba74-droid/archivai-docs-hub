import { createServerFn } from "@tanstack/react-start";
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

const HARD_CATEGORY_ID_ALIAS: Record<string, string> = {
  szamlak: "szamlak",
  szerzodesek: "szerzodesek",
  szallitolevelek: "szallitolevek",
  munkaugyi_iratok: "munkaugyi",
  adobevallesok: "adobevallasok",
  kozuzemi_szamlak: "kozuzemi",
  banki_dokumentumok: "banki",
  muszaki_dokumentumok: "muszaki",
};

const WORKER_ENV_SYMBOL = Symbol.for("archivai.workerEnv");

function getRuntimeSecret(name: string): string | undefined {
  const workerEnv = (globalThis as typeof globalThis & { [WORKER_ENV_SYMBOL]?: Record<string, unknown> })[
    WORKER_ENV_SYMBOL
  ];
  const fromWorkerEnv = workerEnv?.[name];
  if (typeof fromWorkerEnv === "string" && fromWorkerEnv.trim()) return fromWorkerEnv.trim();

  const fromProcessEnv = process.env[name];
  if (typeof fromProcessEnv === "string" && fromProcessEnv.trim()) return fromProcessEnv.trim();

  return undefined;
}

export const categorizeDocument = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      filename: string;
      mimeType?: string;
      sample?: string;
      customCategories?: { id: string; name: string; mode: "strict" | "normal" }[];
      accessToken?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<CategorizeResult> => {
    // HARD RULE: filename keyword match locks the category and skips AI.
    const hardMatch = matchFilenameCategory(data.filename);
    const hard = hardMatch ? (HARD_CATEGORY_ID_ALIAS[hardMatch.category] ?? hardMatch.category) : null;
    if (hard) {
      return { category: hard, confidence: 1, reasoning: "filename keyword match", documentDate: null };
    }

    const lovableKey = getRuntimeSecret("LOVABLE_API_KEY");
    if (!lovableKey) {
      console.error("LOVABLE_API_KEY missing from worker env");
      return { category: "egyeb", confidence: 0, reasoning: "missing LOVABLE_API_KEY", documentDate: null };
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
   Keywords: invoice, INVOICE, "Invoice No", "Invoice Number", "Customer No", "Customer Number", számla, rechnung, factura, bill, receipt, nyugta, proforma, díjbekérő, "előleg számla", végszámla, "storno számla", "credit note", "debit note", "NAV online számla"
   STRONG SIGNAL (override everything): If content contains "INVOICE" or "Invoice No" or "Customer No" AND a price/quantity table (qty, unit price, amount, total) → ALWAYS szamlak with confidence ≥ 0.95.
   Also: invoice number ("számlaszám", "Invoice No"), VAT/ÁFA line, nettó/bruttó totals, "fizetési határidő", "teljesítés kelte". If document clearly has price + VAT + invoice number → ALWAYS szamlak even without keyword match (confidence ≥ 0.92).

2) szerzodesek — SZERZŐDÉSEK (Contracts), 10 év, strict
   Keywords: contract, agreement, szerződés, megállapodás, keretszerződés, "bérleti szerződés", "adás-vételi szerződés", "adásvételi szerződés", adásvételi, "vállalkozási szerződés", "megbízási szerződés"
   STRONG SIGNAL: "adás-vételi" or "adásvételi" in filename OR content → szerzodesek with confidence ≥ 0.90.
   IMPORTANT: Only classify as szerzodesek if the document contains ACTUAL CONTRACT LANGUAGE: named parties (Eladó/Vevő, Megbízó/Megbízott, Bérbeadó/Bérlő), mutual obligations/rights, signature lines, contract clauses (§, pontok). A document merely titled "feljegyzés" or "emlékeztető" WITHOUT these elements is NOT szerzodesek — it goes to belso.

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
   Keywords: "belső irat", belső, feljegyzés, emlékeztető, előterjesztés, szabályzat, SZMSZ, házirend, protokoll, "belső utasítás", memo, jegyzőkönyv
   STRONG SIGNAL: Documents titled "feljegyzés", "emlékeztető", or "belső irat" WITHOUT contract parties/obligations/signatures → belso (confidence ≥ 0.90), NOT szerzodesek.

10) egyeb — EGYÉB (Other) — only when nothing else clearly matches.${customKeywordsBlock}

CONFIDENCE RULES:
- Strong INVOICE signal (INVOICE/Invoice No/Customer No + price table) → szamlak, confidence ≥ 0.95.
- Any clear keyword match in filename OR content → confidence ≥ 0.90.
- Invoice-shape detected (price + VAT/ÁFA + invoice number) → szamlak, confidence ≥ 0.92.
- "adás-vételi"/"adásvételi" → szerzodesek, confidence ≥ 0.90.
- Ambiguous between two categories → choose the most specific (utility-provider invoice → kozuzemi over szamlak; bank statement → banki) and use 0.70–0.85.
- Truly unclear / no signal → egyeb with confidence < 0.5.
- Never invent matches. If you cannot justify a keyword/structural cue, lower the confidence.

DATE EXTRACTION:
- Extract the document's OWN date: invoice date ("számla kelte", "kelt", "issue date", "invoice date"), contract signing date, statement period end, tax return period end. NOT the upload date and NOT due date ("fizetési határidő") unless no other date exists.
- Accept Hungarian formats (2024.03.15, 2024. március 15., 15/03/2024, etc.) and normalize to ISO YYYY-MM-DD.
- CRITICAL — do NOT confuse numeric IDs with dates:
  * Invoice numbers like "151111", "34401", "2024/00123", "INV-2024-001" are NOT dates.
  * 6-digit numbers without separators (e.g., "151111") are NOT YYMMDD dates — ignore them.
  * Customer numbers, order numbers, reference codes are NOT dates.
  * Only extract a date if it appears in a recognizable calendar format with separators (., /, -, space) AND is contextually labeled as a date (kelt, dátum, date, issued, signed, etc.) OR appears near such labels.
- If unsure, return null. Do not guess.

OUTPUT: Respond with STRICT JSON only, no prose, no markdown:
{"category":"<id from list above>","confidence":<0..1 number>,"reasoning":"<short Hungarian explanation, mention which keyword matched>","documentDate":"YYYY-MM-DD" or null}`;

    const userPrompt = `FILENAME: ${data.filename}
MIME: ${data.mimeType ?? "unknown"}
${data.sample ? `CONTENT SAMPLE (first 3000 chars):\n${data.sample.slice(0, 3000)}` : "CONTENT SAMPLE: (none — classify from filename only)"}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Lovable AI gateway error", res.status, text);
        return { category: hard ?? "egyeb", confidence: hard ? 1 : 0, reasoning: `http ${res.status}`, documentDate: null };
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
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

