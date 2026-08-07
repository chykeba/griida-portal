import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AppHeader, Page } from "@/components/shell";
import { ReviewForm } from "@/components/review-form";
import { Card, Label, Notice, SectionHeading } from "@/components/primitives";
import { Check } from "lucide-react";
import { requireClientView, isDemoMode } from "@/lib/auth/dal";
import { passedChecksForUser } from "@/lib/db/client-queries";
import { getDeliverable, getWorkspace } from "@/lib/data";
import { errors, naturalAge, roundsCopy } from "@/lib/copy";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const user = await requireClientView(`/p/${slug}/review/${id}`);
  const found = await getDeliverable(slug, id);
  if (!found) notFound();

  const { project, deliverable } = found;
  // Scheduled work appears on the client's plan before it is sent, so this id
  // now resolves for something nobody has delivered yet. There is nothing to
  // review — no link, no rounds — and rendering the decision form for it asks
  // a client to sign off on work they have never seen.
  if (deliverable.status === "draft") notFound();
  const ws = await getWorkspace();
  const rounds = roundsCopy(deliverable.round, deliverable.roundsIncluded);
  const link = deliverable.reviewLink;

  // Requesting changes on this round produces the next one. If that exceeds
  // the agreement, say so before they decide rather than after (§5).
  const nextRoundBillable = deliverable.round + 1 > deliverable.roundsIncluded;

  // What we checked before sending it. Labels only — who ticked them, on what
  // evidence, and anything waived stays internal.
  const passedChecks = isDemoMode()
    ? []
    : await passedChecksForUser(user.id, deliverable.id);

  return (
    <>
      <AppHeader
        accountName={ws.accountName}
        back={{ href: `/p/${project.slug}`, label: project.name }}
      />

      <Page>
        <section className="animate-rise pt-8 pb-6">
          <Label className="mb-1.5 block">{deliverable.typeName}</Label>
          <h1 className="font-display text-headline leading-tight font-semibold tracking-tight">
            {deliverable.name}
          </h1>
          <p className="mt-2 meta">
            {rounds.label} · Updated {naturalAge(deliverable.updatedAt)}
          </p>

          {deliverable.summary ? (
            <p className="mt-4 max-w-[52ch] leading-relaxed">{deliverable.summary}</p>
          ) : null}
        </section>

        {/* --- The link. The whole point of the screen. ------------------ */}
        <section className="mb-8">
          {link ? (
            link.clientAccessOk ? (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable flex min-h-14 items-center justify-between gap-3 rounded-lg border border-ink bg-ink px-4 py-3.5 text-paper-raised"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">
                    Open {link.label}
                  </span>
                  {link.bestOnDesktop ? (
                    <span className="mt-0.5 block meta opacity-70">
                      Opens in Figma · best on a computer
                    </span>
                  ) : null}
                </span>
                <ArrowUpRight className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              </a>
            ) : (
              // The one gate with no override (§5b) — never show a dead link.
              <Notice tone="alert" title={errors.linkNoAccess.headline}>
                {errors.linkNoAccess.body}
              </Notice>
            )
          ) : null}
        </section>

        {/* --- Rounds: margin protection, said plainly (§5) -------------- */}
        <section className="mb-8">
          <Notice
            tone={rounds.isBeyondScope ? "caution" : "neutral"}
            title={rounds.label}
          >
            {rounds.note}
          </Notice>
        </section>

        {/* --- What we checked before sending it -------------------------
                The outcome, not the workings: which checks passed. Never who
                ticked them, the evidence behind it, or what was waived. --- */}
        {passedChecks.length > 0 ? (
          <section className="mb-8">
            <SectionHeading>Before we sent this</SectionHeading>
            <Card className="px-4 py-4">
              <p className="text-small leading-relaxed text-ink-soft">
                Every piece of work goes through a standard before it reaches
                you. Here’s what we checked on this one.
              </p>
              <ul className="mt-3 space-y-1.5">
                {passedChecks.map((check) => (
                  <li key={check.id} className="flex items-start gap-2.5 text-small">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-approved"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    {check.label}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {/* --- The decision --------------------------------------------- */}
        <section className="pb-8">
          <SectionHeading>Over to you</SectionHeading>
          <ReviewForm
            deliverableName={deliverable.name}
            requiresConsideredReview={deliverable.requiresConsideredReview}
            deliverableId={deliverable.id}
            slug={project.slug}
            nextRoundBillable={nextRoundBillable}
          />
        </section>
      </Page>
    </>
  );
}
