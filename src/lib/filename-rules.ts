// Client-safe filename keyword rules for document categorization.
// Kept in a separate module so client bundles do not pull in any server-only
// imports from ai.functions.ts.

export const FILENAME_CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  {
    category: "szamlak",
    keywords: [
      "invoice", "számla", "szamla", "rechnung", "factura",
      "nyugta", "bill", "receipt", "proforma", "díjbekérő", "dijbekero",
    ],
  },
  {
    category: "szerzodesek",
    keywords: ["contract", "szerződés", "szerzodes", "agreement", "megállapodás", "megallapodas"],
  },
  {
    category: "szallitolevek",
    keywords: [
      "delivery", "szállítólevél", "szallitolevel", "szallito",
      "ekáer", "ekaer", "fuvarlevél", "fuvarlevel", "cmr",
    ],
  },
];

export function matchFilenameRule(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const rule of FILENAME_CATEGORY_RULES) {
    if (rule.keywords.some((k) => lower.includes(k.toLowerCase()))) return rule.category;
  }
  return null;
}
