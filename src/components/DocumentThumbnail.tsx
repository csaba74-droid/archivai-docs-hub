import { FilePreview } from "./FilePreview";

export function DocumentThumbnail({
  path,
  mimeType,
  filename,
  className,
}: {
  path: string;
  mimeType: string | null;
  filename?: string;
  className?: string;
}) {
  return (
    <FilePreview
      path={path}
      mimeType={mimeType}
      filename={filename ?? path}
      variant="thumb"
      className={className}
    />
  );
}
