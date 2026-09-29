// @vitest-environment jsdom
/** Concept library: subject + quick-text filtering, URL state and honest empty states. */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ConceptListItem, LibrarySubject } from "./types";
import { SUPPORTING_LABEL, libraryQuery, parseLibraryFilters } from "./library";

let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => createElement("a", { href, ...rest }, children as never),
}));

const { ConceptLibrary } = await import("./ConceptLibrary");

const subjects: LibrarySubject[] = [
  { id: "ps", name: "Probability and Statistics", topics: [{ id: "ps-cond", name: "Conditional Probability & Bayes" }, { id: "ps-desc", name: "Descriptive Statistics" }], formulaCount: 4, pyqCount: 12 },
  { id: "ml", name: "Machine Learning", topics: [{ id: "ml-cls", name: "Classification Models" }], formulaCount: 0, pyqCount: 8 },
  { id: "la", name: "Linear Algebra", topics: [{ id: "la-vs", name: "Vector Spaces" }], formulaCount: 30, pyqCount: 19 },
];
const item = (x: Partial<ConceptListItem> & Pick<ConceptListItem, "id" | "title" | "subjectId" | "topicId">): ConceptListItem => ({
  supporting: false,
  pyqCount: 0,
  formulaCount: 0,
  summary: "",
  haystack: x.title.toLowerCase(),
  ...x,
});
const concepts: ConceptListItem[] = [
  item({ id: "c-bayes", title: "Bayes' theorem", subjectId: "ps", topicId: "ps-cond", pyqCount: 3, formulaCount: 2, haystack: "bayes' theorem posterior prior conditional" }),
  item({ id: "c-joint", title: "Joint and marginal probability", subjectId: "ps", topicId: "ps-cond", pyqCount: 1, formulaCount: 1 }),
  item({ id: "c-nb", title: "Naive Bayes classifier", subjectId: "ml", topicId: "ml-cls", supporting: true, haystack: "naive bayes classifier conditional independence" }),
];

afterEach(() => {
  cleanup();
  search = "";
  window.history.replaceState(null, "", "/concepts");
});

describe("library query helpers", () => {
  it("parses and serialises ?subject=&q=", () => {
    const ids = new Set(["ps", "ml"]);
    const get = (qs: string) => (k: string) => new URLSearchParams(qs).get(k);
    expect(parseLibraryFilters(get("subject=ml&q=bayes"), ids)).toEqual({ subject: "ml", q: "bayes" });
    expect(parseLibraryFilters(get("subject=nope"), ids)).toEqual({ subject: "", q: "" });
    expect(libraryQuery({ subject: "ps", q: "naive bayes" })).toBe("subject=ps&q=naive+bayes");
    expect(libraryQuery({ subject: "", q: "  " })).toBe("");
  });
});

describe("ConceptLibrary", () => {
  it("groups by subject and topic, with counts, badges and honest empty states", () => {
    render(createElement(ConceptLibrary, { subjects, concepts }));
    const ps = screen.getByRole("region", { name: /Probability and Statistics/ });
    expect(within(ps).getByRole("heading", { name: /Conditional Probability & Bayes/ })).toBeTruthy();
    expect(within(ps).getByText("3 official PYQs")).toBeTruthy();
    expect(within(ps).getByText(/No notes yet for:/).parentElement?.textContent).toMatch(/Descriptive Statistics/);
    const ml = screen.getByRole("region", { name: /Machine Learning/ });
    expect(within(ml).getByText(SUPPORTING_LABEL)).toBeTruthy();
    const la = screen.getByRole("region", { name: /Linear Algebra/ });
    expect(within(la).getByText("No concept notes for Linear Algebra yet.")).toBeTruthy();
    expect(within(la).getByRole("link", { name: /Formula book \(30 formulas\)/ }).getAttribute("href")).toBe("/formulas/la");
  });

  it("filters by subject and words, and keeps the filters in the URL", () => {
    render(createElement(ConceptLibrary, { subjects, concepts }));
    fireEvent.change(screen.getByLabelText("Quick filter"), { target: { value: "bayes" } });
    expect(screen.getByRole("status").textContent).toMatch(/Showing 2 of 3 concepts matching “bayes”/);
    expect(window.location.search).toBe("?q=bayes");
    expect(screen.queryByRole("region", { name: /Linear Algebra/ })).toBeNull();

    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "ml" } });
    expect(screen.getByRole("status").textContent).toMatch(/Showing 1 of 3 concepts in Machine Learning matching “bayes”/);
    expect(window.location.search).toBe("?subject=ml&q=bayes");
    expect(screen.getByRole("link", { name: "Naive Bayes classifier" }).getAttribute("href")).toBe("/concepts/c-nb");

    fireEvent.change(screen.getByLabelText("Quick filter"), { target: { value: "bayes eigen" } });
    expect(screen.getByText(/No concepts match “bayes eigen” in Machine Learning/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Search all subjects" }));
    expect(window.location.search).toBe("?q=bayes+eigen");
    fireEvent.click(screen.getAllByRole("button", { name: /Clear the quick filter/ })[0]);
    expect(window.location.search).toBe("");
    expect(screen.getByRole("status").textContent).toMatch(/3 concept notes/);
  });

  it("starts from the address bar", () => {
    search = "subject=ps&q=joint";
    render(createElement(ConceptLibrary, { subjects, concepts }));
    expect(screen.getByRole("status").textContent).toMatch(/Showing 1 of 3 concepts in Probability and Statistics matching “joint”/);
    expect((screen.getByLabelText("Subject") as HTMLSelectElement).value).toBe("ps");
  });

  it("explains an entirely empty library", () => {
    render(createElement(ConceptLibrary, { subjects, concepts: [] }));
    expect(screen.getByText("The concept library has no notes yet")).toBeTruthy();
    expect(screen.queryByLabelText("Quick filter")).toBeNull();
    expect(screen.getAllByText(/No concept notes for .* yet\./)).toHaveLength(3);
  });
});
