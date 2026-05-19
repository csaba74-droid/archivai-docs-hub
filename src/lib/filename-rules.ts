// Client-safe filename keyword rules for document categorization.
// No server imports, no framework imports — only pure string checks.

export function matchFilenameCategory(filename: string): string | null {
  const lower = filename.toLowerCase();

  if (
    lower.includes("invoice") ||
    lower.includes("számla") ||
    lower.includes("szamla") ||
    lower.includes("rechnung") ||
    lower.includes("factura") ||
    lower.includes("nyugta") ||
    lower.includes("bill") ||
    lower.includes("receipt") ||
    lower.includes("proforma") ||
    lower.includes("díjbekérő") ||
    lower.includes("dijbekero")
  ) {
    return "Számlák";
  }

  if (
    lower.includes("contract") ||
    lower.includes("szerződés") ||
    lower.includes("szerzodes") ||
    lower.includes("agreement") ||
    lower.includes("megállapodás") ||
    lower.includes("megallapodas") ||
    lower.includes("keretszerződés")
  ) {
    return "Szerződések";
  }

  if (
    lower.includes("delivery") ||
    lower.includes("szállítólevél") ||
    lower.includes("szallitolevel") ||
    lower.includes("szállító") ||
    lower.includes("szallito") ||
    lower.includes("ekáer") ||
    lower.includes("ekaer") ||
    lower.includes("fuvarlevél") ||
    lower.includes("fuvarlevel") ||
    lower.includes("cmr")
  ) {
    return "Szállítólevelek";
  }

  if (
    lower.includes("munkaszerződés") ||
    lower.includes("munkaszerzodes") ||
    lower.includes("bérjegyzék") ||
    lower.includes("berjegyzek") ||
    lower.includes("payslip") ||
    lower.includes("payroll") ||
    lower.includes("munkabér")
  ) {
    return "Munkaügyi iratok";
  }

  return null;
}
