/**
 * Plain-text previews for PYQ list rows, built on the server from the compiled
 * stem HTML.
 *
 * The bundle's `preview` field is made from the Markdown with LaTeX punctuation
 * stripped, which loses meaning: "$m > n$" becomes "m n", blanks disappear
 * ("[silly → → daft]") and command names are glued to their arguments. The
 * compiled HTML still carries every formula verbatim in its math placeholder,
 * so this module converts that LaTeX to readable Unicode text instead
 * ("m > n", "x = n^(log₁₀(m))", "M ∈ ℝ³ˣ³"). Display only: the question page
 * always renders the full stem with KaTeX.
 */

export { cleanPreview } from "./legacyPreview";

// ------------------------------------------------------------------ symbol tables

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

/** Relations and binary operators: written with a space on each side. */
const SPACED: Record<string, string> = {
  in: "∈", notin: "∉", ni: "∋", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", lt: "<", gt: ">",
  times: "×", div: "÷", pm: "±", mp: "∓", approx: "≈", sim: "∼", simeq: "≃", cong: "≅", equiv: "≡", propto: "∝",
  to: "→", rightarrow: "→", leftarrow: "←", gets: "←", Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔",
  leftrightarrow: "↔", Longrightarrow: "⟹", longrightarrow: "⟶", Longleftrightarrow: "⟺", implies: "⟹", iff: "⟺",
  mapsto: "↦", mid: "|", cap: "∩", cup: "∪", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇",
  setminus: "∖", land: "∧", wedge: "∧", lor: "∨", vee: "∨", oplus: "⊕", otimes: "⊗", bowtie: "⋈", perp: "⊥",
  parallel: "∥", cdot: "·", ast: "∗", star: "⋆", circ: "∘", bmod: "mod", mod: "mod", vdash: "⊢", models: "⊨",
};

/** Other symbols: written in place. */
const SYMBOL: Record<string, string> = {
  infty: "∞", forall: "∀", exists: "∃", nexists: "∄", neg: "¬", lnot: "¬", emptyset: "∅", varnothing: "∅",
  sum: "Σ", prod: "Π", int: "∫", oint: "∮", partial: "∂", nabla: "∇", bigcap: "⋂", bigcup: "⋃",
  ldots: "…", dots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉",
  langle: "⟨", rangle: "⟩", angle: "∠", triangle: "△", bullet: "•", prime: "′", ell: "ℓ", hbar: "ℏ",
  top: "⊤", bot: "⊥", checkmark: "✓", dagger: "†", aleph: "ℵ", Re: "ℜ", Im: "ℑ", vert: "|", Vert: "‖",
  lvert: "|", rvert: "|", lVert: "‖", rVert: "‖", colon: ":", backslash: "\\", degree: "°", S: "§", P: "¶",
  quad: " ", qquad: " ", enspace: " ", thinspace: " ",
};

/** Named functions: kept as words. */
const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "log", "ln", "lg",
  "exp", "max", "min", "sup", "inf", "lim", "liminf", "limsup", "det", "dim", "ker", "arg", "deg", "gcd", "Pr", "argmax", "argmin", "sgn", "rank", "tr",
]);

/** Commands whose single argument is kept as plain text. */
const KEEP_ARG = new Set([
  "text", "textrm", "textit", "textbf", "texttt", "textsf", "textnormal", "textup", "emph", "mathrm", "mathit", "mathbf",
  "mathsf", "mathtt", "mathcal", "mathscr", "mathfrak", "boldsymbol", "bm", "pmb", "operatorname", "underline", "mbox", "hbox",
  "boxed", "fbox", "underbrace", "overbrace", "textstyle",
]);

/** Size and style switches without arguments. */
const DROP = new Set([
  "left", "right", "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "middle",
  "displaystyle", "scriptstyle", "scriptscriptstyle", "limits", "nolimits", "hline", "cline", "centering", "noindent",
  "rm", "bf", "it", "tt", "sf", "small", "large", "Large", "normalsize", "footnotesize", "nonumber", "notag", "strut",
]);

const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", E: "𝔼", P: "ℙ", F: "𝔽" };

const COMBINING: Record<string, string> = {
  hat: "̂", widehat: "̂", bar: "̄", overline: "̅", tilde: "̃", widetilde: "̃",
  vec: "⃗", dot: "̇", ddot: "̈", check: "̌", acute: "́", grave: "̀",
};

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", k: "ᵏ", m: "ᵐ", j: "ʲ", t: "ᵗ",
  x: "ˣ", "×": "ˣ", h: "ʰ", T: "ᵀ", d: "ᵈ", "⊤": "ᵀ", "∘": "°", "′": "′", "*": "*", "∗": "*",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ",
  l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

