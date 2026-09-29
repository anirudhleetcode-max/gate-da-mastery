import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({ title, description, actions, crumbs }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: { label: string; href?: string }[] }) {
  return (
    <header className="mb-6">
      {crumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-fg-3">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight aria-hidden className="h-3.5 w-3.5" /> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:text-fg hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-fg-2">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.7rem]">{title}</h1>
          {description ? <div className="mt-1 max-w-3xl text-[0.95rem] text-fg-2">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
