import { describe, expect, it } from "vitest";
import { excerpt, highlightSegments, matchRanges, queryTerms } from "./highlight";

describe("queryTerms", () => {
  it("splits, trims punctuation, drops 1-character terms and de-duplicates", () => {
    expect(queryTerms("  Eigen  value, eigen! a ")).toEqual(["eigen", "value"]);
    expect(queryTerms("Q.14 2024")).toEqual(["q.14", "2024", "q14"]);
    expect(queryTerms("q14")).toContain("q.14");
    expect(queryTerms("")).toEqual([]);
  });
});

describe("highlightSegments", () => {
  it("marks every case-insensitive occurrence and keeps the original text", () => {
    const segs = highlightSegments("PCA and pca: Principal Component Analysis", ["pca"]);
    expect(segs.map((s) => s.text).join("")).toBe("PCA and pca: Principal Component Analysis");
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual(["PCA", "pca"]);
  });

  it("merges overlapping terms", () => {
    expect(matchRanges("eigenvalues", ["eigen", "eigenvalue"])).toEqual([[0, 10]]);
  });

  it("treats the query as plain text (no regex or HTML interpretation)", () => {
    const segs = highlightSegments("a <b>bold</b> (x+y)* claim", ["<b>", "(x+y)*"]);
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual(["<b>", "(x+y)*"]);
    expect(segs.map((s) => s.text).join("")).toBe("a <b>bold</b> (x+y)* claim");
  });

  it("returns the whole text unmarked when nothing matches", () => {
    expect(highlightSegments("Linear algebra", ["zzz"])).toEqual([{ text: "Linear algebra", match: false }]);
  });
});

describe("excerpt", () => {
  it("centres on the first match and adds ellipses", () => {
    const text = `${"word ".repeat(60)}singular value decomposition ${"tail ".repeat(60)}`;
    const e = excerpt(text, ["singular"], 80);
    expect(e).toContain("singular");
    expect(e.startsWith("…")).toBe(true);
    expect(e.endsWith("…")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(82);
  });
  it("returns short text unchanged", () => {
    expect(excerpt("short text", ["x"])).toBe("short text");
  });
});
