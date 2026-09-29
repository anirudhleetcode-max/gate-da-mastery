import { NextResponse } from "next/server";
import { getBundle } from "@/lib/server/repo";

/** Liveness + content summary for deployment checks. */
export function GET() {
  const b = getBundle();
  return NextResponse.json({
    ok: true,
    contentVersion: b.version,
    builtAt: b.builtAt,
    pyqs: b.questions.filter((q) => q.origin === "OFFICIAL_PYQ").length,
    mocks: b.mocks.length,
    completeMocks: b.mocks.filter((m) => m.available).length,
  });
}
