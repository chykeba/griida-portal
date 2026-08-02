"use client";

import { useState } from "react";
import { Check, Loader2, RotateCcw, Send } from "lucide-react";
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
}: {
  draft: string;
  projectName: string;
}) {
  const [body, setBody] = useState(draft);
  const [phase, setPhase] = useState<"idle" | "sending" | "done">("idle");
  const edited = body !== draft;

  async function publish() {
    setPhase("sending");
    // TODO: server action → updates (status: published) + notify (schema §3.9)
    await new Promise((r) => setTimeout(r, 700));
    setPhase("done");
  }

  if (phase === "done") {
    return (
      <div className="animate-settle rounded-md border border-approved/30 bg-approved/[0.05] px-3.5 py-3" role="status">
        <p className="flex items-center gap-2 text-small font-medium">
          <Check className="size-4 text-approved" strokeWidth={2.5} aria-hidden />
          Published to {projectName}
        </p>
        <Meta className="mt-1 block">
          The client has been emailed a link straight to it.
        </Meta>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="draft" className="mb-1.5 block text-small font-medium">
        This week’s update
      </label>
      <Meta className="mb-2 block">
        Drafted from what actually happened. Edit it so it sounds like you.
      </Meta>

      <textarea
        id="draft"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        className="w-full resize-y rounded-md border border-rule-interactive bg-paper-raised px-3 py-2.5 text-small leading-relaxed outline-none transition-colors duration-150 focus:border-ink"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={publish}
          disabled={phase === "sending" || body.trim().length === 0}
          className="pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50"
        >
          {phase === "sending" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" strokeWidth={1.75} aria-hidden />
          )}
          {phase === "sending" ? "Publishing…" : "Publish to client"}
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
    </div>
  );
}
