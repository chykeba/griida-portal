import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, Lock, ShieldCheck } from "lucide-react";
import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { Badge, Card, Label, Meta, Notice, StatusDot } from "@/components/primitives";
import { PublishPanel } from "@/components/studio/publish-panel";
import { requireStudio } from "@/lib/auth/dal";
import { getCurrentPerson, getStudio, getStudioProject } from "@/lib/studio/data";
import {
  blockerSentence,
  canCountersign,
  canPublish,
  canTick,
  checklistProgress,
  composeDraft,
  isSettled,
  openBlockers,
  personName,
  publishFreshness,
  taskStatusLabel,
} from "@/lib/studio/logic";
import { count, deadline, deliverableCopy, naturalAge } from "@/lib/copy";

export default async function StudioProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireStudio(`/studio/p/${slug}`);
  const project = await getStudioProject(slug);
  if (!project) notFound();

  const studio = await getStudio();
  const me = await getCurrentPerson();
  const freshness = publishFreshness(project);
  const draft = composeDraft(project);

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="" />
      <StudioPage>
        <StudioHeading
          title={project.name}
          sub={`${project.clientName} · lead ${personName(studio.people, project.leadId)}`}
          aside={
            <Link
              href={`/p/${project.slug}`}
              className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small font-medium"
            >
              See the client’s view
              <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          }
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-8">
            {/* ---- Deliverables and their gates ---------------------- */}
            <section>
              <h2 className="label mb-3 text-ink-soft">Deliverables</h2>
              <ul className="space-y-3">
                {project.deliverables.map((d) => {
                  const gate = canPublish(d);
                  const status = deliverableCopy(d.status);
                  const progress = d.checklist ? checklistProgress(d.checklist) : null;

                  return (
                    <Card as="li" key={d.id} className="px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Label className="mb-1 block">{d.typeName}</Label>
                          <h3 className="font-display text-title leading-tight font-semibold">
                            {d.name}
                          </h3>
                          <Meta className="mt-1 block">
                            {personName(studio.people, d.ownerId)} · round {d.round} of{" "}
                            {d.roundsIncluded} · {status.label.toLowerCase()} since{" "}
                            {naturalAge(d.stateChangedAt)}
                          </Meta>
                        </div>
                        {gate.ok ? (
                          <Badge tone="approved">
                            <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                            Publishable
                          </Badge>
                        ) : (
                          <Badge tone={gate.hardBlocked ? "alert" : "caution"}>
                            {gate.hardBlocked ? (
                              <Lock className="size-3.5" strokeWidth={2} aria-hidden />
                            ) : null}
                            {gate.hardBlocked ? "Hard blocked" : "Not yet"}
                          </Badge>
                        )}
                      </div>

                      {!gate.ok ? (
                        <ul className="mt-3 space-y-1">
                          {gate.reasons.map((r) => (
                            <li key={r} className="text-small text-ink-soft">
                              — {r}
                            </li>
                          ))}
                          {gate.hardBlocked ? (
                            <li className="mt-1 text-small text-alert">
                              This one can’t be waived. A link the client can’t open is
                              the only failure they experience directly.
                            </li>
                          ) : null}
                        </ul>
                      ) : null}

                      {/* ---- The SOP checklist (§5b) ------------------ */}
                      {d.checklist && progress ? (
                        <div className="mt-4 border-t border-rule pt-3">
                          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-small font-medium">
                              {d.checklist.templateName} checklist
                              <Meta className="ml-2">
                                v{d.checklist.templateVersion} · {progress.done}/{progress.total}
                              </Meta>
                            </p>
                            {!canTick(d, me) ? (
                              <Meta>Only {personName(studio.people, d.ownerId)} can tick these</Meta>
                            ) : null}
                          </div>

                          <ul className="space-y-1.5">
                            {d.checklist.items.map((item) => {
                              const settled = isSettled(item);
                              const awaitingSign =
                                item.state === "checked" && item.requiresCountersign;
                              return (
                                <li key={item.id} className="flex items-start gap-2.5">
                                  <span
                                    aria-hidden
                                    className={[
                                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
                                      settled
                                        ? "border-approved bg-approved text-paper-raised"
                                        : awaitingSign
                                          ? "border-caution"
                                          : "border-rule-interactive",
                                    ].join(" ")}
                                  >
                                    {settled ? (
                                      <Check className="size-3" strokeWidth={3} aria-hidden />
                                    ) : null}
                                  </span>

                                  <span className="min-w-0">
                                    <span
                                      className={`text-small ${settled ? "text-ink-soft" : "font-medium"}`}
                                    >
                                      {item.label}
                                    </span>
                                    {item.requiresCountersign ? (
                                      <ShieldCheck
                                        className="ml-1.5 inline size-3.5 text-caution"
                                        strokeWidth={2}
                                        aria-label="Needs a second pair of eyes"
                                      />
                                    ) : null}

                                    {item.guidance && !settled ? (
                                      <span className="mt-0.5 block text-small text-ink-faint">
                                        {item.guidance}
                                      </span>
                                    ) : null}

                                    {/* The attestation: who, when, on what evidence */}
                                    {item.checkedById ? (
                                      <Meta className="mt-0.5 block">
                                        {personName(studio.people, item.checkedById)} ·{" "}
                                        {naturalAge(item.checkedAt!)}
                                        {item.evidenceUrl ? (
                                          <>
                                            {" · "}
                                            <a
                                              href={item.evidenceUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
                                            >
                                              evidence
                                            </a>
                                          </>
                                        ) : null}
                                        {item.evidenceText ? ` · “${item.evidenceText}”` : null}
                                      </Meta>
                                    ) : null}

                                    {awaitingSign ? (
                                      <Meta className="mt-0.5 block text-caution">
                                        {canCountersign(item, me)
                                          ? "Needs your countersign"
                                          : `Needs a countersign from someone other than ${personName(studio.people, item.checkedById)}`}
                                      </Meta>
                                    ) : null}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </ul>
            </section>

            {/* ---- Tasks --------------------------------------------- */}
            <section>
              <h2 className="label mb-3 text-ink-soft">Work</h2>
              <ul className="space-y-2">
                {project.tasks.map((task) => {
                  const due = task.dueOn ? deadline(task.dueOn, new Date(), "This") : null;
                  const blockers = openBlockers(task);
                  return (
                    <Card as="li" key={task.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p
                          className={`text-small font-medium ${task.status === "done" ? "text-ink-faint line-through" : ""}`}
                        >
                          {task.title}
                        </p>
                        <span className="flex items-center gap-1.5 text-small">
                          <StatusDot
                            tone={
                              task.status === "blocked"
                                ? "alert"
                                : task.status === "done"
                                  ? "approved"
                                  : task.status === "in_progress"
                                    ? "calm"
                                    : "neutral"
                            }
                          />
                          {taskStatusLabel(task.status)}
                        </span>
                      </div>
                      <Meta className={`mt-1 block ${due?.isOverdue && task.status !== "done" ? "text-alert" : ""}`}>
                        {personName(studio.people, task.responsibleId)}
                        {due ? ` · ${due.short}` : ""}
                      </Meta>
                      {blockers.map((b) => (
                        <p
                          key={b.id}
                          className="mt-1.5 border-l-2 border-alert/40 pl-2.5 text-small text-ink-soft"
                        >
                          {blockerSentence(b, studio.people, project)}
                        </p>
                      ))}
                    </Card>
                  );
                })}
              </ul>
            </section>
          </div>

          {/* ---- Publishing ------------------------------------------ */}
          <aside className="space-y-4">
            <div className="lg:sticky lg:top-24">
              <h2 className="label mb-3 text-ink-soft">Client’s view</h2>
              <Card className="px-4 py-4">
                <Meta className={freshness.stale ? "text-caution" : ""}>{freshness.label}</Meta>
                {freshness.stale ? (
                  <Notice tone="caution" title="Going quiet" >
                    It’s been a week. Publish something, even if it’s only to say
                    what you’re waiting on.
                  </Notice>
                ) : null}
                <div className="mt-3">
                  <PublishPanel draft={draft} projectName={project.name} />
                </div>
              </Card>

              {project.clientActions.length > 0 ? (
                <div className="mt-4">
                  <h2 className="label mb-2 text-ink-soft">Waiting on the client</h2>
                  <ul className="space-y-1.5">
                    {project.clientActions.map((a) => (
                      <li key={a.id} className="text-small">
                        {a.title}
                        <Meta className="ml-1.5">asked {naturalAge(a.createdAt)}</Meta>
                      </li>
                    ))}
                  </ul>
                  <Meta className="mt-2 block">
                    {count(project.clientActions.length, "item")} — each one is blocking
                    something on our side.
                  </Meta>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </StudioPage>
    </div>
  );
}
