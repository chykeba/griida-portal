import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, Lock } from "lucide-react";
import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { Badge, Card, Label, Meta, Notice, StatusDot } from "@/components/primitives";
import { PublishPanel } from "@/components/studio/publish-panel";
import { ChecklistRow, type ChecklistItemView } from "@/components/studio/checklist";
import { SendToClient } from "@/components/studio/send-to-client";
import { ReviewLink, type ReviewLinkView } from "@/components/studio/review-link";
import { reviewLinkFor } from "@/lib/db/link-writes";
import { projectClients } from "@/lib/db/project-writes";
import {
  ClientAccess,
  ClientRequests,
  HealthControl,
} from "@/components/studio/project-controls";
import { query } from "@/lib/db/d1";
import { isDemoMode } from "@/lib/auth/dal";
import { requireStudio } from "@/lib/auth/dal";
import { getCurrentPerson, getStudio, getStudioProject } from "@/lib/studio/data";
import {
  blockerSentence,
  canCountersign,
  canPublish,
  canTick,
  checklistProgress,
  composeDraft,
  openBlockers,
  personName,
  publishFreshness,
  taskStatusLabel,
} from "@/lib/studio/logic";
import { can } from "@/lib/studio/permissions";
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

  // One query per deliverable, issued together — the review link and its
  // access attestation, which the gate depends on.
  const clients = isDemoMode() ? [] : await projectClients(project.id);
  // Requests including answered ones, so the loop can be closed here.
  const requests = isDemoMode()
    ? []
    : await query<{
        id: string; title: string; status: string; created_at: string;
        response_url: string | null; response_text: string | null;
      }>(
        `SELECT c.id, c.title, c.status, c.created_at, c.response_text, l.url AS response_url
           FROM client_actions c
           LEFT JOIN links l ON l.id = c.response_link_id
          WHERE c.project_id = ?1 AND c.status != 'accepted'
          ORDER BY c.created_at`,
        [project.id],
      );

  const links = isDemoMode()
    ? new Map<string, ReviewLinkView | null>()
    : new Map(
        await Promise.all(
          project.deliverables.map(async (d) => {
            const row = await reviewLinkFor(d.id);
            const view: ReviewLinkView | null = row
              ? {
                  id: row.id,
                  url: row.url,
                  label: row.label,
                  provider: row.provider,
                  bestOnDesktop: row.best_on_desktop === 1,
                  // Tri-state: null means never checked, which is not the same as
                  // checked-and-failed. Collapsing it to false would hide that.
                  clientAccessOk:
                    row.client_access_ok === null ? null : row.client_access_ok === 1,
                  health: row.health,
                }
              : null;
            return [d.id, view] as const;
          }),
        ),
      );

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

        {!isDemoMode() ? (
          <HealthControl
            projectId={project.id}
            slug={project.slug}
            health={project.health}
            note={project.healthNote}
          />
        ) : null}

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
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

                      {!isDemoMode() ? (
                        <ReviewLink
                          canAttest={can(me, "attest_link_access")}
                          deliverableId={d.id}
                          slug={project.slug}
                          link={links.get(d.id) ?? null}
                        />
                      ) : null}

                      {(d.status === "draft" || d.status === "changes_requested") ? (
                        <SendToClient
                          deliverableId={d.id}
                          slug={project.slug}
                          // Only the link blocks outright; outstanding checks
                          // are an override, not a wall.
                          ready={!gate.hardBlocked}
                          outstanding={
                            d.checklist ? checklistProgress(d.checklist).outstanding.length : 0
                          }
                        />
                      ) : null}

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

                          <ul>
                            {d.checklist.items.map((item) => {
                              const blocked =
                                item.checkedById === me.id
                                  ? "You checked this one — someone else has to countersign it."
                                  : me.role === "member"
                                    ? "Waiting on a lead to countersign"
                                    : null;
                              const view: ChecklistItemView = {
                                id: item.id,
                                label: item.label,
                                guidance: item.guidance,
                                state: item.state,
                                requiresCountersign: item.requiresCountersign,
                                evidenceKind: item.evidenceKind,
                                checkedByName: item.checkedById
                                  ? `${personName(studio.people, item.checkedById)} · ${naturalAge(item.checkedAt!)}`
                                  : null,
                                checkedAt: item.checkedAt,
                                evidenceUrl: item.evidenceUrl,
                                evidenceText: item.evidenceText,
                                canTick: canTick(d, me),
                                canCountersign: canCountersign(item, me),
                                canWaive: can(me, "waive_checklist_item"),
                                countersignBlockedWhy: blocked,
                              };
                              return (
                                <ChecklistRow key={item.id} item={view} slug={project.slug} />
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
              {!isDemoMode() ? (
                <>
                  <h2 className="label mb-2 text-ink-soft">Who can see this</h2>
                  <Card className="mb-6 px-4 py-4">
                    <ClientAccess
                      projectId={project.id}
                      slug={project.slug}
                      clients={clients}
                      canManage={can(me, "manage_project_clients")}
                    />
                  </Card>

                  <h2 className="label mb-2 text-ink-soft">Waiting on them</h2>
                  <Card className="mb-6 px-4 py-4">
                    <ClientRequests
                      projectId={project.id}
                      slug={project.slug}
                      actions={requests.map((r) => ({
                        id: r.id,
                        title: r.title,
                        status: r.status,
                        responseUrl: r.response_url,
                        responseText: r.response_text,
                        age: naturalAge(r.created_at),
                      }))}
                    />
                  </Card>
                </>
              ) : null}

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
                  <PublishPanel draft={draft} projectName={project.name} projectId={project.id} slug={project.slug} />
                </div>
              </Card>

              {isDemoMode() && project.clientActions.length > 0 ? (
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
