import Link from "next/link";
import { ArrowUpRight, ChevronRight, Monitor } from "lucide-react";
import { Badge, Card, Label, StatusDot } from "./primitives";
import { deliverableCopy, naturalAge, roundsCopy } from "@/lib/copy";
import type { DeliverableView, Link as LinkModel } from "@/lib/types";

/**
 * A deliverable as a link card (§3c). There are no uploaded previews, so this
 * has to carry itself typographically — that’s the design constraint, treated
 * as an opportunity rather than an empty state.
 */
export function DeliverableCard({
  deliverable,
  projectSlug,
}: {
  deliverable: DeliverableView;
  projectSlug: string;
}) {
  const status = deliverableCopy(deliverable.status);
  const rounds = roundsCopy(deliverable.round, deliverable.roundsIncluded);
  const reviewable = deliverable.status === "in_review";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label className="mb-1 block">{deliverable.typeName}</Label>
          <h3 className="font-display text-title leading-tight font-semibold">
            {deliverable.name}
          </h3>
        </div>
        <Badge
          tone={
            status.tone === "approved"
              ? "approved"
              : status.tone === "caution"
                ? "caution"
                : "neutral"
          }
        >
          <StatusDot
            tone={
              status.tone === "approved"
                ? "approved"
                : status.tone === "caution"
                  ? "caution"
                  : "neutral"
            }
          />
          {status.label}
        </Badge>
      </div>

      <p className="mt-2 text-small leading-relaxed text-ink-soft">{status.meaning}</p>

      {deliverable.summary ? (
        <p className="mt-2.5 border-l-2 border-rule-strong pl-3 text-small leading-relaxed">
          {deliverable.summary}
        </p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="meta">
          {rounds.label}
        </span>
        <span className="meta">
          Updated {naturalAge(deliverable.updatedAt)}
        </span>
      </div>

      {reviewable ? (
        <p className="mt-3 flex items-center gap-1 text-small font-medium">
          Take a look
          <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
        </p>
      ) : null}
    </>
  );

  if (!reviewable) {
    return <Card className="px-4 py-4">{body}</Card>;
  }

  return (
    <Card className="overflow-hidden">
      <Link
        href={`/p/${projectSlug}/review/${deliverable.id}`}
        className="pressable block px-4 py-4 hover:bg-paper-sunk"
      >
        {body}
      </Link>
    </Card>
  );
}

/* ========================================================================== */

const providerName: Record<LinkModel["provider"], string> = {
  figma: "Figma",
  drive: "Google Drive",
  staging: "Preview site",
  loom: "Loom",
  other: "Link",
};

/**
 * A link, presented honestly: where it goes, and whether it’ll actually be any
 * good on the device you’re holding (§3c, §6b).
 */
export function LinkRow({ link }: { link: LinkModel }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="pressable flex min-h-11 items-center justify-between gap-3 rounded-md border border-rule bg-paper-raised px-3.5 py-3 hover:bg-paper-sunk"
    >
      <span className="min-w-0">
        <span className="block truncate text-small font-medium">{link.label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 meta">
          {providerName[link.provider]}
          {link.bestOnDesktop ? (
            <>
              <span aria-hidden>·</span>
              <Monitor className="size-3" strokeWidth={2} aria-hidden />
              Best on desktop
            </>
          ) : null}
        </span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} aria-hidden />
    </a>
  );
}