const ENV_OPEN: Record<string, [string, string]> = {
  bmatrix: ["[", "]"], Bmatrix: ["{", "}"], pmatrix: ["(", ")"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"],
  matrix: ["", ""], smallmatrix: ["", ""], cases: ["{ ", " }"], array: ["", ""], aligned: ["", ""], align: ["", ""],
  "align*": ["", ""], gathered: ["", ""], split: ["", ""], equation: ["", ""], "equation*": ["", ""], tabular: ["", ""],
};

// ------------------------------------------------------------------ LaTeX → text

class TexReader {
  private i = 0;
  constructor(private readonly s: string) {}

  /** Reads until the end of input, a closing brace (in a group) or \end (in an environment). */
  seq(stopAtBrace: boolean, stopAtEnd = false): string {
    let out = "";
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === "}") {
        if (stopAtBrace) return out;
        this.i++;
        continue;
      }
      if (stopAtEnd && c === "\\" && this.s.startsWith("\\end", this.i) && !/[a-zA-Z]/.test(this.s[this.i + 4] ?? "")) return out;
      out += this.atom();
    }
    return out;
  }

  /** One unit: a group, a command with its arguments, a script, or a character. */
  private atom(): string {
    const c = this.s[this.i];
    if (c === "{") {
      this.i++;
      const inner = this.seq(true);
      this.i++; // the closing brace
      return inner;
    }
    if (c === "^" || c === "_") {
      this.i++;
      return script(this.arg(), c === "^" ? SUP : SUB, c);
    }
    if (c === "&") {
      this.i++;
      return "  ";
    }
    if (c === "~") {
      this.i++;
      return " ";
    }
    if (c === "\\") return this.command();
    this.i++;
    return c;
  }

  /** A command argument: a braced group, a command or a single character (spaces skipped). */
  private arg(): string {
    while (this.s[this.i] === " ") this.i++;
    if (this.i >= this.s.length) return "";
    return this.atom();
  }

  /** A raw braced argument (environment names, column specs, lengths). */
  private rawArg(): string {
    while (this.s[this.i] === " ") this.i++;
    if (this.s[this.i] !== "{") return "";
    const end = this.s.indexOf("}", this.i);
    const v = this.s.slice(this.i + 1, end < 0 ? undefined : end);
    this.i = end < 0 ? this.s.length : end + 1;
    return v;
  }

  private optArg(): string {
    if (this.s[this.i] !== "[") return "";
    const end = this.s.indexOf("]", this.i);
    const v = this.s.slice(this.i + 1, end < 0 ? undefined : end);
    this.i = end < 0 ? this.s.length : end + 1;
    return new TexReader(v).seq(false);
  }

  private command(): string {
    this.i++; // backslash
    const m = /^[a-zA-Z]+\*?/.exec(this.s.slice(this.i));
    if (!m) {
      // Control symbol: \{ \} \| \, \; \\ …
      const ch = this.s[this.i++] ?? "";
      if (ch === "\\") {
        // Line break, optionally with extra spacing: \\[4pt]
        const sp = /^\s*\[[\d.]+\s*(?:pt|em|ex|mm|cm)\]/.exec(this.s.slice(this.i));
        if (sp) this.i += sp[0].length;
        return "; ";
      }
      if (ch === "|") return "‖";
      if (",;:! ".includes(ch)) return " ";
      return ch;
    }
    const name = m[0].replace(/\*$/, "");
    this.i += m[0].length;

    if (name === "begin") {
      const env = this.rawArg();
      if (env === "array" || env === "tabular") this.rawArg();
      const [open, close] = ENV_OPEN[env] ?? ["", ""];
      const body = this.seq(false, true);
      if (this.s.startsWith("\\end", this.i)) {
        this.i += 4;
        this.rawArg();
      }
      return `${open}${body.replace(/;\s*$/, "").trim()}${close}`;
    }
    if (name === "end") {
      this.rawArg();
      return "";
    }
    if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
      const a = this.arg();
      const b = this.arg();
      return `${wrap(a)}/${wrap(b)}`;
    }
    if (name === "binom" || name === "dbinom" || name === "tbinom") {
      const a = this.arg();
      const b = this.arg();
      return `C(${a.trim()}, ${b.trim()})`;
    }
    if (name === "sqrt") {
      const n = this.optArg();
      const a = this.arg();
      return `${n ? `${n.trim()}` : ""}√${wrap(a)}`;
    }
    if (name === "mathbb") {
      const a = this.arg().trim();
      return BLACKBOARD[a] ?? a;
    }
    if (name in COMBINING) {
      const a = this.arg().trim();
      return [...a].map((ch) => (/\s/.test(ch) ? ch : ch + COMBINING[name])).join("");
    }
    if (name === "hspace" || name === "vspace" || name === "phantom" || name === "hphantom" || name === "vphantom") {
      this.rawArg();
      return " ";
    }
    if (name === "pmod") return ` (mod ${this.arg().trim()})`;
    if (name === "left" || name === "right") {
      // \left. and \right. are invisible delimiters.
      if (this.s[this.i] === ".") this.i++;
      return "";
    }
    if (DROP.has(name)) return "";
    if (name === "underline") {
      // \underline{\hspace{2cm}} is a fill-in blank.
      const a = this.arg();
      return a.trim() ? a : "____";
    }
    if (KEEP_ARG.has(name)) return this.arg();
    if (name in GREEK) return GREEK[name];
    if (name in SPACED) return ` ${SPACED[name]} `;
    if (name in SYMBOL) return SYMBOL[name];
    if (FUNCTIONS.has(name)) {
      // "cos θ", "log x" but "log₁₀(m)", "max(0, x)", "cos(\left…".
      const rest = this.s.slice(this.i);
      return /^(?:$|[\s({[^_]|\\(?:left|right|big|Big|bigl|Bigl)\b)/.test(rest) ? name : `${name} `;
    }
    // Unknown command: keep its name as a word.
    return name;
  }
}

/** Parenthesise a fraction part or exponent that is more than one token. */
function wrap(x: string): string {
  const t = x.trim();
  return [...t].length === 1 || /^[\p{L}\p{N}.′]+$/u.test(t) || /^\([^()]*\)$/.test(t) ? t : `(${t})`;
}

function script(arg: string, table: Record<string, string>, mark: string): string {
  const t = arg.trim();
  if (!t) return "";
  if (mark === "^" && (t === "⊤" || t === "T")) return "ᵀ";
  if (mark === "^" && t === "∘") return "°";
  const chars = [...t.replace(/\s+/g, "")];
  if (chars.length <= 6 && chars.every((ch) => ch in table)) return chars.map((ch) => table[ch]).join("");
  return `${mark}${wrap(t)}`;
}

/** Convert one LaTeX formula to readable Unicode text. */
export function texToText(tex: string): string {
  let out: string;
  try {
    out = new TexReader(tex).seq(false);
  } catch {
    out = tex.replace(/\\([a-zA-Z]+)/g, "$1").replace(/[{}]/g, "");
  }
  return out.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/¬\s+/g, "¬").replace(/\s+;/g, ";").trim();
}

