/**
 * Bookmark mutations that src/lib/userdata/ops.ts does not provide yet.
 * Kept here (and requested as shared ops) so the Bookmarks page never writes
 * to Dexie ad hoc from a component.
 */
import type { GateDaDB } from "@/lib/userdata/db";

/** Set (or clear, with an empty string) the student's note on a bookmark. */
export async function updateBookmarkNote(db: GateDaDB, key: string, note: string): Promise<void> {
  const trimmed = note.trim();
  await db.bookmarks.update(key, { note: trimmed ? note : undefined });
}

/** Remove a bookmark by key (idempotent, unlike toggleBookmark). */
export async function removeBookmark(db: GateDaDB, key: string): Promise<void> {
  await db.bookmarks.delete(key);
}
