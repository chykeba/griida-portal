import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { Badge, Card, Label, Meta, StatusDot } from "@/components/primitives";
import { getCurrentPerson, getStudio } from "@/lib/studio/data";
import {
  blockingOthers,
  canPublish,
  checklistProgress,
  openBlockers,
  personName,
  publishFreshness,
} from "@/lib/studio/logic";
import { count, healthCopy, naturalAge } from "@/lib/copy";

export default async function StudioTodayPage() {
  const studio = await getStudio();
  const me = await getCurrentPerson();
  const iAmBlocking = blockingOthers(studio, me.id);

  const stale = studio.projects
    .map((p) => ({ project: p, freshness: publishFreshness(p) }))
    .filter((x) => x.freshness.stale);

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="/studio" />
      <StudioPage>
        <StudioHeading
          title={`Morning, ${me.name}`}
          sub="Everything running, and anything about to go quiet on a client."
        />

        {/* The screen nobody builds and everybody needs (§5a). Placed first
            deliberately: your impact on other people outranks your own list. */}
        {iAmBlocking.length > 0 ? (
          <section className="mb-8">
            <Card className="border-caution/40 bg-caution/[0.05] px-4 py-4">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 text-caution" strokeWidth={2} aria-hidden />
                You’re blocking {count(iAmBlocking.length, "piece")} of work
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {iAmBlocking.map(({ task, project, blocker }) => (
                  <li key={blocker.id} className="text-small">
                    <Link
                      href={`/studio/p/${project.slug}`}
                      className="font-medium underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                    >
                      {task.title}
                    </Link>
                    <span className="text-ink-soft"> — {blocker.note}</span>
                    <Meta className="ml-1.5 text-caution">{naturalAge(blocker.createdAt)}</Meta>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {/* Staleness is the failure mode that kills the whole product (§7) */}
        {stale.length > 0 ? (
          <section className="mb-8">
            <Card className="px-4 py-4">
              <p className="font-medium">
                {stale.length === 1 ? "One client hasn’t" : `${stale.length} clients haven’t`} heard
                from us in a while
              </p>
              <p className="mt-1 text-small text-ink-soft">
                A quiet portal loses trust faster than no portal. Publishing takes a
                minute from standup.
              </p>
              <ul className="mt-3 space-y-1.5">
                {stale.map(({ project, freshness }) => (
                  <li key={project.id} className="flex items-center gap-2 text-small">
                    <Link
                      href={`/studio/p/${project.slug}`}
                      className="font-medium underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                    >
                      {project.clientName} · {project.name}
                    </Link>
                    <Meta>{freshness.label}</Meta>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        <h2 className="label mb-3 text-ink-soft">Projects</h2>
        <ul className="stagger grid gap-3 lg:grid-cols-2">
          {studio.projects.map((project) => {
            const health = healthCopy(project.health, project.healthNote, project.targetEndOn);
            const blocked = project.tasks.filter((t) => openBlockers(t).length > 0);
            const overdue = project.tasks.filter(
              (t) => t.status !== "done" && t.dueOn && t.dueOn < new Date().toISOString(),
            );
            const freshness = publishFreshness(project);
            const gated = project.deliverables.filter((d) => !canPublish(d).ok);

            return (
              <Card as="li" key={project.id} className="overflow-hidden">
                <Link
                  href={`/studio/p/${project.slug}`}
                  className="pressable block px-4 py-4 hover:bg-paper-sunk"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Label className="mb-1 block">{project.clientName}</Label>
                      <h3 className="font-display text-title leading-tight font-semibold">
                        {project.name}
                      </h3>
                    </div>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-ink-faint" strokeWidth={1.75} aria-hidden />
                  </div>

                  <p className="mt-2.5 flex items-center gap-2 text-small font-medium">
                    <StatusDot tone={health.tone} />
                    {health.label}
                    <span className="font-normal text-ink-soft">
                      · lead {personName(studio.people, project.leadId)}
                    </span>
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {blocked.length > 0 ? (
                      <Badge tone="alert">{count(blocked.length, "blocked task")}</Badge>
                    ) : null}
                    {overdue.length > 0 ? (
                      <Badge tone="caution">{count(overdue.length, "overdue")}</Badge>
                    ) : null}
                    {gated.length > 0 ? (
                      <Badge tone="neutral">{count(gated.length, "not publishable")}</Badge>
                    ) : null}
                    {project.clientActions.length > 0 ? (
                      <Badge tone="caution">
                        {count(project.clientActions.length, "item")} with client
                      </Badge>
                    ) : null}
                  </div>

                  <Meta className="mt-3 block">{freshness.label}</Meta>

                  {/* Checklist progress, where a deliverable has one */}
                  {project.deliverables
                    .filter((d) => d.checklist)
                    .map((d) => {
                      const p = checklistProgress(d.checklist!);
                      return (
                        <p key={d.id} className="mt-2 text-small text-ink-soft">
                          {d.name}: <span className="tabular">{p.done}/{p.total}</span> checklist
                          items done
                        </p>
                      );
                    })}
                </Link>
              </Card>
            );
          })}
        </ul>
      </StudioPage>
    </div>
  );
}
