import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

/**
 * Type choice, and why (§6a):
 *  Newsreader      — an editorial serif drawn for reading on screens. It
 *                    replaced Fraunces, which had more personality than
 *                    legibility at heading sizes and read a little costume-y.
 *  Instrument Sans — a grotesque with a little warmth. Not Inter, not Geist,
 *                    not Poppins; those read as "generated" now.
 *  JetBrains Mono  — used sparingly, for uppercase region labels only. It is
 *                    no longer carrying dates or statuses: letterspaced
 *                    uppercase micro-type is decoration, not something to
 *                    make people read.
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
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
  themeColor: "#fbfaf8",
};

/**
 * Applies the saved theme before first paint, so a returning dark-mode user
 * never sees a white flash. Runs blocking and synchronously on purpose — it is
 * three lines, and the alternative is a visible flicker on every navigation.
 *
 * Light is the default. We do not read prefers-color-scheme: the studio's work
 * is presented on paper-white unless someone deliberately chooses otherwise.
 */
const noFlashTheme = `try{var t=localStorage.getItem("griida-theme");if(t==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${newsreader.variable} ${instrument.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
