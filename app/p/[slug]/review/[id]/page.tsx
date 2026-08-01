import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AppHeader, Page } from "@/components/shell";
import { ReviewForm } from "@/components/review-form";
import { Label, Notice, SectionHeading } from "@/components/primitives";
import { getDeliverable, getWorkspace } from "@/lib/data";
import { errors, naturalAge, roundsCopy } from "@/lib/copy";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const found = await getDeliverable(slug, id);
  if (!found) notFound();

  const { project, deliverable } = found;
  const ws = await getWorkspace();
  const rounds = roundsCopy(deliverable.round, deliverable.roundsIncluded);
  const link = deliverable.reviewLink;

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
          <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-faint tabular">
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
                    <span className="mt-0.5 block font-mono text-[0.6875rem] uppercase tracking-[0.1em] opacity-70">
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

        {/* --- The decision --------------------------------------------- */}
        <section className="pb-8">
          <SectionHeading>Over to you</SectionHeading>
          <ReviewForm
            deliverableName={deliverable.name}
            requiresConsideredReview={deliverable.requiresConsideredReview}
          />
        </section>
      </Page>
    </>
  );
}
