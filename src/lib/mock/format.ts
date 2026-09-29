/**
 * Small display formatters for the mock pages (client-side, local time).
 */

/** Seconds as "45s", "2:05" or "1:02:05". */
export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  if (m) return `${m}:${String(r).padStart(2, "0")}`;
  return `${r}s`;
}

/** Minutes as "30 min" or "3 h" / "1 h 30 min". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO date-time → "29 Sep 2026, 14:05" in the viewer's local time. Client-only (depends on the time zone). */
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Signed marks: "+2", "−0.67", "0". */
export function signedMarks(x: number): string {
  const r = Math.round(x * 100) / 100;
  if (r === 0) return "0";
  const abs = Number.isInteger(Math.abs(r)) ? String(Math.abs(r)) : Math.abs(r).toFixed(2);
  return `${r > 0 ? "+" : "−"}${abs}`;
}
