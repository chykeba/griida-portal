import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StudioHeader, StudioPage } from "@/components/studio/shell";
import { Badge, Card, Label, Meta, StatusDot } from "@/components/primitives";
import { PublishPanel } from "@/components/studio/publish-panel";
import { getCurrentPerson, getStudio } from "@/lib/studio/data";
import {
  blockerSentence,
  composeDraft,
  dueWithin,
  openBlockers,
  personName,
  publishFreshness,
  taskStatusLabel,
} from "@/lib/studio/logic";
import { count, deadline, healthCopy, naturalAge } from "@/lib/copy";

/**
 * Standup mode (§5c).
 *
 * The strategic move in the whole product: **standup is where publishing
 * happens.** The team already meets to walk the projects, and the drafted
 * client update is sitting right there in the walkthrough — so the portal
 * stays current not through discipline, but because staleness would be visible
 * to the whole room.
 *
 * It is a *view*, not a form. Everything here already exists — tasks,
 * blockers, ages, client items. Nobody types their status twice.
 */
export default async function StandupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const studio = await getStudio();
  const me = await getCurrentPerson();

  const raw = (await searchParams).at;
  const index = Math.min(
    Math.max(Number(Array.isArray(raw) ? raw[0] : (raw ?? 0)) || 0, 0),
    studio.projects.length - 1,
  );
  const project = studio.projects[index];
  const health = healthCopy(project.health, project.healthNote, project.targetEndOn);
  const freshness = publishFreshness(project);

  const blocked = project.tasks.filter((t) => openBlockers(t).length > 0);
  const dueSoon = dueWithin(project, 7);
  const moved = project.tasks.filter((t) => t.status === "done");

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="/studio/standup" />
      <StudioPage>
        {/* Position in the walkthrough — one project per screen */}
        <div className="flex items-center justify-between gap-4 pt-8 pb-5">
          <div>
            <Label className="mb-1 block">
              {project.clientName} · {index + 1} of {studio.projects.length}
            </Label>
            <h1 className="font-display text-headline leading-tight font-semibold">
              {project.name}
            </h1>
            <p className="mt-1.5 flex items-center gap-2 text-ink-soft">
              <StatusDot tone={health.tone} />
              {health.label}
              <span>· lead {personName(studio.people, project.leadId)}</span>
            </p>
          </div>

          <nav className="flex shrink-0 items-center gap-2" aria-label="Walkthrough">
            <Link
              href={`/studio/standup?at=${index - 1}`}
              aria-disabled={index === 0}
              className={`pressable inline-flex size-11 items-center justify-center rounded-md border border-rule-interactive ${index === 0 ? "pointer-events-none opacity-40" : ""}`}
              aria-label="Previous project"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
            <Link
              href={`/studio/standup?at=${index + 1}`}
              aria-disabled={index >= studio.projects.length - 1}
              className={`pressable inline-flex size-11 items-center justify-center rounded-md border border-rule-interactive ${index >= studio.projects.length - 1 ? "pointer-events-none opacity-40" : ""}`}
              aria-label="Next project"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </nav>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="animate-rise space-y-6">
            {/* Blocked — the first question in any standup */}
            <section>
              <h2 className="label mb-2.5 text-ink-soft">
                Blocked {blocked.length > 0 ? `· ${blocked.length}` : ""}
              </h2>
              {blocked.length === 0 ? (
                <Card className="px-4 py-3">
                  <p className="text-small text-ink-soft">Nothing blocked. Rare and worth noticing.</p>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {blocked.map((task) => (
                    <Card as="li" key={task.id} className="border-alert/30 px-4 py-3">
                      <p className="text-small font-medium">{task.title}</p>
                      <Meta className="mt-0.5 block">
                        {personName(studio.people, task.responsibleId)}
                      </Meta>
                      {openBlockers(task).map((b) => (
                        <p key={b.id} className="mt-1.5 text-small text-ink-soft">
                          {blockerSentence(b, studio.people, project)}
                        </p>
                      ))}
                    </Card>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="label mb-2.5 text-ink-soft">Due within the week</h2>
              {dueSoon.length === 0 ? (
                <Meta>Nothing due in the next seven days.</Meta>
              ) : (
                <ul className="space-y-1.5">
                  {dueSoon.map((task) => {
                    const due = deadline(task.dueOn!, new Date(), "This");
                    return (
                      <li key={task.id} className="flex flex-wrap items-baseline gap-x-2 text-small">
                        <span className="font-medium">{task.title}</span>
                        <Meta className={due.isOverdue ? "text-alert" : ""}>
                          {personName(studio.people, task.responsibleId)} · {due.short} ·{" "}
                          {taskStatusLabel(task.status).toLowerCase()}
                        </Meta>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h2 className="label mb-2.5 text-ink-soft">Waiting on the client</h2>
              {project.clientActions.length === 0 ? (
                <Meta>Nothing outstanding with them.</Meta>
              ) : (
                <ul className="space-y-1.5">
                  {project.clientActions.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 text-small">
                      <span className="font-medium">{a.title}</span>
                      <Meta>asked {naturalAge(a.createdAt)}</Meta>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {moved.length > 0 ? (
              <section>
                <h2 className="label mb-2.5 text-ink-soft">Finished</h2>
                <Meta>{count(moved.length, "task")} completed — {moved.map((t) => t.title).join(", ")}</Meta>
              </section>
            ) : null}
          </div>

          {/* Publish without leaving the meeting — the point of §5c */}
          <aside>
            <div className="lg:sticky lg:top-24">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h2 className="label text-ink-soft">Ready to publish</h2>
                {freshness.stale ? (
                  <Badge tone="caution">Gone quiet</Badge>
                ) : (
                  <Badge tone="calm">Fresh</Badge>
                )}
              </div>
              <Card className="px-4 py-4">
                <PublishPanel
                  draft={composeDraft(project)}
                  projectName={project.name}
                />
              </Card>
              <Meta className="mt-2 block">
                Publishing here is the whole point — the update is already written
                from what happened. Edit a sentence and send it.
              </Meta>
            </div>
          </aside>
        </div>
      </StudioPage>
    </div>
  );
}
