# Workspace Members for Vállalati plan

Per your clarification, this builds on the existing `shared_access` system (owner invites by email + chooses categories) and adds role-based write access for Vállalati subscribers. NAV removal is already complete from the previous turn.

## 1. Database changes (migration)

**`shared_access` table — add columns:**
- `role text not null default 'viewer'` — `'viewer' | 'editor'`
- (no other schema change needed; categories array already exists)

**RLS policy updates:**
- `documents`: add INSERT policy — allow when an accepted `shared_access` row exists with `invited_user_id = auth.uid()`, `role = 'editor'`, and the target category is in `sa.categories`. UPDATE policy similarly. **No DELETE** for editors (per your choice).
- `custom_categories`: editors get SELECT only (no schema mutation).
- Existing viewer SELECT policies stay as-is.

**Helper function** `public.is_workspace_editor(_owner uuid, _category text)` (SECURITY DEFINER) used by the new INSERT/UPDATE policies to avoid recursion.

**Server-side guard:** trigger on `shared_access` INSERT — reject if owner's active member count (status in pending/accepted, distinct invited_email) ≥ 5, or if owner's subscription plan ≠ `vallalati`. Keeps the 5-member cap and Vállalati gate enforceable even outside the UI.

## 2. UI — Profile & Settings page

New card **"Munkaterület tagok"**, only rendered when `subscription.plan === 'vallalati'`:
- List of active shares (email, role, status, accepted/pending, categories count)
- "Tag meghívása" form: email, role select (Szerkesztő/Olvasó), category multi-select (reuse existing category picker from sharing page)
- Per-row: change role, revoke (delete shared_access)
- Counter "X / 5 aktív tag"
- Invite button disabled at 5

Invitation flow reuses existing `send-invitation` edge function (already wired for sharing). New rows just carry `role`.

## 3. Sidebar — workspace badge

In `src/routes/dashboard.tsx` sidebar, for Vállalati owners show a small badge: **"Munkaterület · N tag"** linking to the new profile section. Count = accepted shares for current user.

## 4. Audit log — actor attribution

`src/routes/audit.tsx`:
- Query also fetches profiles for distinct `user_id`s and joins client-side, showing `full_name (email)` per row.
- For workspace owners, also include audit entries where `user_id` is one of their accepted workspace members (so the owner sees member actions in their own audit view).

## 5. Pricing/feature text

- `src/routes/subscription.tsx` Vállalati card: append "Akár 5 munkatárs hozzáadása — közös munkaterület audit naplóval".
- `src/routes/index.tsx` Vállalati feature list: same line.

## Technical notes

- All new code reads `subscription.plan` via existing `useSubscription()` hook — no new entitlement plumbing.
- Member cap (5) and plan gate enforced both in UI and in the DB trigger.
- Editors cannot delete (DB has no INSERT-time DELETE policy for them); attempting a delete from UI is hidden via role check.
- The existing `accept-invitation` flow already handles `invited_user_id` linkage on accept — no change.

## Files touched

- new migration (shared_access.role, INSERT/UPDATE policies on documents, trigger, helper fn)
- `src/routes/profile.tsx` — add Workspace Members card
- `src/routes/dashboard.tsx` — sidebar badge
- `src/routes/audit.tsx` — show actor + include member actions
- `src/routes/subscription.tsx` — pricing text
- `src/routes/index.tsx` — pricing text

Confirm and I'll implement.