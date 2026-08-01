import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Badge, Label, StatusDot, type Tone } from "./primitives";
import { deadline, deliverableCopy, naturalAge, naturalDate, roundsCopy } from "@/lib/copy";
import type { ClientActionView, ProjectView } from "@/lib/types";

/* ==========================================================================
   Shared row model — all three views describe the same project, so they
   should agree on what the "things" are.
   ========================================================================== */

/**
 * `bucket` is derived from the underlying status, never from the label. The
 * board groups on it so that rewording any client-facing copy can't silently
 * empty a column.
 */
type Bucket = "with-you" | "with-us" | "done";

type Row = {
  id: string;
  kind: "Needs you" | "Work" | "Stage";
  bucket: Bucket;
  name: string;
  detail: string;
  status: string;
  tone: Tone;
  due: string | null;
  dueOverdue: boolean;
  updated: string | null;
  href: string | null;
};

function actionRows(actions: ClientActionView[]): Row[] {
  return actions.map((a) => {
    const d = a.dueOn ? deadline(a.dueOn, new Date(), "This") : null;
    return {
      id: a.id,
      kind: "Needs you" as const,
      bucket: "with-you" as const,
      name: a.title,
      detail: a.blocks ? `Holding up ${a.blocks}` : (a.description ?? ""),
      status: "With you",
      tone: (d?.isOverdue ? "alert" : "caution") as Tone,
      due: d?.short ?? null,
      dueOverdue: d?.isOverdue ?? false,
      updated: `Asked ${naturalAge(a.createdAt)}`,
      href: null,
    };
  });
}

function deliverableRows(project: ProjectView): Row[] {
  return project.deliverables.map((d) => {
    const copy = deliverableCopy(d.status);
    const rounds = roundsCopy(d.round, d.roundsIncluded);
    return {
      id: d.id,
      kind: "Work" as const,
      bucket: (d.status === "in_review"
        ? "with-you"
        : d.status === "approved" || d.status === "delivered"
          ? "done"
          : "with-us") as Bucket,
      name: d.name,
      detail: copy.meaning,
      status: copy.label,
      tone: (copy.tone === "approved"
        ? "approved"
        : copy.tone === "caution"
          ? "caution"
          : "neutral") as Tone,
      due: rounds.label,
      dueOverdue: false,
      updated: `Updated ${naturalAge(d.updatedAt)}`,
      href: d.status === "in_review" ? `/p/${project.slug}/review/${d.id}` : null,
    };
  });
}

function milestoneRows(project: ProjectView): Row[] {
  return project.milestones.map((m) => ({
    id: m.id,
    kind: "Stage" as const,
    bucket: (m.status === "complete" ? "done" : "with-us") as Bucket,
    name: m.name,
    detail:
      m.status === "complete"
        ? "Finished"
        : m.status === "in_progress"
          ? "Happening now"
          : "Still to come",
    status:
      m.status === "complete" ? "Done" : m.status === "in_progress" ? "In progress" : "Upcoming",
    tone: (m.status === "complete"
      ? "approved"
      : m.status === "in_progress"
        ? "calm"
        : "neutral") as Tone,
    due: m.targetDate ? naturalDate(m.targetDate) : null,
    dueOverdue: false,
    updated: null,
    href: null,
  }));
}

/* ==========================================================================
   SHEET — everything on one page.
   Reads like a printed schedule, not a spreadsheet: hairline rules, real
   typographic hierarchy, tabular figures so the date column doesn’t jitter.
   ========================================================================== */

