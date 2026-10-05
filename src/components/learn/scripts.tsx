/**
 * Plain-text sub- and superscripts. Formula-book variable meanings are plain
 * strings (not Markdown), and authors write indices the ASCII way: "x_i",
 * "R^n", "e^(−z)", "n_(l−1)". This renders those as real <sub>/<sup>
 * elements instead of showing the raw "_" and "^". Text only: nothing is ever
 * interpreted as HTML.
 */
import { Fragment, type ReactNode } from "react";

export type ScriptPart = { text: string } | { sub: string } | { sup: string };

/**
 * "_" or "^" directly after a single base character (a letter, digit, closing
 * bracket or prime/transpose mark) that is not itself the end of a longer
 * word (so "max_depth" stays as written), or after "log". The script is a
 * (…) / {…} group or a run of letters and digits (optionally signed;
 * modifier letters such as the transpose mark "ᵀ" end the run).
 */
const SCRIPT = /((?<!\p{L})log|(?<!\p{L})[\p{Ll}\p{Lu}\p{Lt}\p{Lo}\p{N}]|[)\]}ᵀ′'])([_^])(\([^()]*\)|\{[^{}]*\}|[−-]?[\p{Ll}\p{Lu}\p{Lt}\p{Lo}\p{N}]+)/gu;

export function splitScripts(text: string): ScriptPart[] {
  const parts: ScriptPart[] = [];
  let last = 0;
  const push = (t: string) => {
    if (!t) return;
    const prev = parts.at(-1);
    if (prev && "text" in prev) prev.text += t;
    else parts.push({ text: t });
  };
  for (const m of text.matchAll(SCRIPT)) {
    const [whole, base, mark, rawScript] = m;
    const start = m.index ?? 0;
    push(text.slice(last, start) + base);
    const script = /^[({]/.test(rawScript) ? rawScript.slice(1, -1) : rawScript;
    parts.push(mark === "_" ? { sub: script } : { sup: script });
    last = start + whole.length;
  }
  push(text.slice(last));
  return parts;
}

/** Renders a plain string with its ASCII sub/superscripts as <sub>/<sup>. */
export function ScriptText({ text }: { text: string }): ReactNode {
  const parts = splitScripts(text);
  if (parts.length === 1 && "text" in parts[0]) return text;
  return parts.map((p, i) => (
    <Fragment key={i}>{"text" in p ? p.text : "sub" in p ? <sub className="text-[0.75em]">{p.sub}</sub> : <sup className="text-[0.75em]">{p.sup}</sup>}</Fragment>
  ));
}
