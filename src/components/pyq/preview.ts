/**
 * Display clean-up for question previews.
 *
 * The build-time preview is the stem with Markdown/LaTeX punctuation stripped,
 * which leaves command names glued to their arguments ("boldsymbolM in R^3
 * times 3", "textttMovie(underlinetextttID)"). This turns the common ones back
 * into readable plain text for list rows and search. It is deliberately
 * conservative: words that are also ordinary English ("in", "to", "cap",
 * "land", …) are only converted between single-symbol math tokens, and the full
 * question is always rendered from the compiled HTML, never from this text.
 */

const GREEK: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  Delta: "Δ",
  epsilon: "ε",
  varepsilon: "ε",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  sigma: "σ",
  Sigma: "Σ",
  pi: "π",
  phi: "φ",
  rho: "ρ",
  tau: "τ",
  omega: "ω",
  eta: "η",
};
const GREEK_RE = new RegExp(`(?<![A-Za-z])(${Object.keys(GREEK).sort((a, b) => b.length - a.length).join("|")})(?![a-z])`, "g");

/** Command names that never occur as English words; safe to replace anywhere (even glued). */
const SYMBOLS: [RegExp, string][] = [
  [/Leftrightarrow/g, "⇔"],
  [/leftrightarrow/g, "↔"],
  [/Rightarrow/g, "⇒"],
  [/rightarrow/g, "→"],
  [/leftarrow/g, "←"],
  [/\bleq\b/g, "≤"],
  [/\bgeq\b/g, "≥"],
  [/\bneq\b/g, "≠"],
  [/\bnotin\b/g, "∉"],
  [/\bforall\b/g, "∀"],
  [/\bwedge\b/g, "∧"],
  [/\bvee\b/g, "∨"],
  [/infty\b/g, "∞"],
  [/[lcv]dots\b/g, "…"],
  [/\bcdot\b/g, "·"],
  [/\bpmod\s*/g, "mod "],
  [/\blfloor\b/g, "⌊"],
  [/\brfloor\b/g, "⌋"],
  [/\blceil\b/g, "⌈"],
  [/\brceil\b/g, "⌉"],
  [/\bsqrt\s?/g, "√"],
  [/\^top\b/g, "ᵀ"],
  [/\^circ\b/g, "°"],
];

