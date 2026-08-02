import Link from "next/link";
import { Logo } from "../primitives";
import { ThemeToggle } from "../theme-toggle";
import type { Person } from "@/lib/studio/types";

/**
 * The internal shell.
 *
 * Deliberately a different animal from the client shell: dark bar, mono nav,
 * a permanent INTERNAL marker, full-width working measure. §3b calls ambiguity
 * between the two lenses a trust-killer — one leaked internal note costs more
 * than the feature earns — so the two are made structurally hard to confuse
 * rather than merely labelled differently.
 */

const NAV = [
  { href: "/studio", label: "Today" },
  { href: "/studio/my-work", label: "My work" },
  { href: "/studio/standup", label: "Standup" },
  { href: "/studio/clients", label: "Clients" },
  { href: "/studio/team", label: "Team" },
];

export function StudioHeader({ person, active }: { person: Person; active: string }) {
  return (
    <header className="sticky top-0 z-20 bg-ink text-paper-raised">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5 pad-safe-top">
        <Link href="/studio" className="pressable shrink-0 opacity-90 hover:opacity-100">
          <Logo />
        </Link>

        <span className="rounded-sm border border-paper-raised/35 px-1.5 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.1em] opacity-80">
          Internal
        </span>

        <nav className="ml-2 flex items-center gap-1 overflow-x-auto" aria-label="Studio">
          {NAV.map((item) => {
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "pressable inline-flex min-h-9 items-center rounded-md px-3 text-small whitespace-nowrap",
                  isActive
                    ? "bg-paper-raised/15 font-medium"
                    : "opacity-70 hover:bg-paper-raised/10 hover:opacity-100",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span
            title={person.name}
            className="flex size-7 items-center justify-center rounded-full border border-paper-raised/35 font-mono text-[0.6875rem]"
          >
            {person.initials}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function StudioPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pad-safe-bottom">
      {children}
    </main>
  );
}

/** The heading pattern for internal screens — plainer than the client side. */
export function StudioHeading({
  title,
  sub,
  aside,
}: {
  title: string;
  sub?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="animate-rise flex flex-wrap items-end justify-between gap-4 pt-8 pb-6">
      <div>
        <h1 className="font-display text-headline leading-tight font-semibold">{title}</h1>
        {sub ? <p className="mt-1 max-w-[60ch] text-ink-soft">{sub}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
