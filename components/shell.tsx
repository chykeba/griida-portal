import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "./primitives";
import { freshness } from "@/lib/copy";

/**
 * The client shell. Mobile-first: a quiet header, generous measure, and the
 * primary action always reachable by thumb (§6b).
 */
export function AppHeader({
  accountName,
  back,
}: {
  accountName?: string;
  back?: { href: string; label: string };
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-5 pad-safe-top">
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
        {accountName ? (
          <span className="truncate font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-faint">
            {accountName}
          </span>
        ) : null}
      </div>
      {/* The single permitted gradient accent per screen (§6a) */}
      <div className="brand-hairline h-[2px] animate-sweep" />
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pad-safe-bottom">
      {children}
    </main>
  );
}

export function Footer({ lastUpdated }: { lastUpdated: string }) {
  return (
    <footer className="mx-auto mt-12 w-full max-w-2xl border-t border-rule px-5 py-6 pad-safe-bottom">
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
