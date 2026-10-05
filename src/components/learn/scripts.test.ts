import { describe, expect, it } from "vitest";
import { splitScripts } from "./scripts";

describe("splitScripts", () => {
  it("turns ASCII indices and powers into sub/superscripts", () => {
    expect(splitScripts("vector in R^n")).toEqual([{ text: "vector in R" }, { sup: "n" }]);
    expect(splitScripts("the i-th variable; x_i is a value of it")).toEqual([{ text: "the i-th variable; x" }, { sub: "i" }, { text: " is a value of it" }]);
    expect(splitScripts("vector (x_1, …, x_n)")).toEqual([{ text: "vector (x" }, { sub: "1" }, { text: ", …, x" }, { sub: "n" }, { text: ")" }]);
  });

  it("unwraps grouped scripts and keeps the base before a closing bracket", () => {
    expect(splitScripts("sigmoid 1/(1 + e^(−z))")).toEqual([{ text: "sigmoid 1/(1 + e" }, { sup: "−z" }, { text: ")" }]);
    expect(splitScripts("size n_l × n_(l−1)")).toEqual([{ text: "size n" }, { sub: "l" }, { text: " × n" }, { sub: "l−1" }]);
    expect(splitScripts("coefficient of (x − a)^n")).toEqual([{ text: "coefficient of (x − a)" }, { sup: "n" }]);
    expect(splitScripts("entries r_jk = q_jᵀ a_k")).toEqual([{ text: "entries r" }, { sub: "jk" }, { text: " = q" }, { sub: "j" }, { text: "ᵀ a" }, { sub: "k" }]);
  });

  it("handles log bases but leaves identifiers and plain text alone", () => {
    expect(splitScripts("critical exponent log_b a")).toEqual([{ text: "critical exponent log" }, { sub: "b" }, { text: " a" }]);
    expect(splitScripts("the max_depth parameter")).toEqual([{ text: "the max_depth parameter" }]);
    expect(splitScripts("Euler's number ≈ 2.71828")).toEqual([{ text: "Euler's number ≈ 2.71828" }]);
    expect(splitScripts("")).toEqual([]);
  });
});
