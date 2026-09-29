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

/**
 * A short, inline HTML snippet of a question stem for collapsed list rows.
 * Top-level blocks are kept in document order: paragraphs as they are, short
 * display formulas as inline math, and anything bulky (matrices, tables, code,
 * lists) as an ellipsis, so the clamped snippet never silently skips a part
 * of the sentence. The input is trusted build-time HTML (rendered with RichHtml).
 */
export function stemSnippetHtml(stemHtml: string, maxChars = 240): string {
  const BLOCK = /<p>([\s\S]*?)<\/p>|<div class="math-tex" data-display="true">([\s\S]*?)<\/div>|<(table|pre|ul|ol|div)\b[\s\S]*?<\/\3>/g;
  // Inline matrices / aligned environments would make a collapsed row several lines tall.
  const BULKY_INLINE = /<span class="math-tex" data-display="false">(?:(?!<\/span>)[\s\S])*?\\begin(?:(?!<\/span>)[\s\S])*?<\/span>/g;
  const parts: string[] = [];
  let length = 0;
  for (const m of stemHtml.matchAll(BLOCK)) {
    if (length >= maxChars) break;
    if (m[1] !== undefined) {
      const p = m[1].replace(BULKY_INLINE, "…");
      parts.push(p);
      length += p.replace(/<[^>]+>/g, "").length;
    } else if (m[2] !== undefined && m[2].length <= 60 && !/\\begin|\\\\/.test(m[2])) {
      parts.push(`<span class="math-tex" data-display="false">${m[2]}</span>`);
      length += m[2].length;
    } else if (parts[parts.length - 1] !== "…") {
      parts.push("…");
    }
  }
  return parts.length ? parts.join(" ") : stemHtml.replace(/data-display="true"/g, 'data-display="false"');
}
