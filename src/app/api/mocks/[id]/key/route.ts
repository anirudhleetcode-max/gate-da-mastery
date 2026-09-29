import { NextResponse } from "next/server";
import { getMock, getMockQuestions } from "@/lib/server/repo";
import { buildPayload } from "@/lib/server/payload";

/** Answers + full solutions, fetched by the client only after a mock is submitted. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = getMock(id);
  if (!test) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ test, questions: getMockQuestions(id).map(buildPayload) });
}
