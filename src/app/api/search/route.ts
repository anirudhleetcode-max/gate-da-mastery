import { NextResponse } from "next/server";
import { searchContent } from "@/lib/server/repo";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ q, results: searchContent(q, 80) });
}
