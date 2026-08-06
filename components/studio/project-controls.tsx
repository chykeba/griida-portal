"use client";

import { useActionState, useState } from "react";
import { CircleCheck, Loader2, Plus, RotateCcw, TriangleAlert, UserPlus, X } from "lucide-react";
import {
  addClientAction,
  askClientAction,
  closeProjectAction,
  removeClientAction,
  resolveActionAction,
  setHealthAction,
  type ItemState,
} from "@/app/studio/p/[slug]/actions";
import { Badge, Meta } from "../primitives";

const idle: ItemState = { error: null };

function Err({ state }: { state: ItemState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="animate-rise mt-2 flex items-start gap-1.5 text-small text-alert">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {state.error}
    </p>
  );
}

/* ========================================================================== */

/**
 * Health, and the sentence underneath it.
 *
 * The note is the actual product — "at risk" alone tells a client to worry
 * without telling them anything (§6), so anything other than on-track requires
 * one, enforced server-side.
 */
export function HealthControl({
  projectId,
  slug,
  health,
  note,
}: {
  projectId: string;
  slug: string;
  health: string;
  note: string | null;
}) {
  const [state, action, pending] = useActionState(setHealthAction, idle);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable mt-2 text-small text-ink-faint underline decoration-rule-strong underline-offset-4 hover:text-ink"
      >
        Update how it’s going
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 max-w-lg space-y-2 border-l-2 border-rule pl-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="slug" value={slug} />
      <select
        name="health"
        defaultValue={health}
        className="min-h-10 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink"
      >
        <option value="on_track">On track</option>
        <option value="at_risk">Needs attention</option>
        <option value="blocked">Blocked</option>
      </select>
      <textarea
        name="note"
        defaultValue={note ?? ""}
        rows={2}
        placeholder="Why, in a sentence. They read this before anything else."
        className="w-full resize-y rounded-md border border-rule-interactive bg-paper-raised px-3 py-2 text-small outline-none focus:border-ink"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="pressable inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="pressable min-h-10 rounded-md border border-rule px-3 text-small">
          Cancel
        </button>
      </div>
      <Err state={state} />
    </form>
  );
}

/* ========================================================================== */

export interface ProjectClientView {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  hasSignedIn: boolean;
}

