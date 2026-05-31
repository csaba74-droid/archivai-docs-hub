import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  GRACE_AUDIT_NOTE,
  formatGraceRemaining,
  getGraceRemainingMs,
} from "@/lib/grace-period";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MoreVertical,
  Lock,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Eye,
  Download,
  Pencil,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import type { DocumentRow } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { getSignedUrl } from "@/lib/signed-url";
import { logAudit } from "@/lib/audit";
import { useCategories, useCategoryHelpers } from "@/hooks/use-categories";
import type { Category } from "@/lib/categories";

// Category badge colors (background + text)
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  szamlak: { bg: "#F59E0B", text: "#ffffff" },          // orange
  szerzodesek: { bg: "#1A2B4A", text: "#ffffff" },      // navy
  szallitolevek: { bg: "#10B981", text: "#ffffff" },    // green
  munkaugyi: { bg: "#8B5CF6", text: "#ffffff" },        // purple
  adobevallasok: { bg: "#EF4444", text: "#ffffff" },    // red
  kozuzemi: { bg: "#3B82F6", text: "#ffffff" },         // blue
  banki: { bg: "#14B8A6", text: "#ffffff" },            // teal
  muszaki: { bg: "#6B7280", text: "#ffffff" },          // grey
  belso: { bg: "#7DD3FC", text: "#0c4a6e" },            // light blue
  egyeb: { bg: "#9CA3AF", text: "#ffffff" },            // grey
};

type FileType = "pdf" | "word" | "excel" | "image" | "other";

