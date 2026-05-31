## Cél

Korlátlan mélységű almappa-fa minden főkategória (beépített és egyéni) alatt. Almappa-szintű fa megjelenik a sidebarban és a dashboardon. Dokumentumok mozgathatók ugyanazon főkategória fáján belül.

## Adatmodell (1 migráció)

A `custom_categories` táblára:

- `parent_id uuid null` → FK `custom_categories.id` ON DELETE RESTRICT (custom szülő)
- `parent_builtin text null` → ha a szülő egy beépített kategória (pl. `"szamlak"`)
- `root_builtin text null` → a fa gyökerének beépített kulcsa, ha a fa egy beépített alá lóg (mozgatás-ellenőrzéshez); ha custom gyökér, akkor null
- CHECK: `parent_id` és `parent_builtin` legfeljebb az egyik nem-null
- Validation trigger: nem lehet ciklus; subfolder mode/retention öröklődik a gyökértől létrehozáskor (de szerkeszthető)
- `is_system = true` rekord törlése továbbra is tiltott
- Almappa törlése csak akkor megengedett, ha üres (nincs dokumentum a category-jén és nincs gyermek almappa) — RLS-be nem tehető, ezért dialógus + trigger

A `documents.category` továbbra is **az adott (al)mappa azonosítója**: `"szamlak"`, vagy `"custom:<uuid>"`. Nem változik a séma a documents oldalon.

## Frontend

### `src/hooks/use-categories.tsx`
- `customRows` betölti az új mezőket
- Új helper: `buildTree(allCats)` → `TreeNode[]` (rekurzív children)
- Új helper: `getRootId(catId)` → a fa gyökerének id-je (beépítettnél `"szamlak"`, customnál a top-level custom id)
- `create({ ..., parentId?, parentBuiltin? })` paraméterezhető
- `remove(id)` megpróbálja a törlést; RLS / FK hiba → toast „Nem üres mappa"

### `src/components/CustomCategoryDialog.tsx`
- Új `parent` prop (`{ kind: "builtin", id: string } | { kind: "custom", id: string } | null`)
- Ha van parent, a dialógus címe „Új almappa a(z) X alatt", a name/color/mode örökölhető default-tal

### Sidebar — `src/routes/dashboard.tsx` (`mobileCatsNav` + új `desktopCatsNav`)
Jelenleg a desktop sidebar nem mutatja a kategóriákat, csak nav linkeket. Hozzáadunk egy bontható fa-szekciót:
- Built-in main → expand chevron → almappák (children)
- Custom main → ugyanúgy
- Hover/active sorban: `+` ikon → „Új almappa" (megnyitja a dialógust előre-kitöltött parent-tel)
- Almappánál `x` ikon → törlés (csak ha üres)
- Saját `useState<Set<string>>` az expanded szülőknek (localStorage-ben perzisztálva)

### Dashboard kategória nézet
- `CategoryGrid` (`!activeCat` állapot): a kártyák alján kis „almappák" sáv, vagy expand chevron, hogy almappákat is mutasson
- Ha `activeCat` egy szülő: a fejléc breadcrumb + a kártyák felett egy „almappák" csíkban a gyerekek (chip-szerű, kattintható), és új-almappa gomb
- Ha `activeCat` egy almappa: breadcrumb `Összes → Főkategória → Almappa`
- `filtered` szűrés: ha az aktív kategória szülő, akkor leszármazottainak dokumentumai is megjelennek (opcionálisan); MVP-re: csak az aktuális szint dokumentumai

### Dokumentum mozgatás (ugyanazon főkategórián belül)
- `DocumentCard` / preview modal kap egy „Áthelyezés" akciót (már most is van rename/move audit action)
- Dialógus: a doksi gyökér-fájának (`getRootId(doc.category)`) összes leszármazottja listázva (radio vagy select)
- Mentés: `update documents set category = <új>` — kliens validál, hogy ugyanaz a `root`

### Mobil bottom nav / `MobileHome`
- A meglévő mobil kategória-listában minden szülőhöz expand chevron + a gyerekei behúzva alatta
- „Új almappa" sor minden szülő alatt

## Technikai részletek

- Új migráció: `ALTER TABLE custom_categories ADD COLUMN parent_id uuid REFERENCES custom_categories(id) ON DELETE RESTRICT`, `ADD COLUMN parent_builtin text`, `ADD COLUMN root_builtin text`, CHECK + ciklus-trigger
- `types.ts` automatikusan frissül a migráció után
- `Category` típus a `src/lib/categories.ts`-ben kiegészül: `parentId?: string | null` (a fa id-je a kliensen: szülő built-in id vagy `custom:<uuid>`)
- `mergeCategories` topológiai rendezést végez, hogy a children rendben legyenek
- `useCategoryHelpers` új: `getChildren(parentCatId)`, `getRoot(catId)`, `isDescendantOf(a, b)`

## Megerősítendő részek megnyitás előtt

1. Almappák a **beépített** főkategóriák (Számlák, Szerződések…) alatt is engedélyezve legyenek? Igen → mindkét szülő-típus kell (built-in és custom). Nem → csak `parent_id` FK kell.
2. A főkategória dokumentum-listája tartalmazza-e az almappák dokumentumait is, vagy szigorúan csak a saját szintjét?

Ha ezek megvannak, megírom a migrációt, majd a kódot.