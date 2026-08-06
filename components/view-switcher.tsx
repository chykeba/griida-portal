import Link from "next/link";
import { CalendarDays, Columns3, Rows3, ScrollText } from "lucide-react";

export type ProjectViewMode = "story" | "schedule" | "board";

export function parseViewMode(value?: string | string[]): ProjectViewMode {
  const v = Array.isArray(value) ? value[0] : value;
  // "sheet" is the old name for the schedule. Links get pasted into email and
  // outlive renames, so it keeps working.
  if (v === "sheet") return "schedule";
  return v === "schedule" || v === "board" ? v : "story";
}

const MODES: {
  id: ProjectViewMode;
  label: string;
  hint: string;
  Icon: typeof Rows3;
}[] = [
  { id: "story", label: "Story", hint: "The narrative — what's happened and what's next", Icon: ScrollText },
  { id: "schedule", label: "Schedule", hint: "Every piece of work and when it's due", Icon: CalendarDays },
  { id: "board", label: "Board", hint: "Each piece of work, grouped by where it stands", Icon: Columns3 },
];

/**
 * Three ways to read the same project.
 *
 * Driven by a URL search param rather than client state, which means: it works
 * without JavaScript, the back button behaves, and — the real reason — a client
 * can send their boss a link that opens straight on the tracking sheet.
 */
export function ViewSwitcher({
  slug,
  active,
}: {
  slug: string;
  active: ProjectViewMode;
}) {
  return (
    <nav aria-label="Choose how to view this project" className="flex items-center gap-1">
      {MODES.map(({ id, label, hint, Icon }) => {
        const isActive = id === active;
        return (
          <Link
            key={id}
            href={id === "story" ? `/p/${slug}` : `/p/${slug}?view=${id}`}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            title={hint}
            className={[
              "pressable inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3",
              "text-small font-medium",
              isActive
                ? "border-ink bg-ink text-paper-raised"
                : "border-rule-interactive text-ink-soft hover:border-ink hover:text-ink",
            ].join(" ")}
          >
            <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
