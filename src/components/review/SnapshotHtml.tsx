"use client";
/**
 * Offline copy of a bookmarked question. The snapshot is build-time HTML saved
 * into IndexedDB when the bookmark was made, but it comes back from local
 * storage (or from an imported backup file), so it is untrusted: it passes
 * through an allowlist sanitiser before RichHtml hydrates its math.
 *
 * The allowlist mirrors what the content build emits for question stems
 * (paragraphs, tables, code with highlight.js classes, lists, images from the
 * site itself and math placeholders). Everything else is dropped:
 *  - unknown tags are unwrapped (their text is kept), dangerous ones removed;
 *  - only a few attributes survive, never event handlers or inline styles;
 *  - classes are limited to the content classes, so a crafted snapshot cannot
 *    borrow the app's layout utilities (e.g. a full-screen fixed overlay);
 *  - images and links must point at this site (no tracking pixels);
 *  - attribute values containing "<" or ">" are dropped, and math placeholders
 *    are reduced to plain text, so hydrateMath's placeholder pattern can never
 *    match across element boundaries.
 */
import { useMemo } from "react";
import { RichHtml } from "@/components/ui/RichHtml";

const DROP = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "link", "meta", "base", "form", "input", "button", "textarea", "select", "option",
  "svg", "math", "template", "noscript", "audio", "video", "source", "track", "canvas", "portal", "dialog", "title", "head",
]);
const ALLOWED = new Set([
  "p", "div", "span", "strong", "em", "b", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup", "br", "hr",
  "ul", "ol", "li", "dl", "dt", "dd", "code", "pre", "kbd", "blockquote", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "img", "a", "figure", "figcaption",
]);
/** Attributes kept, with a validator for the value. */
const ATTRS: Record<string, (v: string, tag: string) => boolean> = {
  class: () => true, // filtered token by token below
  colspan: (v) => /^\d{1,2}$/.test(v),
  rowspan: (v) => /^\d{1,2}$/.test(v),
  scope: (v) => /^(row|col|rowgroup|colgroup)$/.test(v),
  align: (v) => /^(left|center|right)$/.test(v),
  alt: () => true,
  width: (v) => /^\d{1,4}$/.test(v),
  height: (v) => /^\d{1,4}$/.test(v),
  src: (v, tag) => tag === "img" && isSameSitePath(v),
  href: (v, tag) => tag === "a" && isSameSitePath(v),
};
/** Classes the content build emits (math placeholders, table wrapper, highlight.js tokens). */
const SAFE_CLASS = /^(math-tex|table-wrap|hljs(-[a-z_]+)?|language-[a-z0-9+#-]+|function_|class_|language_|title_|built_in_)$/;

/** A path on this site ("/…", not "//host" or "/\host"), or an in-page anchor. */
function isSameSitePath(u: string): boolean {
  const v = u.trim();
  if (v.startsWith("#")) return /^#[\w-]*$/.test(v);
  return /^\/(?![/\\])[\w\-./~%?=&+:@,]*$/.test(v) && !/[\\\s]/.test(v);
}

function cleanMath(el: Element) {
  // Keep only the placeholder contract: class="math-tex" data-display="true|false" and text content.
  const display = el.getAttribute("data-display") === "true" ? "true" : "false";
  const tex = el.textContent ?? "";
  for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
  el.setAttribute("class", "math-tex");
  el.setAttribute("data-display", display);
  el.textContent = tex;
}

function clean(el: Element) {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    if (DROP.has(tag)) {
      child.remove();
      continue;
    }
    if ((tag === "span" || tag === "div") && child.classList.contains("math-tex")) {
      cleanMath(child);
      continue;
    }
    clean(child);
    if (!ALLOWED.has(tag)) {
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      const check = ATTRS[name];
      if (!check || /[<>]/.test(attr.value) || !check(attr.value, tag)) child.removeAttribute(attr.name);
    }
    const classes = (child.getAttribute("class") ?? "").split(/\s+/).filter((c) => SAFE_CLASS.test(c));
    if (classes.length) child.setAttribute("class", classes.join(" "));
    else child.removeAttribute("class");
    if (tag === "img") {
      if (!child.hasAttribute("src")) {
        child.remove();
        continue;
      }
      child.setAttribute("loading", "lazy");
      child.setAttribute("decoding", "async");
    }
    if (tag === "a") {
      if (!child.hasAttribute("href")) child.replaceWith(...Array.from(child.childNodes));
    }
  }
}

/** Allowlist sanitiser (browser only; returns "" where DOMParser is unavailable). */
export function sanitizeSnapshotHtml(html: string): string {
  if (typeof DOMParser === "undefined" || typeof html !== "string") return "";
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  clean(doc.body);
  return doc.body.innerHTML;
}

export function SnapshotHtml({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => sanitizeSnapshotHtml(html), [html]);
  if (!safe.trim()) return <p className="text-sm text-fg-3">The saved copy is empty.</p>;
  return <RichHtml html={safe} className={className} />;
}
