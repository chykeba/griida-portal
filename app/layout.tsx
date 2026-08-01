import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Type choice, and why (§6a):
 *  Fraunces        — an editorial serif with a point of view. Carries the one
 *                    sentence per screen that actually matters.
 *  Instrument Sans — a grotesque with a little warmth. Not Inter, not Geist,
 *                    not Poppins; those read as "generated" now.
 *  JetBrains Mono  — dates, rounds, counters. Mono metadata is what makes an
 *                    interface feel designed rather than assembled.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Griida — your projects",
  description:
    "Where your work with Griida lives: progress, reviews, and everything we owe each other.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale is deliberately absent — never disable pinch zoom (a11y).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d11" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
