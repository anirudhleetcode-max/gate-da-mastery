import { hydrateMath } from "@/lib/content/math";
import { cn } from "@/lib/utils";

/** Server-component variant of RichHtml: math is rendered during SSR. */
export function ServerRichHtml({ html, className }: { html: string; className?: string }) {
  return <div className={cn("rich", className)} dangerouslySetInnerHTML={{ __html: hydrateMath(html) }} />;
}
