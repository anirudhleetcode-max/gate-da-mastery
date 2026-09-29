"use client";
/**
 * Offline copy of a bookmarked question. The snapshot is build-time HTML saved
 * into IndexedDB when the bookmark was made, but it comes back from local
 * storage (or from an imported backup file), so it is passed through an
 * allowlist sanitiser before RichHtml hydrates its math.
 */
import { useMemo } from "react";
import { RichHtml } from "@/components/ui/RichHtml";

const DROP = new Set(["script", "style", "iframe", "frame", "frameset", "object", "embed", "link", "meta", "base", "form", "input", "button", "textarea", "select", "option", "svg", "math", "template", "noscript", "audio", "video", "source", "canvas"]);
const ALLOWED = new Set([
  "p", "div", "span", "strong", "em", "b", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup", "br", "hr",
  "ul", "ol", "li", "dl", "dt", "dd", "code", "pre", "kbd", "blockquote", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "img", "a", "figure", "figcaption",
]);
const ATTRS = new Set(["class", "data-display", "colspan", "rowspan", "scope", "alt", "title", "src", "href", "width", "height"]);

function safeUrl(u: string): boolean {
  const v = u.trim().toLowerCase();
  return (v.startsWith("/") && !v.startsWith("//")) || v.startsWith("#") || v.startsWith("https://") || v.startsWith("http://");
}

function clean(el: Element) {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    if (DROP.has(tag)) {
      child.remove();
      continue;
    }
    clean(child);
    if (!ALLOWED.has(tag)) {
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      if (!ATTRS.has(name) || ((name === "src" || name === "href") && !safeUrl(attr.value))) child.removeAttribute(attr.name);
    }
    if (tag === "a") {
      child.setAttribute("rel", "noopener noreferrer");
      child.setAttribute("target", "_blank");
    }
  }
}

/** Allowlist sanitiser (browser only; returns "" where DOMParser is unavailable). */
export function sanitizeSnapshotHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  clean(doc.body);
  return doc.body.innerHTML;
}

export function SnapshotHtml({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => sanitizeSnapshotHtml(html), [html]);
  if (!safe.trim()) return <p className="text-sm text-fg-3">The saved copy is empty.</p>;
  return <RichHtml html={safe} className={className} />;
}