function getFileType(filename: string, mime: string | null): FileType {
  const lower = filename.toLowerCase();
  const m = (mime ?? "").toLowerCase();
  if (m === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (m.includes("word") || lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
  if (m.includes("sheet") || m.includes("excel") || lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv")) return "excel";
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg|heic)$/.test(lower)) return "image";
  return "other";
}

const FILE_TYPE_STYLES: Record<FileType, { bg: string; label: string; Icon: typeof FileText }> = {
  pdf: { bg: "bg-red-500", label: "PDF", Icon: FileText },
  word: { bg: "bg-blue-500", label: "DOC", Icon: FileText },
  excel: { bg: "bg-green-500", label: "XLS", Icon: FileSpreadsheet },
  image: { bg: "bg-purple-500", label: "IMG", Icon: ImageIcon },
  other: { bg: "bg-gray-500", label: "FILE", Icon: File },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
}

export function DocumentCard({
  doc,
  category,
  strict,
  canDelete,
  onOpen,
  onDelete,
  onRenamed,
  onMoved,
}: {
  doc: DocumentRow;
  category: Category;
  strict: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onRenamed: (doc: DocumentRow) => void;
  onMoved?: (doc: DocumentRow) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [graceRemainingMs, setGraceRemainingMs] = useState(() => getGraceRemainingMs(doc.created_at));
  const inGrace = graceRemainingMs > 0;
  useEffect(() => {
    const initial = getGraceRemainingMs(doc.created_at);
    setGraceRemainingMs(initial);
    if (initial <= 0) return;
    const id = window.setInterval(() => {
      const left = getGraceRemainingMs(doc.created_at);
      setGraceRemainingMs(left);
      if (left <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [doc.created_at]);
  const { all: allCategories } = useCategories();
  const { getRoot } = useCategoryHelpers();
  const moveRoot = getRoot(doc.category);
  const fileType = getFileType(doc.filename, doc.mime_type);
  const fileStyle = FILE_TYPE_STYLES[fileType];
  const FileTypeIcon = fileStyle.Icon;

  // Category badge style: custom -> use cat.color; built-in -> map; fallback grey
  const catStyle = category.custom && category.color
    ? { bg: category.color, text: "#ffffff" }
    : CATEGORY_COLORS[category.id] ?? { bg: "#9CA3AF", text: "#ffffff" };

  const handleDownload = async () => {
    const url = await getSignedUrl(doc.storage_path);
    if (!url) {
      toast.error("Letöltés sikertelen");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    void logAudit("download", doc.id, { filename: doc.filename });
  };

  const handleRename = async () => {
    const newName = window.prompt("Új fájlnév:", doc.filename);
    if (!newName || newName.trim() === "" || newName === doc.filename) return;
    const { data, error } = await supabase
      .from("documents")
      .update({ filename: newName.trim() })
      .eq("id", doc.id)
      .select()
      .single();
    if (error) {
      toast.error("Átnevezés sikertelen", { description: error.message });
      return;
    }
    void logAudit("rename", doc.id, { from: doc.filename, to: newName.trim() });
    toast.success("Átnevezve");
    onRenamed(data as DocumentRow);
  };

  const handleMove = async (targetCatId: string) => {
    if (targetCatId === doc.category) {
      setMoveOpen(false);
      return;
    }
    setMoving(true);
    const targetCat = allCategories.find((c) => c.id === targetCatId);
    const { data, error } = await supabase
      .from("documents")
      .update({ category: targetCatId, itm_compliant: targetCat?.mode === "strict" })
      .eq("id", doc.id)
      .select()
      .single();
    setMoving(false);
    if (error) {
      toast.error("Áthelyezés sikertelen", { description: error.message });
      return;
    }
    void logAudit("move", doc.id, {
      from: doc.category,
      to: targetCatId,
      ...(inGrace ? { within_grace: true, note: GRACE_AUDIT_NOTE } : {}),
    });
    toast.success(`Dokumentum áthelyezve: ${targetCat?.label ?? targetCatId}`);
    setMoveOpen(false);
    onMoved?.(data as DocumentRow);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => {
        if (menuOpen) return;
        onOpen();
      }}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className={`group relative cursor-pointer p-3 flex items-center gap-3 hover:shadow-md hover:border-primary/40 transition-all ${strict ? "border-lock/40" : ""}`}
    >
      {/* File type icon */}
      <div className={`h-9 w-9 rounded-md ${fileStyle.bg} flex items-center justify-center shrink-0`}>
        <FileTypeIcon className="h-4 w-4 text-white" />
      </div>

      {/* Middle: filename + badge + date */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-semibold truncate leading-tight" title={doc.filename}>
          {doc.filename}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            className="text-[10px] py-0 h-4 px-1.5 border-transparent font-medium"
            style={{ backgroundColor: catStyle.bg, color: catStyle.text }}
          >
            {category.label}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(doc.created_at)}
          </span>
          {inGrace && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 h-4 px-1.5 gap-1 border-brand/40 text-brand bg-brand/5 font-medium"
              title="Visszavonási ablak — ezen idő alatt áthelyezhető vagy törölhető"
            >
              <Clock className="h-2.5 w-2.5" />
              {formatGraceRemaining(graceRemainingMs)}
            </Badge>
          )}
        </div>
      </div>

      {/* Right: lock + menu */}
      <div className="flex items-center gap-1 shrink-0">
        {strict && <Lock className="h-3.5 w-3.5 text-lock" />}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="h-7 w-7 rounded-md flex items-center justify-center opacity-60 md:opacity-0 md:group-hover:opacity-100 data-[state=open]:opacity-100 hover:bg-muted transition-opacity"
              aria-label="Műveletek"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => onOpen()}>
              <Eye className="h-4 w-4" /> Megnyitás
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleDownload()}>
              <Download className="h-4 w-4" /> Letöltés
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleRename()}>
              <Pencil className="h-4 w-4" /> Átnevezés
            </DropdownMenuItem>
            {strict && !inGrace ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem disabled onSelect={(e) => e.preventDefault()}>
                        <Lock className="h-4 w-4" /> Áthelyezés
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Törvényileg védett dokumentum nem helyezhető át
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
                <ArrowRightLeft className="h-4 w-4" /> Áthelyezés
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canDelete}
              onSelect={() => onDelete()}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Törlés
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Melyik kategóriába helyezi át?</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-2">
            {allCategories
              .filter((c) => c.id !== doc.category)
              .map((c) => {
                const dotColor = c.custom && c.color
                  ? c.color
                  : (CATEGORY_COLORS[c.id]?.bg ?? "#9CA3AF");
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={moving}
                    onClick={() => void handleMove(c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left text-sm disabled:opacity-50"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.mode === "strict" && <Lock className="h-3 w-3 text-lock" />}
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
