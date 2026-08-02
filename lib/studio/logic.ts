/**
 * Studio-side rules. The parts that can be silently wrong, so they're pure
 * functions with tests rather than logic smeared through components.
 */
import { count, naturalAge, naturalDate, plural } from "../copy.ts";
import type {
  Blocker,
  Checklist,
  ChecklistItem,
  Person,
  StudioDeliverable,
  StudioProject,
  Studio,
  Task,
} from "./types.ts";

/* -------------------------------------------------------------------------- */
/* Checklists (§5b)                                                           */
/* -------------------------------------------------------------------------- */

/** An item is settled when it can no longer block a publish. */
export function isSettled(item: ChecklistItem): boolean {
  if (item.state === "waived" || item.state === "countersigned") return true;
  return item.state === "checked" && !item.requiresCountersign;
}

export function checklistProgress(checklist: Checklist) {
  const applicable = checklist.items.filter((i) => i.isRequired);
  const settled = applicable.filter(isSettled);
  return {
    done: settled.length,
    total: applicable.length,
    outstanding: applicable.filter((i) => !isSettled(i)),
  };
}

export interface Gate {
  ok: boolean;
  reasons: string[];
  /** True when the only thing standing in the way cannot be overridden. */
  hardBlocked: boolean;
}

/**
 * Can this deliverable be published to the client?
 *
 * The asymmetry is the point (§5b): checklist items may be waived with a
 * reason, but an unverified client link may not. It is the one failure the
 * client experiences directly, so it is the one gate with no override.
 */
export function canPublish(deliverable: StudioDeliverable): Gate {
  const reasons: string[] = [];
  let hardBlocked = false;

  if (deliverable.reviewUrl && deliverable.linkAccessOk !== true) {
    reasons.push("The review link isn’t verified as viewable by this client");
    hardBlocked = true;
  }

  if (deliverable.checklist) {
    const { outstanding } = checklistProgress(deliverable.checklist);
    if (outstanding.length > 0) {
      reasons.push(
        `${count(outstanding.length, "required item")} outstanding on the ${deliverable.checklist.templateName} checklist`,
      );
    }
  }

  return { ok: reasons.length === 0, reasons, hardBlocked };
}

/**
 * Who may tick this item, and who may countersign it.
 *
 * Two rules, both enforced here rather than left to the UI:
 *  - only people assigned to the deliverable attest to it (the user's core
 *    requirement: the people who did the work check it);
 *  - a countersign must come from someone other than the person who checked.
 *    Separation of duties that the same human can satisfy is theatre.
 */
export function canTick(deliverable: StudioDeliverable, person: Person): boolean {
  return deliverable.ownerId === person.id || person.role !== "member";
}

export function canCountersign(item: ChecklistItem, person: Person): boolean {
  if (!item.requiresCountersign || item.state !== "checked") return false;
  if (item.checkedById === person.id) return false;
  return person.role === "lead" || person.role === "admin_pm" || person.role === "super_admin";
}

/* -------------------------------------------------------------------------- */
/* Blockers & aging (§5a)                                                     */
/* -------------------------------------------------------------------------- */

export function openBlockers(task: Task): Blocker[] {
  return task.blockers.filter((b) => b.resolvedAt === null);
}

/** Every task this person is holding up for someone else. */
export function blockingOthers(studio: Studio, personId: string) {
  const out: { task: Task; project: StudioProject; blocker: Blocker }[] = [];
  for (const project of studio.projects) {
    for (const task of project.tasks) {
      for (const blocker of openBlockers(task)) {
        if (blocker.kind === "person" && blocker.blockedByPersonId === personId) {
          out.push({ task, project, blocker });
        }
      }
    }
  }
  // Oldest first — the longest-standing block is the one costing most.
  return out.sort((a, b) => a.blocker.createdAt.localeCompare(b.blocker.createdAt));
}

export function myWork(studio: Studio, personId: string) {
  const out: { task: Task; project: StudioProject }[] = [];
  for (const project of studio.projects) {
    for (const task of project.tasks) {
      if (task.responsibleId === personId && task.status !== "done") {
        out.push({ task, project });
      }
    }
  }
  return out.sort((a, b) => {
    // Overdue first, then soonest due, then undated.
    const ad = a.task.dueOn ?? "9999";
    const bd = b.task.dueOn ?? "9999";
    return ad.localeCompare(bd);
  });
}