/** Formatting commands whose names can simply be dropped. */
const DROP =
  /(?:displaystyle|mathit|mathrm|mathbf|mathsf|mathcal|mathbb|boldsymbol|texttt|textit|textbf|textrm|textsf|operatorname|widetilde|scriptstyle|[dt]?frac)(?=[A-Za-z0-9(\\[\s])/g;

// One math token: a single letter, a number, a decorated letter (x^2) or a closing bracket.
const TOK = String.raw`(?:[A-Za-z]|\d+(?:\.\d+)?|[A-Za-z0-9]\^\S+|[)\]])`;
const between = (word: string, repl: string): [RegExp, string] => [
  new RegExp(String.raw`(?<=(?:^|[\s(,\[])${TOK}) ${word} (?=[A-Za-z0-9(\[+\-¬])`, "g"),
  ` ${repl} `,
];
// Next token is a number set (R, R^n, Z…), an interval, or a single capital (a set or relation name).
const SET_NEXT = String.raw`(?=(?:[A-Z](?:\^\S+)?|\[)(?:[\s,.;:)]|$)|\[)`;

const INFIX: [RegExp, string][] = [
  between("le", "≤"),
  between("ge", "≥"),
  between("ne", "≠"),
  between("cap", "∩"),
  between("cup", "∪"),
  between("land", "∧"),
  between("lor", "∨"),
  between("mid", "|"),
  between("sim", "∼"),
  [new RegExp(String.raw`(?<=(?:^|[\s(,\[])(?:${TOK}|[A-Za-z0-9)\]]ᵀ)) in ${SET_NEXT}`, "g"), " ∈ "],
  // f: R to R, g: R to (1, ∞) and lim x to 0 only; "from 1 to 12" stays English.
  [/(?<=\bR(?:\^\S+)?) to (?=R\b|\(|\[)/g, " → "],
  [/(?<=\blim\s+[a-z]) to /g, " → "],
  [new RegExp(String.raw`(?<=(?:^|[\s(,\[])${TOK}) times (?=[A-Za-z0-9(])`, "g"), " × "],
  [/(?<=\^[A-Za-z])times(?=\s?[A-Za-z0-9])/g, " × "],
  [/(?<=[\s(,])neg (?=[A-Za-z(])/g, "¬"],
];


export function cleanPreview(input: string): string {
  let s = input;
  // A LaTeX command cut in half by the 200-character limit.
  s = s.replace(/\s?(?:end|begin|text|math|bold|display|under|over|lambd|sigm|thet)[a-z]*…$/, " …");
  // Environments: matrices become [a b; c d], cases become { … ; … }.
  s = s.replace(/begin[bv]?matrix/g, "[").replace(/end[bv]?matrix/g, "]");
  s = s.replace(/beginpmatrix/g, "(").replace(/endpmatrix/g, ")");
  s = s.replace(/begincases/g, "{").replace(/endcases/g, "}");
  s = s.replace(/beginarray(?:\s+[lcr|](?=\s))*/g, "").replace(/endarray/g, "");
  s = s.replace(/begin(?:aligned|align\*?|gathered)|end(?:aligned|align\*?|gathered)/g, "");
  s = s.replace(/\bhline\b/g, " ");
  // Blanks and spacing commands.
  s = s.replace(/underline\\?hspace[\d.]+(?:em|pt|ex|cm|mm)/g, "____");
  s = s.replace(/(?:\\ ){2,}/g, " ____ ");
  s = s.replace(/\\\\(?:\[[\d.]+(?:pt|em|ex)\])?/g, " ; ");
  s = s.replace(/\\[,;:! ]/g, " ");
  s = s.replace(/\bhspace[\d.]+(?:em|pt|ex)/g, " ");
  s = s.replace(/(?<![A-Za-z])(?:q?quad)+(?![A-Za-z])/g, " ");
  s = s.replace(/\s&\s/g, "  ");
  // Formatting commands and decorations.
  s = s.replace(DROP, "");
  s = s.replace(/widehat([A-Za-z])/g, "$1\u0302").replace(/\b(?:hat)([A-Za-z])\b/g, "$1\u0302");
  s = s.replace(/overline([A-Za-z])(?![a-z])/g, "$1\u0305").replace(/\bbar([A-Za-z])(?![a-z])/g, "$1\u0304");
  s = s.replace(/\bunderline(?=[A-Z(\\]|[a-z]{2,}|\s+\()/g, "");
  s = s.replace(/lnleft/g, "ln").replace(/\bleft(?=[([|.\\])/g, "").replace(/right(?=[)\]|.\\])/g, "");
  s = s.replace(/\bleft\\(?=\s)/g, "");
  s = s.replace(/\b(cos|sin|tan)(?=theta|alpha|beta|phi|pi\b)/g, "$1 ");
  for (const [re, rep] of SYMBOLS) s = s.replace(re, rep);
  s = s.replace(/(?<![A-Za-z]{2})sum(?=\s?[a-z]\s?=)/g, (m, offset: number, whole: string) => (/[A-Za-z]/.test(whole[offset - 1] ?? "") ? " Σ" : "Σ"));
  s = s.replace(GREEK_RE, (m) => GREEK[m] ?? m);
  // Leftover lone backslashes from stripped \{ \} and similar; Markdown table rules.
  s = s.replace(/\\/g, " ").replace(/:?-{3,}:?/g, " ");
  for (const [re, rep] of INFIX) s = s.replace(re, rep);
  return s
    .replace(/\s+([,.;?)\]}])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
