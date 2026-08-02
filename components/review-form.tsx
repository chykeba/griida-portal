"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Check, Loader2, Monitor, Send } from "lucide-react";
import { decide, type ReviewState } from "@/app/p/[slug]/review/[id]/actions";
import { cn } from "@/lib/utils";
import { Notice } from "./primitives";

type Decision = "approve" | "changes";
type Phase = "idle" | "sending" | "done" | "failed";

/**
 * The review action (§3b — the client’s third and last capability).
 *
 * Two rules from §6b are enforced here rather than left to good intentions:
 *  1. High-stakes work has NO approve button on a phone. You can’t judge a
 *     brand system on a 375px screen, and an approval the client walks back is
 *     worse for us than a slower yes. "Request changes" stays available at all
 *     sizes — that direction is never regrettable.
 *  2. The primary action sits in the bottom third, reachable one-handed.
 */
export function ReviewForm({
  deliverableName,
  requiresConsideredReview,
  deliverableId,
  slug,
  nextRoundBillable,
}: {
  deliverableName: string;
  requiresConsideredReview: boolean;
  deliverableId: string;
  slug: string;
  /** Warned up front, before they commit to it (§5). */
  nextRoundBillable: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [savedForDesktop, setSavedForDesktop] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const notesId = useId();

  const [state, formAction, pending] = useActionState<ReviewState, FormData>(decide, {
    done: null,
    error: null,
  });

  const phase: Phase = state.done ? "done" : pending ? "sending" : "idle";
  const decision: Decision | null =
    state.done === "approved" ? "approve" : state.done === "changes" ? "changes" : null;
  const error = state.error;

  if (phase === "done") {
    return (
      <div
        className="animate-settle rounded-lg border border-approved/30 bg-approved/[0.04] px-5 py-6 text-center"
        role="status"
        aria-live="polite"
      >
        <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-approved text-paper-raised">
          <Check className="size-5" strokeWidth={2.5} aria-hidden />
        </span>
        <p className="font-display text-lead font-semibold">
          {decision === "approve" ? "Approved — thank you." : "Sent. Thank you."}
        </p>
        <p className="mx-auto mt-1.5 max-w-[40ch] text-small leading-relaxed text-ink-soft">
          {decision === "approve"
            ? `We’ve logged your sign-off on ${deliverableName}. Nothing more needed from you here.`
            : "Your notes are with the team. We’ll come back to you once we’ve made the changes — usually within a couple of days."}
        </p>
        {state.billable ? (
          <p className="mx-auto mt-3 max-w-[42ch] border-t border-approved/25 pt-3 text-small leading-relaxed text-ink-soft">
            This round goes past the {""}
            <span className="font-medium text-ink">rounds included in your agreement</span>, so
            we’ll price it and send it over before we start. Nothing begins until you’ve said yes.
          </p>
        ) : null}
      </div>
    );
  }

  const sending = pending;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <input type="hidden" name="slug" value={slug} />
      {requiresConsideredReview ? (
        <div className="md:hidden">
          <Notice tone="caution" title="Worth opening this one on a computer">
            This is a big decision and it deserves a proper screen. You can still
            send notes from here — we’ve just held the approve button back until
            you’ve seen it properly.
          </Notice>
        </div>
      ) : null}

      {nextRoundBillable ? (
        <Notice tone="caution" title="The next round of changes is billable">
          Your agreement covers a set number of rounds and you’ve used them. You
          can still ask for changes — we’ll price them and send that over before
          anyone starts, so nothing happens without your say-so.
        </Notice>
      ) : null}

      <div>
        <label htmlFor={notesId} className="mb-1.5 block text-small font-medium">
          Your thoughts
        </label>
        <p className="mb-2 text-small leading-relaxed text-ink-soft">
          One voice is better than five — if others need a say, gather them first
          and send it all together. It saves everyone a round.
        </p>
        <textarea
          id={notesId}
          ref={notesRef}
          value={notes}
          name="notes"
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="What’s working, what isn’t, and anything you’d like changed…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${notesId}-error` : undefined}
          className={cn(
            "w-full resize-y rounded-md border bg-paper-raised px-3.5 py-3",
            "text-base leading-relaxed placeholder:text-ink-faint",
            "transition-colors duration-150 outline-none",
            error ? "border-alert" : "border-rule-interactive focus:border-ink",
          )}
        />
        {error ? (
          <p
            id={`${notesId}-error`}
            role="alert"
            className="animate-rise mt-1.5 text-small text-alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      {/* Primary actions, bottom third, thumb-reachable (§6b) */}
      <div className="flex flex-col gap-2.5">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={sending}
          className={cn(
            "pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-md",
            "bg-ink px-5 text-base font-medium text-paper-raised",
            "disabled:opacity-50",
            requiresConsideredReview ? "hidden md:inline-flex" : "inline-flex",
          )}
        >
          {sending && decision === "approve" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" strokeWidth={2.5} aria-hidden />
          )}
          {sending && decision === "approve" ? "Sending…" : "Approve this"}
        </button>

        {requiresConsideredReview ? (
          <button
            type="button"
            onClick={() => setSavedForDesktop(true)}
            className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-rule-interactive px-5 text-base font-medium md:hidden"
          >
            {savedForDesktop ? (
              <>
                <Check className="size-4" strokeWidth={2.5} aria-hidden />
                We’ll remind you
              </>
            ) : (
              <>
                <Monitor className="size-4" strokeWidth={1.75} aria-hidden />
                Remind me at my desk
              </>
            )}
          </button>
        ) : null}

        <button
          type="submit"
          name="decision"
          value="changes"
          disabled={sending}
          className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-rule-interactive px-5 text-base font-medium disabled:opacity-50"
        >
          {sending && decision === "changes" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" strokeWidth={1.75} aria-hidden />
          )}
          {sending && decision === "changes" ? "Sending…" : "Send my notes"}
        </button>
      </div>

      {savedForDesktop ? (
        <p className="animate-rise text-small text-ink-soft" role="status">
          We’ve emailed you a link that drops you straight back here.
        </p>
      ) : null}
    </form>
  );
}
