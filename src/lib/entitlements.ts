/**
 * Plan-based entitlements. Read by both UI guards and server-side checks.
 *
 * Plans: alap | pro | vallalati. A `null` plan = no subscription row yet.
 * `isTrialing` users get Pro-level access for the duration of the trial.
 */

export type Plan = "alap" | "pro" | "vallalati";

export type Capability =
  | "ai_categorization"      // pro+
  | "bulk_upload"             // pro+ (more than 1 file at a time)
  | "custom_categories"       // pro+
  | "unlimited_documents"     // pro+ (alap = 100 doc cap)
  | "audit_export"            // vallalati
  | "sharing";                // vallalati

/** Monthly document upload cap. null = unlimited. */
export const DOCUMENT_CAP: Record<Plan, number | null> = {
  alap: 200,
  pro: 500,
  vallalati: null,
};

/** Total storage cap in bytes. null = unlimited. */
export const STORAGE_CAP: Record<Plan, number | null> = {
  alap: 5 * 1024 * 1024 * 1024,
  pro: 25 * 1024 * 1024 * 1024,
  vallalati: 100 * 1024 * 1024 * 1024,
};

const MATRIX: Record<Plan, Capability[]> = {
  alap: [],
  pro: ["ai_categorization", "bulk_upload", "custom_categories", "unlimited_documents"],
  vallalati: [
    "ai_categorization",
    "bulk_upload",
    "custom_categories",
    "unlimited_documents",
    "audit_export",
    "sharing",
  ],
};

export function can(
  plan: Plan | null | undefined,
  cap: Capability,
  opts?: { isTrialing?: boolean },
): boolean {
  // Trialing users get Pro-equivalent access (but not Vállalati extras).
  if (opts?.isTrialing) return MATRIX.pro.includes(cap);
  if (!plan) return false;
  return MATRIX[plan].includes(cap);
}

/** Monthly document cap for the user's plan. Trialing → Pro cap. */
export function documentCap(plan: Plan | null | undefined, isTrialing?: boolean): number | null {
  if (isTrialing) return DOCUMENT_CAP.pro;
  if (!plan) return 0;
  return DOCUMENT_CAP[plan];
}

/** Storage cap in bytes for the user's plan. Trialing → Pro cap. */
export function storageCap(plan: Plan | null | undefined, isTrialing?: boolean): number | null {
  if (isTrialing) return STORAGE_CAP.pro;
  if (!plan) return 0;
  return STORAGE_CAP[plan];
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  ai_categorization: "AI kategorizálás",
  bulk_upload: "Tömeges feltöltés",
  custom_categories: "Egyéni kategóriák",
  unlimited_documents: "Korlátlan dokumentum",
  audit_export: "Audit napló export",
  sharing: "Megosztás más felhasználókkal",
};

export function upgradeMessage(cap: Capability): string {
  const tier =
    cap === "audit_export" || cap === "sharing" ? "Vállalati" : "Pro";
  return `${CAPABILITY_LABELS[cap]} — ${tier} csomag szükséges`;
}
