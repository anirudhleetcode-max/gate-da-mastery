/** Pure helpers shared by the concept library (client) and its page (server). */

export const SUPPORTING_LABEL = "Supporting concept (not an explicit syllabus item)";

export interface LibraryFilters {
  subject: string;
  q: string;
}

/** Reads ?subject=&q= (an unknown subject is ignored). */
export function parseLibraryFilters(get: (k: string) => string | null | undefined, subjectIds: ReadonlySet<string>): LibraryFilters {
  const subject = get("subject") ?? "";
  return { subject: subjectIds.has(subject) ? subject : "", q: (get("q") ?? "").slice(0, 100) };
}

export function libraryQuery(f: LibraryFilters): string {
  const p = new URLSearchParams();
  if (f.subject) p.set("subject", f.subject);
  if (f.q.trim()) p.set("q", f.q);
  return p.toString();
}
