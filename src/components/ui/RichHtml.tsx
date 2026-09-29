"use client";
import { useMemo } from "react";
import { hydrateMath } from "@/lib/content/math";
import { cn } from "@/lib/utils";

/**
 * Renders trusted, build-time-generated HTML (see src/lib/content/markdown.ts)
 * and hydrates math placeholders with KaTeX. Use in client components.
 */
export function RichHtml({ html, className, as: As = "div" }: { html: string; className?: string; as?: "div" | "span" }) {
  const out = useMemo(() => hydrateMath(html), [html]);
  return <As className={cn("rich", className)} dangerouslySetInnerHTML={{ __html: out }} />;
}