// ------------------------------------------------------------------ HTML → preview

const PLACEHOLDER = /<(span|div) class="math-tex" data-display="(?:true|false)">([\s\S]*?)<\/\1>/g;
const ENTITIES: Record<string, string> = { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&", nbsp: " " };

function unescapeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export const PREVIEW_MAX = 200;

/**
 * A ≤ 200-character plain-text preview of a question stem from its compiled
 * HTML: formulas converted to text, figures and tables marked as such,
 * blanks kept as "____".
 */
export function stemPreview(html: string, max = PREVIEW_MAX): string {
  // Formulas are swapped for tokens first: their text may contain "<" and ">".
  const formulas: string[] = [];
  let s = html.replace(PLACEHOLDER, (_m, _tag: string, tex: string) => `\u0000${formulas.push(texToText(unescapeHtml(tex))) - 1}\u0000`);
  s = s
    .replace(/<div class="table-wrap">[\s\S]*?<\/div>|<table[\s\S]*?<\/table>/g, " [table] ")
    .replace(/<img\b[^>]*>/g, " [figure] ")
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h\d|pre|blockquote|figure|figcaption)>/g, " ")
    .replace(/<[^>]+>/g, "");
  s = unescapeHtml(s)
    .replace(/\u0000(\d+)\u0000/g, (_m, i: string) => formulas[Number(i)] ?? "")
    .replace(/_{3,}/g, "____")
    .replace(/(?:\s*\[(?:figure|table)\]){2,}/g, (m) => ` ${m.trim().split(/\s+/)[0]}`)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;?!)\]])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}
