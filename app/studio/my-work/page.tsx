import Link from "next/link";
import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { Badge, Card, EmptyState, Label, Meta, StatusDot } from "@/components/primitives";
import { requireStudio } from "@/lib/auth/dal";
import { getCurrentPerson, getStudio } from "@/lib/studio/data";
import {
  blockerSentence,
  blockingOthers,
  myWork,
  openBlockers,
  taskStatusLabel,
} from "@/lib/studio/logic";
import { count, deadline, naturalAge } from "@/lib/copy";

/**
 * The screen the team actually lives in. §7's judgement: if a designer
 * wouldn't voluntarily open this each morning, the internal layer has failed
 * regardless of what else got built. So it is one list, sorted by urgency,
 * with nothing to configure.
 */
export default async function MyWorkPage() {
  await requireStudio("/studio/my-work");
  const studio = await getStudio();
  const me = await getCurrentPerson();
  const mine = myWork(studio, me.id);
  const iAmBlocking = blockingOthers(studio, me.id);

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="/studio/my-work" />
      <StudioPage>
        <StudioHeading
          title="My work"
          sub="Everything on you, across every project. Overdue first."
          aside={
            iAmBlocking.length > 0 ? (
              <Badge tone="caution">Blocking {count(iAmBlocking.length, "person")}</Badge>
            ) : (
              <Badge tone="calm">Blocking nobody</Badge>
            )
          }
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section>
            {mine.length === 0 ? (
              <EmptyState
                headline="Nothing on you right now"
                body="When work is assigned to you it lands here, sorted by what's most urgent."
              />
            ) : (
              <ul className="stagger space-y-2.5">
                {mine.map(({ task, project }) => {
                  const due = task.dueOn ? deadline(task.dueOn, new Date(), "This") : null;
                  const blockers = openBlockers(task);

                  return (
                    <Card as="li" key={task.id} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/studio/p/${project.slug}`}>
                            <Label className="mb-1 block">
                              {project.clientName} · {project.name}
                            </Label>
                          </Link>
                          <p className="text-base leading-snug font-medium">{task.title}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5 text-small">
                          <StatusDot
                            tone={
                              task.status === "blocked"
                                ? "alert"
                                : task.status === "in_progress"
                                  ? "calm"
                                  : "neutral"
                            }
                          />
                          {taskStatusLabel(task.status)}
                        </span>
                      </div>

                      {blockers.length > 0 ? (
                        <ul className="mt-2.5 space-y-1">
                          {blockers.map((b) => (
                            <li
                              key={b.id}
                              className="border-l-2 border-alert/40 pl-2.5 text-small text-ink-soft"
                            >
                              {blockerSentence(b, studio.people, project)}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <Meta className={`mt-2.5 block ${due?.isOverdue ? "text-alert" : ""}`}>
                        {due ? due.short : "No date"} · in this state {naturalAge(task.stateChangedAt)}
                      </Meta>
                    </Card>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Blocking others: visible to you before anyone has to chase (§5a) */}
          <aside>
            <h2 className="label mb-3 text-ink-soft">Blocking others</h2>
            {iAmBlocking.length === 0 ? (
              <Card className="px-4 py-4">
                <p className="text-small text-ink-soft">
                  Nobody is waiting on you. Worth checking again after standup.
                </p>
              </Card>
            ) : (
              <ul className="space-y-2.5">
                {iAmBlocking.map(({ task, project, blocker }) => (
                  <Card as="li" key={blocker.id} className="border-caution/40 px-4 py-3.5">
                    <Label className="mb-1 block">{project.name}</Label>
                    <p className="text-small leading-snug font-medium">{task.title}</p>
                    <p className="mt-1 text-small text-ink-soft">{blocker.note}</p>
                    <Meta className="mt-1.5 block text-caution">
                      Held up for {naturalAge(blocker.createdAt).replace(" ago", "")}
                    </Meta>
                  </Card>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </StudioPage>
    </div>
  );
}
