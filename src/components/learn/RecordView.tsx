"use client";
import { useEffect } from "react";
import { useUserData } from "@/lib/userdata/hooks";
import { localDay, type ViewRow } from "@/lib/userdata/db";

/**
 * Records that the student opened a concept or strategy article (db.views,
 * one row per item holding the latest view). The effect only writes to
 * IndexedDB; it never sets React state. Renders nothing.
 */
export function RecordView({ kind, refId }: { kind: ViewRow["kind"]; refId: string }) {
  const { db } = useUserData();
  useEffect(() => {
    if (!db) return;
    const now = new Date();
    db.views.put({ key: `${kind}:${refId}`, kind, refId, viewedAt: now.toISOString(), day: localDay(now) }).catch(() => {
      /* storage full or blocked: a missed view record is harmless */
    });
  }, [db, kind, refId]);
  return null;
}
