import { Check } from "lucide-react";
import { naturalDate } from "@/lib/copy";
import type { MilestoneView } from "@/lib/types";

/**
 * "You are here." A horizontal path, not a Gantt chart (§3).
 *
 * On mobile it scrolls inside its own container — the page body never scrolls
 * sideways. The current stage is the anchor, so it's what you see first.
 */
export function Timeline({ milestones }: { milestones: MilestoneView[] }) {
  const currentIndex = milestones.findIndex((m) => m.status === "in_progress");
  const current = currentIndex === -1 ? milestones.length : currentIndex;

  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-1">
      <ol className="flex min-w-max items-start gap-0">
        {milestones.map((m, i) => {
          const done = m.status === "complete";
          const active = m.status === "in_progress";
          const isLast = i === milestones.length - 1;

          return (
            <li key={m.id} className="flex items-start">
              <div className="flex w-[8.5rem] flex-col items-start">
                <div className="flex w-full items-center">
                  <span
                    className={[
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      done
                        ? "border-approved bg-approved text-paper-raised"
                        : active
                          ? "border-ink bg-ink text-paper-raised"
                          : "border-rule-strong bg-paper-raised",
                    ].join(" ")}
                  >
                    {done ? (
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    ) : active ? (
                      <span className="size-1.5 rounded-full bg-paper-raised" aria-hidden />
                    ) : null}
                  </span>
                  {!isLast ? (
                    <span
                      className={[
                        "h-px flex-1",
                        i < current ? "bg-approved/50" : "bg-rule",
                      ].join(" ")}
                      aria-hidden
                    />
                  ) : null}
                </div>

                <p
                  className={[
                    "mt-2 pr-4 text-base leading-snug",
                    active ? "font-semibold text-ink" : done ? "text-ink-soft" : "text-ink-faint",
                  ].join(" ")}
                >
                  {m.name}
                </p>
                <p className="meta pr-3">
                  {done
                    ? "Done"
                    : m.targetDate
                      ? naturalDate(m.targetDate)
                      : ""}
                </p>
                {active ? (
                  <span className="label mt-1 text-ink">You are here</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
