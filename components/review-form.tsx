"use client";

import { useState, useRef, useId } from "react";
import { Check, Loader2, Monitor, Send } from "lucide-react";
import { errors } from "@/lib/copy";
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
}: {
  deliverableName: string;
  requiresConsideredReview: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedForDesktop, setSavedForDesktop] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const notesId = useId();

  async function submit(next: Decision) {
    if (next === "changes" && notes.trim().length === 0) {
      setError(errors.emptyFeedback.body);
      notesRef.current?.focus();
      return;
    }
    setError(null);
    setDecision(next);
    setPhase("sending");

    // TODO: server action → reviews + feedback_comments (schema §3.9)
    await new Promise((r) => setTimeout(r, 700));
    setPhase("done");
  }

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
      </div>
    );
  }

  const sending = phase === "sending";

  return (
    <div className="space-y-4">
      {requiresConsideredReview ? (
        <div className="md:hidden">
          <Notice tone="caution" title="Worth opening this one on a computer">
            This is a big decision and it deserves a proper screen. You can still
            send notes from here — we’ve just held the approve button back until
            you’ve seen it properly.
          </Notice>
        </div>
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
          onChange={(e) => {
            setNotes(e.target.value);
            if (error) setError(null);
          }}
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
          type="button"
          onClick={() => submit("approve")}
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
          type="button"
          onClick={() => submit("changes")}
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
    </div>
  );
}
