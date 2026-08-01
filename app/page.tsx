import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppHeader, Footer, Page } from "@/components/shell";
import { WaitingList } from "@/components/waiting";
import { LinkRow } from "@/components/deliverable";
import {
  Badge,
  Card,
  EmptyState,
  Label,
  SectionHeading,
  StatusDot,
} from "@/components/primitives";
import { getWaitingOnYou, getWorkspace } from "@/lib/data";
import {
  deadline,
  empty,
  healthCopy,
  naturalAge,
  rollUpHealth,
  waitingOnYouCopy,
} from "@/lib/copy";

/**
 * The account front door (§3). Answers, in this order:
 *   1. Is everything okay?
 *   2. Do I owe you anything?
 *   3. What’s happening in each project?
 *
 * Note the ordering: the client’s own obligations come *before* our project
 * cards. §3’s third principle — make their blockers louder than our tasks.
 */
export default async function WorkspacePage() {
  const ws = await getWorkspace();
  const waiting = await getWaitingOnYou();

  const rollUp = rollUpHealth(
    ws.projects.map((p) => p.health),
    waiting.length,
  );
  const waitingCopy = waitingOnYouCopy(waiting.length);
  const lastTouched = ws.projects
    .map((p) => p.lastUpdatedAt)
    .sort()
    .reverse()[0];

  return (
    <>
      <AppHeader accountName={ws.accountName} width="wide" />

      <Page width="wide">
        {/* --- The anxious question, answered before anything else (§1) --- */}
        <section className="animate-rise pt-8 pb-7">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
            Hello {ws.contactFirstName}
          </p>
          <h1 className="mt-2 flex items-start gap-2.5 font-display text-display leading-[1.1] font-semibold tracking-tight">
            <StatusDot tone={rollUp.tone} className="mt-3.5" />
            <span>{rollUp.headline}</span>
          </h1>
          <p className="mt-3 max-w-[46ch] leading-relaxed text-ink-soft">
            {waiting.length > 0
              ? waitingCopy.sub
              : "We’ll post here whenever something moves, and email you when we need you."}
          </p>
        </section>

        {/* On desktop these two sit side by side; on a phone "Needs you" stays
            first, because that is what the client came to resolve. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        {/* --- What the client owes us. Above the fold on a phone (§6b). --- */}
        {waiting.length > 0 ? (
          <section className="mb-10 lg:order-2 lg:mb-0">
            <SectionHeading aside={<Badge tone="caution">{waiting.length} open</Badge>}>
              Needs you
            </SectionHeading>
            <WaitingList items={waiting} />
          </section>
        ) : null}

        {/* --- Projects ------------------------------------------------- */}
        <section className="mb-10 lg:order-1">
          <SectionHeading>Your projects</SectionHeading>

          {ws.projects.length === 0 ? (
            <EmptyState headline={empty.projects.headline} body={empty.projects.body} />
          ) : (
            <ul className="stagger space-y-3">
              {ws.projects.map((project) => {
                const health = healthCopy(
                  project.health,
                  project.healthNote,
                  project.targetEndOn,
                );
                const due = project.targetEndOn
                  ? deadline(project.targetEndOn, new Date(), "It")
                  : null;
                const stage = project.milestones.find((m) => m.status === "in_progress");

                return (
                  <Card as="li" key={project.id} className="overflow-hidden">
                    <Link
                      href={`/p/${project.slug}`}
                      className="pressable block px-4 py-4 hover:bg-paper-sunk"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Label className="mb-1 block">{project.typeName}</Label>
                          <h3 className="font-display text-title leading-tight font-semibold">
                            {project.name}
                          </h3>
                        </div>
                        <ChevronRight
                          className="mt-1 size-4 shrink-0 text-ink-faint"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </div>

                      <p className="mt-2.5 flex items-center gap-2 text-small font-medium">
                        <StatusDot tone={health.tone} />
                        {health.label}
                        {stage ? (
                          <span className="font-normal text-ink-soft">· {stage.name}</span>
                        ) : null}
                      </p>

                      {project.healthNote ? (
                        <p className="mt-1 pl-4 text-small leading-relaxed text-ink-soft">
                          {project.healthNote}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {due ? (
                          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-faint tabular">
                            {due.short}
                          </span>
                        ) : null}
                        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-faint">
                          Updated {naturalAge(project.lastUpdatedAt)}
                        </span>
                      </div>
                    </Link>
                  </Card>
                );
              })}
            </ul>
          )}
        </section>
        </div>

        {/* --- Brand library: carries across every project (§3a) -------- */}
        <section>
          <SectionHeading>Your brand library</SectionHeading>
          <p className="mb-3 max-w-[46ch] text-small leading-relaxed text-ink-soft">
            Everything of yours we hold, in one place. It stays here between
            projects, so we never ask you for the same thing twice.
          </p>
          <div className="stagger grid gap-2 sm:grid-cols-2">
            {ws.brandLibrary.map((link) => (
              <LinkRow key={link.id} link={link} />
            ))}
          </div>
        </section>
      </Page>

      <Footer lastUpdated={lastTouched} width="wide" />
    </>
  );
}
