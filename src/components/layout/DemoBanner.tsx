"use client";
import Link from "next/link";
import { useUserData } from "@/lib/userdata/hooks";

/** Persistent banner whenever the separate demo database is active. */
export function DemoBanner() {
  const { demo, available, ready } = useUserData();
  if (ready && !available) {
    return (
      <div role="status" className="no-print border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-sm text-fg">
        Your browser is blocking local storage, so progress, bookmarks and revision cannot be saved in this window. Content is still fully available.
      </div>
    );
  }
  if (!demo) return null;
  return (
    <div role="status" className="no-print border-b border-warning/40 bg-warning-soft px-4 py-2 text-center text-sm font-medium text-fg">
      DEMO DATA: you are viewing a separate demo database, not your own progress.{" "}
      <Link href="/settings" className="underline">
        Switch back to your data
      </Link>
    </div>
  );
}
