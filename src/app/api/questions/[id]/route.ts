import { NextResponse } from "next/server";
import { getQuestion } from "@/lib/server/repo";
import { buildPayload } from "@/lib/server/payload";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = getQuestion(id);
  if (!q) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(buildPayload(q), { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" } });
}
