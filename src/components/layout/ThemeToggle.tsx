"use client";
import { useStorageValue } from "@/lib/useStorage";
import { Moon, Sun, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";
const KEY = "gate-da-theme";

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export function ThemeToggle() {
  const [stored, setStored] = useStorageValue(KEY);
  const theme: Theme = stored === "light" || stored === "dark" ? stored : "system";
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => {
        const t = next[theme];
        apply(t);
        setStored(t === "system" ? null : t);
      }}
      className="rounded-md p-2 text-fg-2 hover:bg-surface-2 hover:text-fg"
      aria-label={`Theme: ${theme}. Switch to ${next[theme]}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden />
    </button>
  );
}

/** Inline script (runs before paint) to avoid a theme flash. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
