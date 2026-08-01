import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, EmptyState, Label, StatusDot } from "./primitives";
import { blocksCopy, deadline, empty, naturalAge } from "@/lib/copy";
import type { ClientActionView } from "@/lib/types";

/**
 * "Waiting on you" — the highest-value module in the product (§5A), and the
 * mobile home screen (§6b). Ordered oldest-first: the thing that’s been sitting
 * longest is the thing actually costing time.
 */
export function WaitingList({
  items,
  showProject = true,
}: {
  items: ClientActionView[];
  showProject?: boolean;
}) {
  if (items.length === 0) {
    return <EmptyState headline={empty.waiting.headline} body={empty.waiting.body} />;
  }

  return (
    <ul className="stagger space-y-2.5">
      {items.map((item) => {
        const due = item.dueOn ? deadline(item.dueOn, new Date(), "This") : null;
        const tone = due?.isOverdue ? "alert" : due?.urgency === "today" ? "caution" : "neutral";
        const blocks = blocksCopy(item.blocks);

        return (
          <Card as="li" key={item.id} className="overflow-hidden">
            <Link
              href={`/p/${item.projectSlug}#needs-you`}
              className="pressable block px-4 py-3.5 hover:bg-paper-sunk"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {showProject ? (
                    <Label className="mb-1 block">{item.projectName}</Label>
                  ) : null}
                  <p className="text-base leading-snug font-medium">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 text-small leading-relaxed text-ink-soft">
                      {item.description}
                    </p>
                  ) : null}

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {due ? (
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 meta",
                          due.isOverdue ? "text-alert" : "text-ink-faint",
                        ].join(" ")}
                      >
                        <StatusDot tone={tone} />
                        {due.short}
                      </span>
                    ) : null}
                    <span className="meta">
                      Asked {naturalAge(item.createdAt)}
                    </span>
                  </div>

                  {blocks ? (
                    <p className="mt-2 border-l-2 border-rule-strong pl-2.5 text-small text-ink-soft">
                      {blocks}
                    </p>
                  ) : null}
                </div>
                <ChevronRight
                  className="mt-0.5 size-4 shrink-0 text-ink-faint"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </div>
            </Link>
          </Card>
        );
      })}
    </ul>
  );
}
