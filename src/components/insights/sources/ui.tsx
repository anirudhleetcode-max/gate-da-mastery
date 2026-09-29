/** Layout helpers for the Sources & methodology page (server-compatible). */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ id, title, description, children, className }: { id: string; title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("scroll-mt-20 space-y-4", className)}>
      <div>
        <h2 id={`${id}-h`} className="text-xl font-semibold tracking-tight text-fg">
          {title}
        </h2>
        {description ? <div className="mt-1 max-w-3xl text-[0.95rem] text-fg-2">{description}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function H3({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h3 id={id} className={cn("scroll-mt-20 text-base font-semibold text-fg", className)}>
      {children}
    </h3>
  );
}

/** Numbered pipeline step. */
export function Step({ n, title, children, meta }: { n: number | string; title: ReactNode; children?: ReactNode; meta?: ReactNode }) {
  return (
    <li className="relative flex gap-3">
      <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-xs font-bold text-fg-2">
        {n}
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <p className="font-medium text-fg">
          <span className="sr-only">Step {n}: </span>
          {title}
        </p>
        {children ? <div className="mt-0.5 text-sm text-fg-2">{children}</div> : null}
        {meta ? <div className="mt-1 text-xs text-fg-3">{meta}</div> : null}
      </div>
    </li>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="break-all rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.82em] text-fg">{children}</code>;
}

export function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-fg-3">{label}</dt>
      <dd className="min-w-0 text-sm text-fg">{children}</dd>
    </div>
  );
}

/** "https://github.com/a/b/blob/sha/PYQ/x.pdf" → "github.com/a/b/…/x.pdf" for display (the href keeps the full URL). */
export function shortUrl(url: string, max = 60): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    let out = parts.length <= 3 ? `${u.host}${u.pathname}` : `${u.host}/${parts.slice(0, 2).join("/")}/…/${parts[parts.length - 1]}`;
    if (out.length > max) out = `${out.slice(0, max - 12)}…${out.slice(-11)}`;
    return out;
  } catch {
    return url.length > max ? `${url.slice(0, max - 1)}…` : url;
  }
}

export function ExtLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} title={href} target="_blank" rel="noopener noreferrer" className={cn("break-all text-accent-text underline-offset-2 hover:underline", className)}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
