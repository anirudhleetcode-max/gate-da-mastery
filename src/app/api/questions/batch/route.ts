import { NextResponse } from "next/server";
import { getQuestion } from "@/lib/server/repo";
import { buildPayload } from "@/lib/server/payload";

/** GET /api/questions/batch?ids=a,b,c (max 60) → QuestionPayload[] in the given order. */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  const out = ids.map((id) => getQuestion(id)).filter((q) => q !== undefined).map((q) => buildPayload(q!));
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" } });
}
