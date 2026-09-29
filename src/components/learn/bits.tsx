/**
 * Presentational pieces shared by the learning pages. Hook-free, so they
 * render in server components (math is rendered during SSR).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ServerRichHtml } from "@/components/ui/ServerRichHtml";
import { cn } from "@/lib/utils";

/**
 * Keeps whole words in content-table cells (the shared .rich style breaks
 * anywhere, which splits words letter by letter in narrow tables). Tables
 * then take their natural width and scroll inside their .table-wrap box.
 */
export const RICH_TABLES = "[&_td]:[overflow-wrap:break-word] [&_th]:[overflow-wrap:break-word]";

/** A titled card section with a real h2 (for aria-labelledby and the "On this page" list). */
export function LearnSection({
  id,
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("scroll-mt-20 rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="text-[0.95rem] font-semibold text-fg">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-sm text-fg-3">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("px-4 py-4 sm:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * A display formula. Wide formulas scroll inside this box (not the inner math
 * block), which is focusable so keyboard users can scroll it too.
 */
export function FormulaMath({ html, name, className }: { html: string; name: string; className?: string }) {
  return (
    <div role="group" aria-label={`Formula: ${name}`} tabIndex={0} className={cn("overflow-x-auto overflow-y-hidden rounded-md [&_.math-display]:overflow-visible!", className)}>
      <ServerRichHtml html={html} />
    </div>
  );
}

/** "On this page" anchor list. */
export function OnThisPage({ items, className }: { items: { id: string; title: string; count?: number }[]; className?: string }) {
  return (
    <ol className={cn("space-y-0.5 text-sm", className)}>
      {items.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2 py-1 text-fg-2 hover:bg-surface-2 hover:text-fg sm:min-h-8">
            <span className="min-w-0">{s.title}</span>
            {s.count !== undefined ? <span className="tnum text-xs text-fg-3">{s.count}</span> : null}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Previous / next links at the foot of a page. */
export function PrevNext({ label, prev, next, kind }: { label: string; kind: string; prev?: { href: string; title: string } | null; next?: { href: string; title: string } | null }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label={label} className="no-print mt-8 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} className="group flex min-h-12 min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 hover:bg-surface-2">
          <ArrowLeft aria-hidden className="h-4 w-4 shrink-0 text-fg-3" />
          <span className="min-w-0">
            <span className="block text-xs text-fg-3">Previous {kind}</span>
            <span className="block text-sm font-medium text-fg group-hover:underline">{prev.title}</span>
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? (
        <Link href={next.href} className="group flex min-h-12 min-w-0 items-center justify-end gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-right hover:bg-surface-2">
          <span className="min-w-0">
            <span className="block text-xs text-fg-3">Next {kind}</span>
            <span className="block text-sm font-medium text-fg group-hover:underline">{next.title}</span>
          </span>
          <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-fg-3" />
        </Link>
      ) : null}
    </nav>
  );
}
