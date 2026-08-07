"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, RotateCcw, Send, TriangleAlert } from "lucide-react";
import { publishAction, type ItemState } from "@/app/studio/p/[slug]/actions";
import { Meta } from "../primitives";

/**
 * The 2-minute publishing ritual (§7.1).
 *
 * The draft is composed by `composeDraft` — deterministic templating over
 * logged events, not a language model (§6a). It exists to remove the blank
 * page, not to have the last word: the PM edits it and publishes. That is the
 * whole adoption strategy, because a portal that goes stale is worse than none.
 */
export function PublishPanel({
  draft,
  projectName,
  projectId,
  slug,
}: {
  draft: string;
  projectName: string;
  projectId: string;
  slug: string;
}) {
  const [body, setBody] = useState(draft);
  const [state, action, pending] = useActionState<ItemState, FormData>(publishAction, {
    error: null,
  });
  const [submitted, setSubmitted] = useState(false);
  const edited = body !== draft;
  const done = submitted && !pending && !state.error;

  if (done) {
    // A delivery problem is not a failure — the update IS published. But
    // "we emailed them" and "we didn't and nobody said so" must never look
    // the same, which is what the old copy did by claiming email wasn't wired
    // long after it was.
    const problem = state.warning;
    return (
      <div
        className={
          problem
            ? "animate-settle rounded-md border border-caution/40 bg-caution/[0.08] px-3.5 py-3"
            : "animate-settle rounded-md border border-approved/30 bg-approved/[0.05] px-3.5 py-3"
        }
        role="status"
      >
        <p className="flex items-center gap-2 text-small font-medium">
          {problem ? (
            <TriangleAlert className="size-4 shrink-0 text-caution" strokeWidth={2} aria-hidden />
          ) : (
            <Check className="size-4 text-approved" strokeWidth={2.5} aria-hidden />
          )}
          Published to {projectName}
        </p>
        <Meta className="mt-1 block">
          {problem
            ? `It’s live on their portal — but ${problem.charAt(0).toLowerCase()}${problem.slice(1)} They won’t know until they look.`
            : "It’s live on their portal, and we’ve emailed them."}
        </Meta>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={() => setSubmitted(true)}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="slug" value={slug} />
      <label htmlFor="draft" className="mb-1.5 block text-small font-medium">
        This week’s update
      </label>
      <Meta className="mb-2 block">
        Drafted from what actually happened. Edit it so it sounds like you.
      </Meta>

      <textarea
        id="draft"
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        className="w-full resize-y rounded-md border border-rule-interactive bg-paper-raised px-3 py-2.5 text-small leading-relaxed outline-none transition-colors duration-150 focus:border-ink"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className="pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" strokeWidth={1.75} aria-hidden />
          )}
          {pending ? "Publishing…" : "Publish to client"}
        </button>

        {edited ? (
          <button
            type="button"
            onClick={() => setBody(draft)}
            className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
            Reset to draft
          </button>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="animate-rise mt-2 text-small text-alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