/** Plain-English description of what a task is waiting on. */
export function blockerSentence(
  blocker: Blocker,
  people: Person[],
  project: StudioProject,
): string {
  const age = naturalAge(blocker.createdAt);
  if (blocker.kind === "client") {
    const action = project.clientActions.find((a) => a.id === blocker.clientActionId);
    return `Waiting on the client — ${action?.title ?? "an outstanding item"} · ${age}`;
  }
  if (blocker.kind === "person") {
    const who = people.find((p) => p.id === blocker.blockedByPersonId);
    return `Waiting on ${who?.name ?? "someone"} — ${blocker.note} · ${age}`;
  }
  return `${blocker.note} · ${age}`;
}

/* -------------------------------------------------------------------------- */
/* The drafted client update (§5a, §6a)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Composes a first draft of the client update from what actually happened.
 *
 * Deterministic templating over real events — no language model. It cannot
 * invent anything about a client's project, it costs nothing, and it runs
 * instantly. The PM edits the prose and publishes; the draft exists to remove
 * the blank page, not to have the last word.
 */
export function composeDraft(project: StudioProject): string {
  const lines: string[] = [];

  const ready = project.deliverables.filter((d) => d.status === "in_review");
  const working = project.deliverables.filter((d) => d.status === "changes_requested");
  const approved = project.deliverables.filter(
    (d) => d.status === "approved" || d.status === "delivered",
  );
  const doneTasks = project.tasks.filter((t) => t.status === "done");
  const waitingOnClient = project.clientActions;

  if (ready.length > 0) {
    const names = ready.map((d) => d.name.toLowerCase());
    lines.push(
      `${names.length === 1 ? "There’s something" : "There are things"} ready for you to look at: ${listOf(names)}.`,
    );
  }

  if (working.length > 0) {
    lines.push(
      `Your notes on ${listOf(working.map((d) => d.name.toLowerCase()))} are in and we’re working through them.`,
    );
  }

  if (approved.length > 0) {
    lines.push(`${listOf(approved.map((d) => d.name))} ${approved.length === 1 ? "is" : "are"} signed off — thank you.`);
  }

  if (doneTasks.length > 0) {
    lines.push(`We finished ${count(doneTasks.length, "piece")} of work on our side this week.`);
  }

  if (waitingOnClient.length > 0) {
    const oldest = [...waitingOnClient].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    lines.push(
      `We’re still waiting on ${count(waitingOnClient.length, "thing")} from you — the oldest is “${oldest.title}”, asked ${naturalAge(oldest.createdAt)}.`,
    );
  }

  if (project.targetEndOn) {
    lines.push(`We’re still aiming to finish on ${naturalDate(project.targetEndOn)}.`);
  }

  if (lines.length === 0) {
    return "Nothing has moved since the last update. Worth saying so plainly rather than going quiet.";
  }

  return lines.join(" ");
}

function listOf(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Tasks not yet done and falling due inside the window. */
export function dueWithin(project: StudioProject, days: number): Task[] {
  const cutoff = Date.now() + days * 86_400_000;
  return project.tasks.filter(
    (t) => t.status !== "done" && t.dueOn && new Date(t.dueOn).getTime() < cutoff,
  );
}

/** How stale is the client's view of this project? */
export function publishFreshness(project: StudioProject): {
  label: string;
  stale: boolean;
} {
  if (!project.lastPublishedAt) {
    return { label: "Never published", stale: true };
  }
  const days = Math.floor((Date.now() - new Date(project.lastPublishedAt).getTime()) / 86_400_000);
  return {
    label: `Published ${naturalAge(project.lastPublishedAt)}`,
    // A week without a word is where trust starts leaking (§6).
    stale: days >= 7,
  };
}

export function personName(people: Person[], id: string | null): string {
  if (!id) return "Unassigned";
  return people.find((p) => p.id === id)?.name ?? "Unknown";
}

export function taskStatusLabel(status: Task["status"]): string {
  return status === "todo"
    ? "To do"
    : status === "in_progress"
      ? "In progress"
      : status === "blocked"
        ? "Blocked"
        : "Done";
}

export { plural };