/** Who on the client side can see this project. Per project, not global (§3). */
export function ClientAccess({
  projectId,
  slug,
  clients,
  canManage,
}: {
  projectId: string;
  slug: string;
  clients: ProjectClientView[];
  /** PM and super admin. Hiding the control isn’t the check — the action re-checks. */
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(addClientAction, idle);
  const [open, setOpen] = useState(canManage && clients.length === 0);

  return (
    <div>
      {clients.length === 0 ? (
        <p className="mb-2 text-small text-caution">
          Nobody on the client side can see this yet — it’s invisible to them
          until you add someone.
        </p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {clients.map((c) => (
            <li key={c.userId} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="text-small font-medium">{c.fullName}</span>
                <Meta className="block">
                  {c.email} · {c.role}
                  {c.hasSignedIn ? "" : " · hasn’t signed in yet"}
                </Meta>
              </span>
              {canManage ? (
              <form action={removeClientAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="userId" value={c.userId} />
                <button type="submit" aria-label={`Remove ${c.fullName}`}
                  className="pressable flex size-9 items-center justify-center rounded-md text-ink-faint hover:text-alert">
                  <X className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
              </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!canManage ? (
        <Meta className="block">
          Only a project manager or super admin can change who sees this.
        </Meta>
      ) : open ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="slug" value={slug} />
          <input name="name" required placeholder="Their name"
            className="min-h-10 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink" />
          <input name="email" type="email" required placeholder="Their email"
            className="min-h-10 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink" />
          <select name="role" defaultValue="reviewer"
            className="min-h-10 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink">
            <option value="owner">Owner — the main contact</option>
            <option value="reviewer">Reviewer — can approve work</option>
            <option value="viewer">Viewer — can look, not decide</option>
          </select>
          <button type="submit" disabled={pending}
            className="pressable inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />}
            Give them access
          </button>
          <Meta className="block">
            They sign in with a link from the login page — no password, nothing to set up.
          </Meta>
          <Err state={state} />
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small font-medium">
          <Plus className="size-3.5" strokeWidth={2} aria-hidden />
          Add someone
        </button>
      )}
    </div>
  );
}

/* ========================================================================== */

export interface StudioActionView {
  id: string;
  title: string;
  status: string;
  responseUrl: string | null;
  responseText: string | null;
  age: string;
}

/** Asking the client for something, and closing the loop when it comes back. */
export function ClientRequests({
  projectId,
  slug,
  actions,
}: {
  projectId: string;
  slug: string;
  actions: StudioActionView[];
}) {
  const [state, action, pending] = useActionState(askClientAction, idle);
  const [open, setOpen] = useState(false);

  return (
    <div>
      {actions.length > 0 ? (
        <ul className="mb-3 space-y-2.5">
          {actions.map((a) => (
            <li key={a.id} className="border-l-2 border-rule pl-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-small font-medium">{a.title}</p>
                {a.status === "submitted" ? (
                  <Badge tone="approved">Answered</Badge>
                ) : (
                  <Badge tone="caution">Waiting</Badge>
                )}
              </div>
              <Meta className="block">asked {a.age}</Meta>

              {a.status === "submitted" ? (
                <div className="mt-1.5">
                  {a.responseUrl ? (
                    <a href={a.responseUrl} target="_blank" rel="noopener noreferrer"
                      className="text-small underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
                      What they sent
                    </a>
                  ) : null}
                  {a.responseText ? (
                    <p className="text-small text-ink-soft">“{a.responseText}”</p>
                  ) : null}
                  <div className="mt-1.5 flex gap-2">
                    <form action={resolveActionAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="actionId" value={a.id} />
                      <button type="submit"
                        className="pressable min-h-9 rounded-md border border-rule-interactive px-3 text-small font-medium">
                        That’s what we needed
                      </button>
                    </form>
                    <form action={resolveActionAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="actionId" value={a.id} />
                      <input type="hidden" name="op" value="reopen" />
                      <button type="submit"
                        className="pressable min-h-9 rounded-md border border-rule px-3 text-small text-ink-soft">
                        Ask again
                      </button>
                    </form>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <form action={action} className="space-y-2 border-t border-rule pt-3">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="slug" value={slug} />
          <input name="title" required placeholder="What do you need from them?"
            className="min-h-10 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink" />
          <textarea name="description" rows={2} placeholder="Any detail that saves a round trip"
            className="w-full resize-y rounded-md border border-rule bg-paper-raised px-3 py-2 text-small outline-none focus:border-ink" />
          <div className="flex flex-wrap gap-2">
            <input name="blocksNote" placeholder="What it's holding up, e.g. the About page"
              className="min-h-10 min-w-0 flex-1 rounded-md border border-rule bg-paper-raised px-3 text-small outline-none focus:border-ink" />
            <input name="dueOn" type="date"
              className="min-h-10 rounded-md border border-rule bg-paper-raised px-3 text-small outline-none focus:border-ink" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="pressable inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Ask them
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="pressable min-h-10 rounded-md border border-rule px-3 text-small">Cancel</button>
          </div>
          <Meta className="block">
            It appears at the top of their portal, and the reason is shown without blame.
          </Meta>
          <Err state={state} />
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small font-medium">
          <Plus className="size-3.5" strokeWidth={2} aria-hidden />
          Ask for something
        </button>
      )}
    </div>
  );
}

/* ========================================================================== */

export interface CloseoutBlockerView {
  kind: string;
  summary: string;
  items: string[];
}

/**
 * Finishing a project — the moment the SOP was built for.
 *
 * It shows what's outstanding and then lets you close anyway. That's
 * deliberate: a gate that can't be passed gets routed around, and then the
 * truth about a project lives somewhere this app can't see. What it insists on
 * instead is a sentence, which costs ten seconds and is the only thing that
 * makes a decision legible six months later.
 */
export function CloseoutControl({
  projectId,
  slug,
  status,
  blockers,
  canClose,
}: {
  projectId: string;
  slug: string;
  status: string;
  blockers: CloseoutBlockerView[];
  canClose: boolean;
}) {
  const [state, action, pending] = useActionState(closeProjectAction, idle);
  const [open, setOpen] = useState(false);
  const clean = blockers.length === 0;
  const closed = status === "done";

  if (closed) {
    return (
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-small text-approved">
          <CircleCheck className="size-4" strokeWidth={2} aria-hidden />
          Closed. The client can still see everything.
        </p>
        {canClose ? (
          <form action={action} className="space-y-2">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="op" value="reopen" />
            <input
              name="note"
              required
              placeholder="Why is it reopening?"
              className="min-h-10 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink"
            />
            <Meta className="block">The client sees this reopen on their timeline.</Meta>
            <button
              type="submit"
              disabled={pending}
              className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small font-medium disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden />
              )}
              Reopen it
            </button>
            <Err state={state} />
          </form>
        ) : null}
      </div>
    );
  }

  if (!canClose) {
    return (
      <Meta className="block">
        {clean
          ? "Everything’s settled. A project manager can close this."
          : `${blockers.length} thing${blockers.length === 1 ? "" : "s"} still outstanding.`}
      </Meta>
    );
  }

  return (
    <div>
      {clean ? (
        <p className="mb-3 flex items-start gap-1.5 text-small text-approved">
          <CircleCheck className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
          Everything’s approved, ticked and settled. Ready to close.
        </p>
      ) : (
        <div className="mb-3">
          <p className="mb-2 text-small text-caution">
            Not everything’s finished. You can still close it — you’ll just be asked why.
          </p>
          <ul className="space-y-2">
            {blockers.map((b) => (
              <li key={b.kind}>
                <p className="text-small font-medium">{b.summary}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {b.items.slice(0, 4).map((item) => (
                    <li key={item} className="meta pl-3 -indent-2 before:content-['·_']">
                      {item}
                    </li>
                  ))}
                  {b.items.length > 4 ? (
                    <li className="meta pl-1">and {b.items.length - 4} more</li>
                  ) : null}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open ? (
        <form action={action} className="space-y-2 border-t border-rule pt-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="projectId" value={projectId} />
          <textarea
            name="note"
            rows={2}
            required={!clean}
            placeholder={clean ? "Anything worth recording? (optional)" : "Why close it with these outstanding?"}
            className="w-full rounded-md border border-rule-interactive bg-paper-raised px-3 py-2 text-small leading-relaxed outline-none focus:border-ink"
          />
          <Meta className="block">
            {clean
              ? "Goes on the record with your name and today’s date."
              : "Recorded with your name, alongside a copy of what was outstanding."}
          </Meta>
          <button
            type="submit"
            disabled={pending}
            className="pressable inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CircleCheck className="size-4" strokeWidth={1.75} aria-hidden />
            )}
            Mark it done
          </button>
          <Err state={state} />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small font-medium"
        >
          <CircleCheck className="size-3.5" strokeWidth={2} aria-hidden />
          Close this project
        </button>
      )}
    </div>
  );
}
