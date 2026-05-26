// 10-minute "undo window" after upload during which a document can be moved or
// deleted even if it belongs to a legally locked (strict) category.

export const GRACE_PERIOD_MS = 10 * 60 * 1000;
export const GRACE_AUDIT_NOTE = "Módosítva a visszavonási ablakon belül";

export function getGraceRemainingMs(createdAt: string): number {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, GRACE_PERIOD_MS - elapsed);
}

export function isInGracePeriod(createdAt: string): boolean {
  return getGraceRemainingMs(createdAt) > 0;
}

export function formatGraceRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
