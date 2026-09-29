/**
 * Sanitisers for user-controlled data read back from IndexedDB or from an
 * imported backup file. Such data is untrusted even though the app wrote it
 * originally (a backup file can be edited by hand).
 *
 * sanitizeSnapshotHtml is an allowlist sanitiser for the saved HTML copy of a
 * bookmarked question. The allowlist mirrors what the content build emits
 * (paragraphs, tables, code with highlight.js classes, lists, same-site
 * images, math placeholders):
 *  - unknown tags are unwrapped (text kept); dangerous ones are removed;
 *  - only a few attributes survive (never event handlers or inline styles);
 *  - classes are limited to content classes, so a crafted snapshot cannot
 *    borrow app layout utilities (e.g. a full-screen fixed overlay);
 *  - images and links must point at this site (no tracking pixels);
 *  - attribute values containing "<" or ">" are dropped and math placeholders
 *    are reduced to plain text, so hydrateMath's placeholder pattern cannot
 *    match across element boundaries.
 */

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
export function isSameSitePath(u: string): boolean {
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


/** A same-site path (with query and hash) for a stored link, or null if it could leave the site. */
export function safeInternalHref(href: string | undefined): string | null {
  if (typeof href !== "string") return null;
  const v = href.trim();
  if (!/^\/(?![/\\])[^\s\\]*$/.test(v)) return null;
  try {
    const u = new URL(v, "https://internal.invalid");
    return u.origin === "https://internal.invalid" ? `${u.pathname}${u.search}${u.hash}` : null;
  } catch {
    return null;
  }
}
