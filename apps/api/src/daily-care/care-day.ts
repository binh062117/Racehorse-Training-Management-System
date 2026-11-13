/**
 * A care checklist belongs to one Vietnam calendar day. The day is stored as
 * that date at 00:00 UTC, e.g. 13/11 (any hour, Vietnam time) → 2026-11-13T00:00Z.
 */
const VN_OFFSET_MS = 7 * 3600_000;
const DAY_MS = 24 * 3600_000;

/** The care day an instant falls on, in Vietnam time. */
export function careDay(at: Date = new Date()): Date {
  const vn = new Date(at.getTime() + VN_OFFSET_MS);
  return new Date(
    Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()),
  );
}

/** The care day named by a "YYYY-MM-DD" string (anything after the date is ignored). */
export function careDayFromString(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function nextCareDay(day: Date): Date {
  return new Date(day.getTime() + DAY_MS);
}

/** "13/11/2026" for messages. */
export function formatCareDay(day: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(day.getUTCDate())}/${p(day.getUTCMonth() + 1)}/${day.getUTCFullYear()}`;
}
