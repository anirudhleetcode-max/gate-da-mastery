import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/components/layout/ThemeToggle";
import { UserDataProvider } from "@/lib/userdata/hooks";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "GATE DA Mastery", template: "%s · GATE DA Mastery" },
  description:
    "Preparation platform for the GATE Data Science & Artificial Intelligence (DA) paper: official previous-year questions with verified step-by-step solutions, 50 progressive mock tests, analytics, spaced revision and an error log.",
  applicationName: "GATE DA Mastery",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#151a23" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <UserDataProvider>{children}</UserDataProvider>
      </body>
    </html>
  );
}
