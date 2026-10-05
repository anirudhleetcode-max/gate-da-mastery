import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Content-Security-Policy (every phase except the dev server, which needs
 * eval and HMR websockets).
 * Next streams the RSC payload through inline scripts and KaTeX sets inline
 * styles, so 'unsafe-inline' stays for scripts and styles — a nonce-based
 * policy would force every page to render dynamically. Everything else is
 * locked to this origin: no third-party connections, images, fonts, frames,
 * plugins or form targets. Fonts are self-hosted by next/font.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const config = (isDev: boolean): NextConfig => ({
  reactStrictMode: true,
  poweredByHeader: false,
  // The compiled content bundle is read from disk by the server-side repository.
  outputFileTracingIncludes: {
    "/**": ["./generated/content.json"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(!isDev
            ? [
                { key: "Content-Security-Policy", value: CSP },
                { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
              ]
            : []),
        ],
      },
    ];
  },
});

export default function nextConfig(phase: string): NextConfig {
  return config(phase === PHASE_DEVELOPMENT_SERVER);
}
