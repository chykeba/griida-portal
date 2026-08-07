/**
 * THE VOICE LAYER
 *
 * Every string a client reads is generated here, so the product speaks with
 * one voice instead of whatever each component author felt like that day.
 *
 * Rules (Client-Portal-Strategy.md §6, §6a):
 *  - Write how a person talks. "Due on the 17th of this month", never "Due 17/03".
 *  - Say the thing, then say why. No status without a reason.
 *  - Never a dead end: every state ends with what happens next, or an explicit
 *    "nothing needed from you".
 *  - Deterministic. No language model anywhere near this file.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const;

/** 1 → "1st", 2 → "2nd", 17 → "17th", 23 → "23rd" */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** "a, b and c" — Oxford comma omitted deliberately; it reads more spoken. */
export function listSentence(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function plural(n: number, one: string, many?: string): string {
  return n === 1 ? one : (many ?? `${one}s`);
}

/** "1 thing" / "3 things" — the number and its noun always travel together. */
export function count(n: number, one: string, many?: string): string {
  return `${n} ${plural(n, one, many)}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days between two dates. Timezone-safe: compares dates, not ms. */
export function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/* -------------------------------------------------------------------------- */
/* Dates, the way people actually say them                                     */
/* -------------------------------------------------------------------------- */

/**
 * The core date phrase. Chooses the way a person would naturally refer to a
 * day, given how far away it is:
 *
 *   today · tomorrow · this Friday · the 17th of this month ·
 *   the 3rd of next month · 17 March · 17 March 2026
 *
 * Returns a bare phrase with no leading capital, so it can be dropped into a
 * sentence. Use `sentence()` to capitalise when it starts one.
 */
export function naturalDate(value: Date | string, now: Date = new Date()): string {
  const date = toDate(value);
  const delta = daysBetween(now, date);

  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "yesterday";

  // Within the coming week, people use the day name.
  if (delta > 1 && delta <= 6) return `this ${DAYS[date.getDay()]}`;
  if (delta < -1 && delta >= -6) return `last ${DAYS[date.getDay()]}`;

  const sameMonth =
    date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (sameMonth) return `the ${ordinal(date.getDate())} of this month`;

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const isNextMonth =
    date.getMonth() === nextMonth.getMonth() &&
    date.getFullYear() === nextMonth.getFullYear();
  if (isNextMonth) return `the ${ordinal(date.getDate())} of next month`;

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const isLastMonth =
    date.getMonth() === lastMonth.getMonth() &&
    date.getFullYear() === lastMonth.getFullYear();
  if (isLastMonth) return `the ${ordinal(date.getDate())} of last month`;

  const sameYear = date.getFullYear() === now.getFullYear();
  return sameYear
    ? `${date.getDate()} ${MONTHS[date.getMonth()]}`
    : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * How long ago something happened. Used for the aging signals in §5a —
 * "a status can be stale and still look fine; an age can’t lie."
 */
export function naturalAge(value: Date | string, now: Date = new Date()): string {
  const date = toDate(value);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${count(minutes, "minute")} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24 && daysBetween(date, now) === 0) return `${count(hours, "hour")} ago`;

  const days = daysBetween(date, now);
  if (days === 1) return "yesterday";
  if (days < 7) return `${count(days, "day")} ago`;
  if (days < 14) return "last week";
  if (days < 31) return `${count(Math.floor(days / 7), "week")} ago`;
  if (days < 60) return "last month";
  if (days < 365) return `${count(Math.floor(days / 30), "month")} ago`;
  return `${count(Math.floor(days / 365), "year")} ago`;
}

/** Capitalises the first letter so a phrase can open a sentence. */
export function sentence(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/* -------------------------------------------------------------------------- */
/* Deadlines                                                                   */
/* -------------------------------------------------------------------------- */

export type Urgency = "calm" | "soon" | "today" | "overdue";

export interface Deadline {
  /** Full sentence, ready to render. */
  sentence: string;
  /** Short form for tight spaces (cards, list rows). */
  short: string;
  urgency: Urgency;
  isOverdue: boolean;
}

/**
 * Turns a due date into something a person would say out loud.
 *
 *   "Due tomorrow."
 *   "Due on the 17th of this month."
 *   "This was due on the 12th — 3 days ago."
 */
export function deadline(
  value: Date | string,
  now: Date = new Date(),
  noun = "This",
): Deadline {
  const date = toDate(value);
  const delta = daysBetween(now, date);
  const phrase = naturalDate(date, now);

  if (delta < 0) {
    const late = Math.abs(delta);
    return {
      sentence:
        late === 1
          ? `${noun} was due yesterday.`
          : `${noun} was due ${phrase} — ${count(late, "day")} ago.`,
      short: late === 1 ? "1 day late" : `${late} days late`,
      urgency: "overdue",
      isOverdue: true,
    };
  }

  if (delta === 0) {
    return {
      sentence: `${noun} is due today.`,
      short: "Due today",
      urgency: "today",
      isOverdue: false,
    };
  }

  // "Due the 12th of next month" is not how anyone speaks; "the"-phrases need
  // the preposition, day names don’t. ("Due on this Tuesday" is equally wrong.)
  const shortPhrase =
    delta === 1 ? "tomorrow" : phrase.startsWith("the ") ? `on ${phrase}` : phrase;

  // People contract in speech. "It is due" reads like a form letter.
  const subject = noun === "It" ? "It’s" : `${noun} is`;

  return {
    sentence: `${subject} due ${delta === 1 ? "tomorrow" : `on ${phrase}`}.`,
    short: `Due ${shortPhrase}`,
    urgency: delta <= 3 ? "soon" : "calm",
    isOverdue: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Project health — the sentence at the top of every screen (§3, §6)           */
/* -------------------------------------------------------------------------- */

export type Health = "on_track" | "at_risk" | "blocked";

export interface HealthCopy {
  /** The big editorial line. */
  headline: string;
  /** Plain-English why, written by the PM. Never auto-invented. */
  detail?: string;
  /** Screen-reader and badge text. */
  label: string;
  tone: "calm" | "caution" | "alert";
}

export function healthCopy(
  health: Health,
  note?: string | null,
  dueDate?: Date | string | null,
  now: Date = new Date(),
): HealthCopy {
  const due = dueDate ? deadline(dueDate, now, "It") : null;

  const base: Record<Health, Omit<HealthCopy, "detail">> = {
    on_track: {
      headline: "This project is on track.",
      label: "On track",
      tone: "calm",
    },
    at_risk: {
      headline: "This one needs a little attention.",
      label: "Needs attention",
      tone: "caution",
    },
    blocked: {
      headline: "We’re stuck until something comes back.",
      label: "Blocked",
      tone: "alert",
    },
  };

  // The date always rides along with the status, because "on track" without a
  // date is exactly the vague reassurance §6 warns against.
  const detail = [note?.trim(), due?.sentence].filter(Boolean).join(" ");

  return { ...base[health], detail: detail || undefined };
}

/** Roll-up across several projects, for the workspace front door (§3). */
export function rollUpHealth(
  healths: Health[],
  waitingOnClient: number,
): { headline: string; tone: "calm" | "caution" | "alert" } {
  if (waitingOnClient > 0) {
    return {
      headline:
        waitingOnClient === 1
          ? "One thing needs you."
          : `${waitingOnClient} things need you.`,
      tone: "caution",
    };
  }
  if (healths.includes("blocked")) {
    return { headline: "One project is held up.", tone: "alert" };
  }
  if (healths.includes("at_risk")) {
    return { headline: "One project needs attention.", tone: "caution" };
  }
  if (healths.length === 0) {
    return { headline: "Nothing running right now.", tone: "calm" };
  }
  return {
    headline:
      healths.length === 1
        ? "Everything’s on track."
        : "All your projects are on track.",
    tone: "calm",
  };
}

/* -------------------------------------------------------------------------- */
/* Deliverables & review                                                       */
/* -------------------------------------------------------------------------- */

export type DeliverableStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "delivered";

/**
 * Status told from the client’s point of view — what it means for *them*,
 * not what it means in our workflow. §6: translate, don’t expose.
 */
export function deliverableCopy(
  status: DeliverableStatus,
  /**
   * Scheduled but unstarted work reads differently from work in flight. Twenty
   * pages all claiming "we're still working on this" on day one is not what
   * the schedule is for — and it's the state most rows are in for most of a
   * project.
   */
  scheduled = false,
): {
  label: string;
  meaning: string;
  tone: "neutral" | "caution" | "approved";
  needsYou: boolean;
} {
  switch (status) {
    case "draft":
      return scheduled
        ? {
            label: "Not started",
            meaning: "Planned. We’ll let you know when there’s something to see.",
            tone: "neutral",
            needsYou: false,
          }
        : {
            label: "In progress",
            meaning: "We’re still working on this one.",
            tone: "neutral",
            needsYou: false,
          };
    case "in_review":
      return {
        label: "Ready for you",
        meaning: "Have a look and let us know what you think.",
        tone: "caution",
        needsYou: true,
      };
    case "changes_requested":
      return {
        label: "We’re on it",
        meaning: "Your notes are in. We’re making the changes.",
        tone: "neutral",
        needsYou: false,
      };
    case "approved":
      return {
        label: "Approved",
        meaning: "You signed this off. Nothing more needed.",
        tone: "approved",
        needsYou: false,
      };
    case "delivered":
      return {
        label: "Delivered",
        meaning: "This one’s finished and yours.",
        tone: "approved",
        needsYou: false,
      };
  }
}

/** The visible revision counter — margin protection, stated plainly (§5). */
export function roundsCopy(current: number, included: number): {
  label: string;
  note: string;
  isBeyondScope: boolean;
} {
  if (current > included) {
    return {
      label: `Round ${current}`,
      note: `Your agreement covers ${count(included, "round")} of changes. This one’s beyond that, so we’ll confirm the cost with you before starting.`,
      isBeyondScope: true,
    };
  }
  const left = included - current;
  return {
    label: `Round ${current} of ${included}`,
    note:
      left === 0
        ? "This is the last round included in your agreement."
        : `${sentence(count(left, "more round"))} included after this one.`,
    isBeyondScope: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Things the client owes us — the highest-value module (§5A)                   */
/* -------------------------------------------------------------------------- */

export function waitingOnYouCopy(items: number): {
  headline: string;
  sub: string;
} {
  if (items === 0) {
    return {
      headline: "You’re all clear.",
      sub: "Nothing needed from you right now — we’ll shout if that changes.",
    };
  }
  return {
    headline: items === 1 ? "One thing needs you" : `${items} things need you`,
    sub: "Each of these is holding something up on our side.",
  };
}

/** Why an outstanding item matters, said without blame. */
export function blocksCopy(blocks?: string | null): string | null {
  if (!blocks) return null;
  return `Until this lands, we can’t start ${blocks}.`;
}

/* -------------------------------------------------------------------------- */
/* Empty states — teach, don’t apologise (§6)                                  */
/* -------------------------------------------------------------------------- */

export const empty = {
  updates: {
    headline: "No updates yet",
    body: "When we finish something or need you to look at a piece of work, it’ll show up here. We usually post once a week.",
  },
  deliverables: {
    headline: "Nothing to review yet",
    body: "As soon as there’s work ready for your eyes, you’ll find it here — and we’ll email you.",
  },
  waiting: {
    headline: "You’re all clear",
    body: "Nothing needed from you right now. We’ll let you know the moment that changes.",
  },
  projects: {
    headline: "No projects here yet",
    body: "Once we kick off, your project will appear here with everything in one place.",
  },
  documents: {
    headline: "No documents yet",
    body: "Contracts, proposals and guidelines will live here so you’re never digging through email for them.",
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Errors — cause plus a way out. Never "Something went wrong."                 */
/* -------------------------------------------------------------------------- */

export interface FriendlyError {
  headline: string;
  body: string;
  action?: string;
}

export const errors: Record<string, FriendlyError> = {
  offline: {
    headline: "You’re offline",
    body: "This page needs a connection to load the latest. Everything you’ve already opened still works.",
    action: "Try again",
  },
  loadFailed: {
    headline: "That didn’t load",
    body: "The connection dropped on the way. Nothing’s broken and nothing was lost.",
    action: "Reload",
  },
  linkBroken: {
    headline: "This link isn’t opening",
    body: "The file may have moved or the sharing settings may have changed. We’ve been told about it and we’re fixing it — you don’t need to do anything.",
  },
  linkNoAccess: {
    headline: "You don’t have access to this yet",
    body: "The link works, but it hasn’t been shared with your email address. We’ve been notified and will sort it out.",
  },
  approveFailed: {
    headline: "Your approval didn’t go through",
    body: "Nothing was recorded, so nothing’s changed. Your notes are still here — try sending again.",
    action: "Try again",
  },
  sessionExpired: {
    headline: "Your sign-in link has expired",
    body: "Links last 24 hours for security. Pop your email in and we’ll send a fresh one.",
    action: "Send a new link",
  },
  notFound: {
    headline: "We can’t find that page",
    body: "It may have been moved, or the link might be incomplete. Your projects are all still here.",
    action: "Back to your projects",
  },
  noAccess: {
    headline: "This isn’t yours to see",
    body: "You’re signed in, but this project isn’t shared with your account. If that seems wrong, tell us and we’ll fix the access.",
    action: "Back to your projects",
  },
  emptyFeedback: {
    headline: "Add a note first",
    body: "Tell us what you’d like changed and we’ll get straight on it. Even a sentence helps.",
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Recency — a stale portal destroys trust faster than no portal (§6)          */
/* -------------------------------------------------------------------------- */

export function freshness(lastUpdated: Date | string, now: Date = new Date()): string {
  return `Last updated ${naturalAge(lastUpdated, now)}`;
}
