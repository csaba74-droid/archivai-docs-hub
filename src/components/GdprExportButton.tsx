import { useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase, type DocumentRow, type AuditLogRow } from "@/lib/supabase";

const CATEGORY_LABELS: Record<string, string> = {
  szamlak: "Számlák",
  szerzodesek: "Szerződések",
  szallitolevelek: "Szállítólevelek",
  szallitolevek: "Szállítólevelek",
  munkaugyi_iratok: "Munkaügyi iratok",
  adobevallesok: "Adóbevallások",
  kozuzemi_szamlak: "Közüzemi számlák",
  banki_dokumentumok: "Banki dokumentumok",
  muszaki_dokumentumok: "Műszaki dokumentumok",
  belso_iratok: "Belső iratok",
  egyeb: "Egyéb",
};

const ACTION_PLAIN: Record<string, string> = {
  upload: "Feltöltés",
  view: "Megtekintés",
  download: "Letöltés",
  delete: "Törlés",
  delete_blocked: "Törlés megtagadva",
  search: "Keresés",
  categorize: "Kategorizálás",
};

const META_KEY_LABELS: Record<string, string> = {
  category: "Kategória",
  filename: "Fájlnév",
  original_filename: "Eredeti fájlnév",
  confidence: "Bizonyosság",
  ai_confidence: "Bizonyosság",
  size_bytes: "Méret",
  mime_type: "Típus",
  query: "Keresés",
  reason: "Indok",
  document_date: "Dokumentum dátuma",
};

function categoryLabel(c: string | null | undefined): string {
  if (!c) return "";
  if (c.startsWith("custom:")) return "Egyéni kategória";
  return CATEGORY_LABELS[c] ?? c;
}

function formatHu(iso: string) {
  try {
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return iso; }
}

function formatMetaValue(key: string, value: unknown): string {
  if (value == null) return "";
  if (key === "category" && typeof value === "string") return categoryLabel(value);
  if ((key === "confidence" || key === "ai_confidence") && typeof value === "number") return `${Math.round(value * 100)}%`;
  if (key === "size_bytes" && typeof value === "number") {
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    if (value >= 1024) return `${Math.round(value / 1024)} KB`;
    return `${value} B`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatMetaReadable(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  return Object.entries(meta)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${META_KEY_LABELS[k] ?? k}: ${formatMetaValue(k, v)}`)
    .join(" | ");
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 180);
}

export function GdprExportButton() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const handleExport = async () => {
    setBusy(true);
    setProgress(0);
    setStatus("Felhasználói adatok betöltése...");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Nincs bejelentkezett felhasználó");

      setStatus("Dokumentumok lekérése...");
      const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (docsErr) throw docsErr;
      const documents = (docs ?? []) as DocumentRow[];

      setStatus("Audit napló lekérése...");
      const { data: logs, error: logsErr } = await supabase
        .from("audit_log")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (logsErr) throw logsErr;
      const auditRows = (logs ?? []) as AuditLogRow[];

      const zip = new JSZip();

      // Document list CSV
      const docHeader = ["Fájlnév", "Feltöltés dátuma", "Dokumentum dátuma", "Kategória", "Megőrzési határidő", "SHA-256", "Méret (byte)"];
      const docLines = [docHeader.join(",")];
      for (const d of documents) {
        docLines.push([
          d.original_filename || d.filename,
          formatHu(d.created_at),
          d.document_date ?? "",
          categoryLabel(d.category),
          d.itm_compliant ? "Kötelező (törvényi)" : "Szabad tárolás",
          d.sha256 ?? "",
          d.size_bytes ?? "",
        ].map(esc).join(","));
      }
      zip.file("dokumentum-lista.csv", "\ufeff" + docLines.join("\n"));

      // Audit log CSV
      const auditHeader = ["Dátum", "Művelet", "Dokumentum azonosító", "Részletek"];
      const auditLines = [auditHeader.join(",")];
      for (const r of auditRows) {
        auditLines.push([
          formatHu(r.created_at),
          ACTION_PLAIN[r.action] ?? r.action,
          r.document_id ?? "",
          formatMetaReadable(r.metadata),
        ].map(esc).join(","));
      }
      zip.file("audit-naplo.csv", "\ufeff" + auditLines.join("\n"));

      // Summary text
      const summary = [
        "Az Archivai rendszerből exportált adatok - GDPR 20. cikk alapján",
        "",
        `Felhasználó email: ${user.email ?? ""}`,
        `Regisztráció dátuma: ${user.created_at ? formatHu(user.created_at) : ""}`,
        `Összes dokumentum száma: ${documents.length}`,
        `Audit napló bejegyzések: ${auditRows.length}`,
        `Exportálás dátuma: ${formatHu(new Date().toISOString())}`,
      ].join("\n");
      zip.file("archivai-adatok.txt", summary);

      // Documents
      const folder = zip.folder("dokumentumok")!;
      const total = documents.length;
      let done = 0;
      for (const d of documents) {
        setStatus(`Dokumentum letöltése (${done + 1}/${total}): ${d.original_filename || d.filename}`);
        try {
          const { data: blob, error } = await supabase.storage.from("documents").download(d.storage_path);
          if (error || !blob) throw error ?? new Error("download failed");
          const name = sanitizeName(d.original_filename || d.filename);
          // Prefix with ID to avoid filename collisions
          folder.file(`${d.id.slice(0, 8)}_${name}`, blob);
        } catch (e) {
          console.warn("Nem sikerült letölteni:", d.storage_path, e);
        }
        done++;
        setProgress(Math.round((done / Math.max(total, 1)) * 90));
      }

      setStatus("ZIP fájl generálása...");
      const zipBlob = await zip.generateAsync({ type: "blob" }, (m) => {
        setProgress(90 + Math.round(m.percent / 10));
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `archivai-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setProgress(100);
      setStatus("Kész");
      toast.success("Export elkészült", { description: `${documents.length} dokumentum letöltve` });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Ismeretlen hiba";
      toast.error("Export hiba", { description: msg });
    } finally {
      setTimeout(() => { setBusy(false); setProgress(0); setStatus(""); }, 1200);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={handleExport} disabled={busy} size="lg" className="w-full sm:w-auto">
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
        📥 Adataim exportálása (GDPR)
      </Button>
      <p className="text-xs text-muted-foreground max-w-xl">
        Letöltheti az összes dokumentumát és adatát ZIP formátumban. A feldolgozás néhány percet vehet igénybe.
      </p>
      {busy && (
        <div className="space-y-1 max-w-xl pt-2">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
      )}
    </div>
  );
}
