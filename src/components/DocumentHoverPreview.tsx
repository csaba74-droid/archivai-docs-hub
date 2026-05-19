import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { FilePreview } from "./FilePreview";
import type { DocumentRow } from "@/lib/supabase";
import { useCategoryHelpers } from "@/hooks/use-categories";

export function DocumentHoverPreview({
  doc,
  children,
}: {
  doc: DocumentRow;
  children: React.ReactNode;
}) {
  const { getCategory } = useCategoryHelpers();
  const cat = getCategory(doc.category);
  return (
    <HoverCard openDelay={500} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-[440px] p-3">
        <FilePreview
          path={doc.storage_path}
          mimeType={doc.mime_type}
          filename={doc.filename}
          variant="large"
          className="w-full h-[500px] rounded-md border"
        />
        <div className="mt-2">
          <p className="text-sm font-medium truncate">{doc.filename}</p>
          <p className="text-xs text-muted-foreground">{cat.label}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