export function SheetView({
  project,
  actions,
}: {
  project: ProjectView;
  actions: ClientActionView[];
}) {
  const groups: { title: string; rows: Row[] }[] = [
    { title: "Needs you", rows: actionRows(actions) },
    { title: "The work", rows: deliverableRows(project) },
    { title: "Stages", rows: milestoneRows(project) },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="animate-rise">
      <p className="mb-5 max-w-[60ch] text-small leading-relaxed text-ink-soft">
        Everything in this project on one page. Handy if you need to scan it
        quickly, or show someone else where things stand.
      </p>

      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[42rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-rule-strong">
              <th scope="col" className="py-2 pr-4 meta">
                Item
              </th>
              <th scope="col" className="w-36 py-2 pr-4 meta">
                Status
              </th>
              <th scope="col" className="w-44 py-2 pr-4 meta">
                Date / round
              </th>
              <th scope="col" className="w-36 py-2 meta">
                Last touched
              </th>
            </tr>
          </thead>

          {groups.map((group) => (
            <tbody key={group.title} className="stagger">
              <tr>
                <th
                  colSpan={4}
                  scope="colgroup"
                  className="pt-7 pb-1.5 text-left font-display text-lead font-semibold"
                >
                  {group.title}
                </th>
              </tr>

              {group.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-rule align-top transition-colors duration-150 hover:bg-paper-sunk"
                >
                  <td className="py-3 pr-4">
                    {row.href ? (
                      <Link href={row.href} className="group inline-flex items-start gap-1.5">
                        <span className="font-medium underline decoration-rule-strong underline-offset-4 group-hover:decoration-ink">
                          {row.name}
                        </span>
                        <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-ink-faint" strokeWidth={1.75} aria-hidden />
                      </Link>
                    ) : (
                      <span className="font-medium">{row.name}</span>
                    )}
                    {row.detail ? (
                      <span className="mt-0.5 block max-w-[46ch] text-small leading-relaxed text-ink-soft">
                        {row.detail}
                      </span>
                    ) : null}
                  </td>

                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-2 text-small">
                      <StatusDot tone={row.tone} />
                      {row.status}
                    </span>
                  </td>

                  <td className={`py-3 pr-4 meta ${row.dueOverdue ? "text-alert" : "text-ink-soft"}`}>
                    {row.due ?? "—"}
                  </td>

                  <td className="py-3 meta">
                    {row.updated ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

/* ==========================================================================
   BOARD — where each piece of work stands.
   Ruled columns rather than floating cards. No drag handles: the client
   doesn’t move work between columns, we do.
   ========================================================================== */

const COLUMNS: { title: string; blurb: string; bucket: Bucket; tone: Tone }[] = [
  {
    title: "With you",
    blurb: "Waiting on something from your side",
    bucket: "with-you",
    tone: "caution",
  },
  {
    title: "With us",
    blurb: "We’re working on these now",
    bucket: "with-us",
    tone: "neutral",
  },
  {
    title: "Signed off",
    blurb: "Agreed and finished",
    bucket: "done",
    tone: "approved",
  },
];

export function BoardView({
  project,
  actions,
}: {
  project: ProjectView;
  actions: ClientActionView[];
}) {
  const rows = [...actionRows(actions), ...deliverableRows(project)];

  return (
    <div className="animate-rise">
      <p className="mb-5 max-w-[60ch] text-small leading-relaxed text-ink-soft">
        Every piece of work, grouped by whose court it’s in. Anything under
        <span className="font-medium text-ink"> With you</span> is holding
        something up on our side.
      </p>

      <div className="-mx-5 flex gap-5 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
        {COLUMNS.map((col) => {
          const items = rows.filter((r) => r.bucket === col.bucket);
          return (
            <section key={col.title} className="w-[17rem] shrink-0 lg:w-auto">
              <div className="mb-3 border-b border-rule-strong pb-2">
                <h3 className="flex items-center gap-2 meta">
                  <StatusDot tone={col.tone} />
                  {col.title}
                  <span className="ml-auto tabular text-ink-faint">{items.length}</span>
                </h3>
                <p className="mt-1 text-small leading-snug text-ink-faint">{col.blurb}</p>
              </div>

              {items.length === 0 ? (
                <p className="rounded-md border border-dashed border-rule px-3 py-4 text-center text-small text-ink-faint">
                  Nothing here
                </p>
              ) : (
                <ul className="stagger space-y-2.5">
                  {items.map((row) => {
                    const card = (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-small leading-snug font-medium">{row.name}</p>
                          {row.status === "Approved" || row.status === "Delivered" ? (
                            <Check className="mt-0.5 size-3.5 shrink-0 text-approved" strokeWidth={2.5} aria-hidden />
                          ) : null}
                        </div>
                        {row.detail ? (
                          <p className="mt-1 text-small leading-relaxed text-ink-soft">{row.detail}</p>
                        ) : null}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <Label tone={row.dueOverdue ? "alert" : "neutral"}>
                            {row.due ?? row.status}
                          </Label>
                          {row.updated ? <Label>{row.updated}</Label> : null}
                        </div>
                      </>
                    );

                    return (
                      <li
                        key={row.id}
                        className="rounded-lg border border-rule bg-paper-raised"
                      >
                        {row.href ? (
                          <Link
                            href={row.href}
                            className="pressable block px-3.5 py-3 hover:bg-paper-sunk"
                          >
                            {card}
                          </Link>
                        ) : (
                          <div className="px-3.5 py-3">{card}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
   DESKTOP SIDE RAIL — the "at a glance" column that only appears when there
   is room for it. Not a dumping ground: due date, your open items, documents.
   ========================================================================== */

export function SideRail({
  project,
  actions,
}: {
  project: ProjectView;
  actions: ClientActionView[];
}) {
  const due = project.targetEndOn ? deadline(project.targetEndOn, new Date(), "It") : null;
  const stage = project.milestones.find((m) => m.status === "in_progress");
  const done = project.milestones.filter((m) => m.status === "complete").length;

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-6 border-l border-rule pl-6">
        <div>
          <Label className="mb-2 block">At a glance</Label>
          <dl className="space-y-2.5 text-small">
            <div>
              <dt className="text-ink-faint">Stage</dt>
              <dd className="font-medium">{stage?.name ?? "Wrapping up"}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Progress</dt>
              <dd className="font-medium tabular">
                {done} of {project.milestones.length} stages done
              </dd>
            </div>
            {due ? (
              <div>
                <dt className="text-ink-faint">Finishes</dt>
                <dd className={`font-medium ${due.isOverdue ? "text-alert" : ""}`}>
                  {naturalDate(project.targetEndOn!)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ink-faint">Revisions</dt>
              <dd className="font-medium tabular">
                {project.roundsIncluded} rounds included
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <Label className="mb-2 block">Needs you</Label>
          {actions.length === 0 ? (
            <Badge tone="calm">All clear</Badge>
          ) : (
            <ul className="space-y-1.5">
              {actions.map((a) => (
                <li key={a.id} className="text-small leading-snug">
                  <Link href="#needs-you" className="underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
