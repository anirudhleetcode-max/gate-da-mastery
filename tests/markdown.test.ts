import { describe, expect, it } from "vitest";
import { markdownToPlain, renderMarkdown } from "@/lib/content/markdown";
import { hydrateMath, unescapeHtml } from "@/lib/content/math";

describe("markdown rendering", () => {
  it("renders GFM tables inside a scroll wrapper and code with highlighting", () => {
    const r = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |\n\n```python\nx = 1\n```");
    expect(r.errors).toEqual([]);
    expect(r.html).toContain('<div class="table-wrap"><table>');
    expect(r.html).toContain("hljs");
  });
  it("stores math as compact placeholders and reports KaTeX errors", () => {
    const ok = renderMarkdown("Let $x^2$ and\n\n$$\n\\frac{a}{b}\n$$");
    expect(ok.errors).toEqual([]);
    expect(ok.html).toContain('class="math-tex" data-display="false"');
    expect(ok.html).toContain('data-display="true"');
    const bad = renderMarkdown("Broken $\\frac{1}{$ math");
    expect(bad.errors.length).toBeGreaterThan(0);
  });
  it("drops raw HTML from markdown", () => {
    expect(renderMarkdown("<script>alert(1)</script> hi").html).not.toContain("<script>");
  });
  it("hydrates math with KaTeX, decoding HTML entities", () => {
    const html = renderMarkdown("Sorted: $4 < 5 \\le 7$ and $a \\& b$").html;
    const out = hydrateMath(html);
    expect(out).toContain("katex");
    expect(out).not.toContain("katex-error");
    expect(unescapeHtml("&#x3C; &lt; &#60; &amp;")).toBe("< < < &");
  });
  it("produces plain text previews", () => {
    expect(markdownToPlain("Let $f(x)=\\frac{1}{1+e^{-x}}$ be **given**")).toBe("Let f(x)=1/1+e^-x be given");
  });
});
