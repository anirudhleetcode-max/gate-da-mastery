/**
 * Turn math placeholders produced by the content build into KaTeX markup.
 * Isomorphic: used by server components (SSR) and client components.
 */
import katex from "katex";

const PLACEHOLDER = /<(span|div) class="math-tex" data-display="(true|false)">([\s\S]*?)<\/\1>/g;

const NAMED: Record<string, string> = { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&", nbsp: "\u00a0" };

/** Decode the entities rehype-stringify may emit (&lt; &#x3C; &#60; …). */
export function unescapeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e] ?? m;
  });
}

const cache = new Map<string, string>();

export function hydrateMath(html: string): string {
  if (!html || !html.includes("math-tex")) return html;
  return html.replace(PLACEHOLDER, (_m, _tag: string, display: string, tex: string) => {
    const key = `${display}|${tex}`;
    const hit = cache.get(key);
    if (hit) return hit;
    let out: string;
    try {
      out = katex.renderToString(unescapeHtml(tex), {
        displayMode: display === "true",
        throwOnError: false,
        strict: "ignore",
        output: "htmlAndMathml",
      });
    } catch {
      out = `<code>${tex}</code>`;
    }
    if (display === "true") out = `<div class="math-display">${out}</div>`;
    if (cache.size > 5000) cache.clear();
    cache.set(key, out);
    return out;
  });
}
