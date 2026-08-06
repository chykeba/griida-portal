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

/* ==========================================================================
   SCHEDULE — one row per piece of work, ordered by when it's due.

   This is the view that replaces the studio's hand-kept delivery spreadsheet,
   and it keeps that sheet's shape on purpose: name, date, status, sorted by
   date, colour that means something. People already know how to read it.

   What it does differently is that nothing here is typed twice. A row moves
   because the work moved.
   ========================================================================== */

interface ScheduleRow {
  id: string;
  name: string;
  typeName: string;
  status: string;
  meaning: string;
  tone: Tone;
  due: string | null;
  dueShort: string | null;
  overdue: boolean;
  done: boolean;
  href: string | null;
}

function scheduleRows(project: ProjectView, now: Date): ScheduleRow[] {
  const rows = project.deliverables.map((d) => {
    const copy = deliverableCopy(d.status);
    const done = d.status === "approved" || d.status === "delivered";
    const due = d.dueOn ? deadline(d.dueOn, now, "This") : null;
    return {
      id: d.id,
      name: d.name,
      typeName: d.typeName,
      status: copy.label,
      meaning: copy.meaning,
      // Late only counts while it's still outstanding. Something approved last
      // week that slipped its date is finished, and colouring it red would
      // make the view cry wolf.
      tone: (done
        ? "approved"
        : due?.isOverdue
          ? "alert"
          : copy.tone === "caution"
            ? "caution"
            : "neutral") as Tone,
      due: d.dueOn,
      dueShort: due ? (due.isOverdue ? due.short : naturalDate(d.dueOn!, now)) : null,
      overdue: Boolean(due?.isOverdue) && !done,
      done,
      href: d.status === "in_review" ? `/p/${project.slug}/review/${d.id}` : null,
    };
  });

  // Undated work sits at the end rather than being hidden — it's still real,
  // it just hasn't been committed to a day.
  return rows.sort((a, b) => {
    if (!a.due && !b.due) return a.name.localeCompare(b.name);
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  });
}

export function ScheduleView({
  project,
  actions,
}: {
  project: ProjectView;
  actions: ClientActionView[];
}) {
  const now = new Date();
  const rows = scheduleRows(project, now);
  const done = rows.filter((r) => r.done).length;
  const late = rows.filter((r) => r.overdue).length;

  return (
    <div className="animate-rise">
      {/* The honest version of a completion percentage. Counts can be checked
          against the rows underneath; a percentage can't. */}
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-display text-lead">
          {done} of {rows.length} {rows.length === 1 ? "piece" : "pieces"} approved
        </p>
        {late > 0 ? (
          <p className="text-small text-alert">
            {late} past its date
          </p>
        ) : rows.length > 0 ? (
          <p className="text-small text-ink-soft">Everything else is on schedule</p>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <p className="mb-5 rounded-md border border-caution/40 bg-caution/10 px-3 py-2 text-small">
          {actions.length === 1
            ? "There’s one thing we need from you"
            : `There are ${actions.length} things we need from you`}{" "}
          — see <Link href="#needs-you" className="underline underline-offset-4">Needs you</Link>{" "}
          on the Story view.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="max-w-[52ch] leading-relaxed text-ink-soft">
          Nothing is scheduled yet. As soon as we plan the pieces of this
          project, they’ll show up here with their dates.
        </p>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">
              Every piece of work in {project.name}, ordered by when it’s due
            </caption>
            <thead>
              <tr className="border-b border-rule-strong">
                <th scope="col" className="py-2 pr-4 meta">
                  Item
                </th>
                <th scope="col" className="w-36 py-2 pr-4 meta">
                  Due
                </th>
                <th scope="col" className="w-44 py-2 meta">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="stagger">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={[
                    "border-b border-rule align-top transition-colors duration-150",
                    row.overdue ? "bg-alert/[0.06]" : "hover:bg-paper-sunk",
                  ].join(" ")}
                >
                  <td className="py-3 pr-4">
                    {row.href ? (
                      <Link href={row.href} className="group inline-flex items-start gap-1.5">
                        <span className="font-medium underline decoration-rule-strong underline-offset-4 group-hover:decoration-ink">
                          {row.name}
                        </span>
                        <ArrowUpRight
                          className="mt-0.5 size-3.5 shrink-0 text-ink-faint transition-transform group-hover:-translate-y-0.5"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </Link>
                    ) : (
                      <span className="font-medium">{row.name}</span>
                    )}
                    <span className="meta block">{row.typeName}</span>
                  </td>

                  <td
                    className={[
                      "py-3 pr-4 text-small tabular-nums",
                      row.overdue ? "font-medium text-alert" : "text-ink-soft",
                    ].join(" ")}
                  >
                    {row.dueShort ?? <span className="text-ink-faint">Not dated yet</span>}
                  </td>

                  <td className="py-3">
                    <span className="flex items-start gap-1.5">
                      <StatusDot tone={row.tone} className="mt-[0.4rem]" />
                      <span>
                        <span className="text-small font-medium">{row.status}</span>
                        <span className="meta block">{row.meaning}</span>
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {project.milestones.length > 0 ? (
        <div className="mt-8 border-t border-rule pt-4">
          <Label className="mb-2 block">Stages</Label>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {project.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-1.5 text-small">
                <StatusDot
                  tone={
                    m.status === "complete"
                      ? "approved"
                      : m.status === "in_progress"
                        ? "calm"
                        : "neutral"
                  }
                />
                <span className={m.status === "in_progress" ? "font-medium" : "text-ink-soft"}>
                  {m.name}
                </span>
                {m.targetDate ? (
                  <span className="meta tabular-nums">{naturalDate(m.targetDate, now)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
