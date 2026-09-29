/**
 * GET /settings/demo-pool[?mocks=1]
 *
 * The real question ids (with answer keys, so generated responses are
 * consistent) that Settings → Demo mode may use: every official PYQ, and,
 * only when asked for, the questions of up to two AVAILABLE mock tests.
 * Fetched when the student clicks "Generate demo data", never with the page.
 */
import { NextResponse } from "next/server";
import { demoPool } from "@/components/insights/settings/demoPool";

export async function GET(req: Request) {
  const includeMocks = new URL(req.url).searchParams.get("mocks") === "1";
  return NextResponse.json(demoPool(includeMocks), { headers: { "Cache-Control": "no-store" } });
}
