import { RichHtml } from "./RichHtml";

/**
 * Rich content for server components.
 *
 * It delegates to the client RichHtml on purpose. A server component's output
 * is serialised into the RSC payload as well as the HTML, so rendering KaTeX
 * here would ship every formula twice. On the formula book that came to
 * 4.3 MB per page: 1.7 MB of HTML plus 2.6 MB of payload. RichHtml receives
 * the compact math placeholders (raw TeX) as its prop, renders the math
 * during SSR (so the HTML has typeset math and nothing flashes), and repeats
 * the render on the client from the small payload.
 */
export function ServerRichHtml({ html, className }: { html: string; className?: string }) {
  return <RichHtml html={html} className={className} />;
}
