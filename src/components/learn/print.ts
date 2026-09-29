/**
 * Print stylesheet for the formula book (rendered in a <style> element on the
 * subject page only). The app shell already hides its chrome with `.no-print`;
 * this sheet also:
 *  - forces the light palette, so a dark-theme reader still prints dark ink on
 *    white paper (the triple :root beats the theme selectors' specificity);
 *  - removes the shell's side padding and width cap;
 *  - keeps each formula card on one page where it fits, and keeps a topic
 *    heading with its first card;
 *  - lets wide formulas show in full instead of clipping inside a scroller.
 */
export const FORMULA_PRINT_CSS = `
@media print {
  :root:root:root {
    --bg: #fff; --surface: #fff; --surface-2: #f3f4f6; --surface-3: #e5e7eb;
    --border: #d1d5db; --border-strong: #9ca3af;
    --text: #111827; --text-2: #374151; --text-3: #4b5563;
    --accent: #1f3fae; --accent-text: #1f3fae; --accent-soft: #eef2ff;
    --warning: #7a4700; --warning-soft: #fff7e6; --success: #0f5f36; --success-soft: #ecfdf3;
    --shadow: none;
    color-scheme: light;
  }
  @page { margin: 14mm 12mm; }
  html, body { background: #fff !important; }
  div:has(> #main) { padding-left: 0 !important; }
  #main { max-width: none !important; padding: 0 !important; }
  .formula-card { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; margin-bottom: 10px; }
  .formula-topic-heading { break-after: avoid; page-break-after: avoid; }
  .formula-card .math-display, .formula-card [role="group"] { overflow: visible !important; }
  .formula-card a { color: inherit; text-decoration: none; }
}
`;
