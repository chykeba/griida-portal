import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "./primitives";
import { ThemeToggle } from "./theme-toggle";
import { freshness } from "@/lib/copy";

/**
 * Measure, by intent. Reading columns stay narrow no matter how wide the
 * screen gets — a 1400px line of body text is unreadable, and widening the
 * container is not the same thing as designing for desktop.
 */
const WIDTHS = {
  reading: "max-w-2xl",
  wide: "max-w-5xl",
  full: "max-w-6xl",
} as const;

export type ShellWidth = keyof typeof WIDTHS;

/**
 * The client shell. Mobile-first: a quiet header, generous measure, and the
 * primary action always reachable by thumb (§6b).
 */
export function AppHeader({
  accountName,
  back,
  width = "reading",
}: {
  accountName?: string;
  back?: { href: string; label: string };
  width?: ShellWidth;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper/85 backdrop-blur-sm">
      <div
        className={`mx-auto flex h-14 ${WIDTHS[width]} items-center justify-between gap-3 px-5 pad-safe-top`}
      >
        {back ? (
          <Link
            href={back.href}
            className="pressable -ml-2 flex h-11 items-center gap-1.5 rounded-md px-2 text-small text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
            {back.label}
          </Link>
        ) : (
          <Logo />
        )}
        <div className="flex min-w-0 items-center gap-2">
          {accountName ? (
            <span className="truncate font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-faint">
              {accountName}
            </span>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
      {/* The single permitted gradient accent per screen (§6a) */}
      <div className="brand-hairline h-[2px] animate-sweep" />
    </header>
  );
}

export function Page({
  children,
  width = "reading",
}: {
  children: React.ReactNode;
  width?: ShellWidth;
}) {
  return (
    <main className={`mx-auto w-full ${WIDTHS[width]} flex-1 px-5 pb-16 pad-safe-bottom`}>
      {children}
    </main>
  );
}

export function Footer({
  lastUpdated,
  width = "reading",
}: {
  lastUpdated: string;
  width?: ShellWidth;
}) {
  return (
    <footer
      className={`mx-auto mt-12 w-full ${WIDTHS[width]} border-t border-rule px-5 py-6 pad-safe-bottom`}
    >
      {/* Recency reassures; a stale portal destroys trust faster than none (§6) */}
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-faint tabular">
        {freshness(lastUpdated)}
      </p>
      <p className="mt-2 max-w-[46ch] text-small leading-relaxed text-ink-soft">
        Something look wrong, or need us sooner? Reply to any of our emails — it
        lands with the same person who wrote the update.
      </p>
    </footer>
  );
}
