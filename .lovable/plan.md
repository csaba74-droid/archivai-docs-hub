# Document versioning

## Database
Migration adds two columns to `documents`:
- `parent_document_id uuid` nullable, references `documents(id)` ON DELETE CASCADE
- `version_number integer NOT NULL DEFAULT 1`
- Index on `parent_document_id` for fast version lookups

A document with `parent_document_id = NULL` is the "root". Versions point to the root via `parent_document_id`. The root itself is version 1; subsequent uploads get `version_number = max(existing) + 1`.

## Upload flow (`UploadDialog.tsx` + dashboard upload path)
After AI categorization picks a final category (or user picks one), before insert:
1. Query existing documents where `user_id = me`, `category = chosen`, `filename = chosen filename`, `parent_document_id IS NULL` (root only).
2. If match found → show confirm dialog: "Egy ilyen nevű dokumentum már létezik. Új verzióként szeretné feltölteni?"
   - **Yes** → insert new document row with `parent_document_id = root.id`, `version_number = current_max + 1`. Use same filename/category.
   - **No** → upload normally (current behavior, may produce duplicate filename).
3. If no match → upload normally.

Storage path stays unique per upload (already uses random uuid), so files don't collide.

## Document card (`DocumentCard.tsx`)
- For each root document, count its versions (root + children). If `>1`, render a small badge `v{count}` next to the filename.
- Fetched once per dashboard load: aggregate `{root_id: max_version}` map and pass to cards. Simplest path: include version_number on the row and a `version_count` either via a separate grouped query or a view. Implementation will do a single grouped query `SELECT parent_document_id, COUNT(*)` and merge.

## Preview modal (`DocumentPreviewModal.tsx`)
- On open, fetch all rows where `id = doc.id OR parent_document_id = root_id` (where `root_id = doc.parent_document_id ?? doc.id`).
- New "Verziók" panel in the metadata sidebar listing each version with `v{n}` and upload date, newest first. Click switches the previewed version (updates signed URL + metadata, without closing modal).
- Highlight currently-shown version.

## Deletion guard
Existing delete logic already blocks locked docs. Extension: if a document is a root AND has child versions, deletion of the root is allowed only if none of the versions are locked. Simpler interpretation per spec ("cannot delete older versions of locked documents"): block delete of any version whose root or any sibling is locked. Implementation: in `handleDelete` / bulk delete, when a doc has versions, treat all as locked if any in the chain is locked.

## Dashboard listing
Only root documents (parent_document_id IS NULL) appear in the main grid. Older versions are accessed via the preview modal's Verziók section.

## Out of scope
No changes to sharing, audit-log shape (audit log entries use the version's id naturally), or bulk-move semantics (moving a root does not move its versions — versions inherit root's category logically since they share filename+category at upload time; if user moves root later, versions stay linked by parent_document_id regardless of category).
