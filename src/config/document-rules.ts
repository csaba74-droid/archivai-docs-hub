// SINGLE SOURCE OF TRUTH for document categorization rules.
// DO NOT auto-modify or regenerate this file. Add new rules HERE only.
// Runs client-side BEFORE any API call.

export const FILENAME_RULES: { keywords: string[]; category: string; itm: boolean; retention_years: number | null }[] = [
  {
    keywords: ['invoice', 'számla', 'szamla', 'rechnung', 'factura', 'nyugta', 'bill', 'receipt', 'proforma', 'díjbekérő', 'dijbekero', 'vegszamla', 'végszámla', 'sztorno', 'storno', 'credit note', 'debit note'],
    category: 'szamlak',
    itm: true,
    retention_years: 10,
  },
  {
    keywords: ['contract', 'szerződés', 'szerzodes', 'agreement', 'megállapodás', 'megallapodas', 'keretszerződés', 'keretsz', 'bérleti', 'berleti', 'adásvétel', 'adasvetel', 'vállalkozási', 'vallalkozasi', 'megbízási', 'megbizasi'],
    category: 'szerzodesek',
    itm: true,
    retention_years: 10,
  },
  {
    keywords: ['delivery', 'szállítólevél', 'szallitolevel', 'szállító', 'szallito', 'ekáer', 'ekaer', 'fuvarlevél', 'fuvarlevel', 'cmr', 'packing list', 'csomagjegyzék', 'csomagjegyzek', 'átadás', 'atadas'],
    category: 'szallitolevelek',
    itm: true,
    retention_years: 10,
  },
  {
    keywords: ['munkaszerződés', 'munkaszerzodes', 'bérjegyzék', 'berjegyzek', 'payslip', 'payroll', 'munkabér', 'munkaber', 'jelenléti', 'jelenleti', 'szabadság', 'szabadsag', 'kilépő', 'kilepo', 'belépő', 'belepo', 'hr'],
    category: 'munkaugyi_iratok',
    itm: true,
    retention_years: null,
  },
  {
    keywords: ['adóbevallás', 'adobevalles', 'bevallás', 'bevalles', 'nav', 'apeh', 'tax return', 'iparűzési', 'iparuzesi', 'társasági adó', 'tarsasagi', 'szja', 'áfa bevallás', 'afa bevalles'],
    category: 'adobevallesok',
    itm: true,
    retention_years: 6,
  },
  {
    keywords: ['közüzemi', 'kozuzemi', 'villany', 'víz', 'viz', 'gáz', 'gaz', 'távhő', 'tavho', 'e.on', 'eon', 'mvm', 'elmű', 'elmu', 'émász', 'emasz', 'nkm', 'tigáz', 'tigaz', 'telekom', 'vodafone', 'telenor', 'digi', 'upc', 'utility'],
    category: 'kozuzemi_szamlak',
    itm: false,
    retention_years: 5,
  },
  {
    keywords: ['bank', 'bankszámla', 'bankszamla', 'kivonat', 'hitel', 'kölcsön', 'kolcson', 'törlesztés', 'torlesztes', 'swift', 'iban', 'otp', 'k&h', 'raiffeisen', 'unicredit', 'cib', 'mkb', 'erste'],
    category: 'banki_dokumentumok',
    itm: false,
    retention_years: 5,
  },
  {
    keywords: ['kézikönyv', 'kezikonyv', 'manual', 'műszaki', 'muszaki', 'specifikáció', 'specifikacio', 'tervrajz', 'garancia', 'szerviz', 'dokumentáció', 'dokumentacio', 'használati', 'hasznalati'],
    category: 'muszaki_dokumentumok',
    itm: false,
    retention_years: null,
  },
];

export function matchFilenameCategory(filename: string): { category: string; itm: boolean; retention_years: number | null } | null {
  const f = filename.toLowerCase();
  for (const rule of FILENAME_RULES) {
    if (rule.keywords.some((kw) => f.includes(kw))) {
      return { category: rule.category, itm: rule.itm, retention_years: rule.retention_years };
    }
  }
  return null;
}
