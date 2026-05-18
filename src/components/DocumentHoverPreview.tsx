import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { DocumentThumbnail } from "./DocumentThumbnail";
import type { DocumentRow } from "@/lib/supabase";
import { getCategory } from "@/lib/categories";

export function DocumentHoverPreview({
  doc,
  children,
}: {
  doc: DocumentRow;
  children: React.ReactNode;
}) {
  const cat = getCategory(doc.category);
  return (
    <HoverCard openDelay={500} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-80 p-3">
        <DocumentThumbnail
          path={doc.storage_path}
          mimeType={doc.mime_type}
          maxWidth={600}
          className="w-full h-56 rounded-md"
          alt={doc.filename}
        />
        <div className="mt-2">
          <p className="text-sm font-medium truncate">{doc.filename}</p>
          <p className="text-xs text-muted-foreground">{cat.label}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
