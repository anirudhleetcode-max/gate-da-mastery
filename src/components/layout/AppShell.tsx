"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, MoreHorizontal } from "lucide-react";
import { NAV_GROUPS, NAV_FOOTER, MOBILE_TABS, isActive, type NavItem } from "./nav";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";
import { DemoBanner } from "./DemoBanner";
import { cn } from "@/lib/utils";

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-accent-soft text-accent-text" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1 px-2.5 text-[0.7rem] font-semibold uppercase tracking-wider text-fg-3">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <NavLink key={it.href} item={it} pathname={pathname} onClick={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-0.5 border-t border-border px-3 py-3">
        {NAV_FOOTER.map((it) => (
          <NavLink key={it.href} item={it} pathname={pathname} onClick={onNavigate} />
        ))}
      </div>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-fg">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-accent text-[0.7rem] font-bold text-white dark:text-[#0e1117]">
        DA
      </span>
      <span>GATE DA Mastery</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The drawer is open only for the path it was opened on, so navigating closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawer = drawerPath === pathname;
  const setDrawer = (open: boolean) => setDrawerPath(open ? pathname : null);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerPath(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex" aria-label="Main navigation">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Brand />
        </div>
        <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
          <NavContent pathname={pathname} />
        </nav>
      </aside>

      {/* Mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/40" aria-label="Close navigation" onClick={() => setDrawer(false)} />
          <nav aria-label="Primary" className="absolute inset-y-0 left-0 flex w-[82vw] max-w-xs flex-col bg-surface shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <Brand />
              <button onClick={() => setDrawer(false)} className="rounded-md p-1.5 text-fg-2 hover:bg-surface-2" aria-label="Close navigation">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <NavContent pathname={pathname} onNavigate={() => setDrawer(false)} />
          </nav>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:px-5">
          <button onClick={() => setDrawer(true)} className="rounded-md p-2 text-fg-2 hover:bg-surface-2 lg:hidden" aria-label="Open navigation" aria-expanded={drawer}>
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 lg:ml-0">
            <SearchBox />
            <ThemeToggle />
          </div>
        </header>
        <DemoBanner />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav aria-label="Quick navigation" className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE_TABS.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[0.68rem] font-medium", active ? "text-accent-text" : "text-fg-3")}>
              <Icon aria-hidden className="h-5 w-5" />
              {t.label}
            </Link>
          );
        })}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-[0.68rem] font-medium text-fg-3" aria-label="More navigation">
          <MoreHorizontal aria-hidden className="h-5 w-5" />
          More
        </button>
      </nav>
    </div>
  );
}
