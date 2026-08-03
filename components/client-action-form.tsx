"use client";

import { useActionState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { respondAction, type RespondState } from "@/app/p/[slug]/actions";
import { Meta } from "./primitives";

/**
 * The client answers a request.
 *
 * Asks for a link rather than a file, because the portal stores nothing (§3c) —
 * worded so the constraint reads as a choice, not a missing upload button.
 * Mobile-first: one field, one button, both thumb-reachable.
 */
export function ClientActionForm({ actionId, slug }: { actionId: string; slug: string }) {
  const [state, action, pending] = useActionState<RespondState, FormData>(respondAction, {
    error: null,
  });

  if (state.done) {
    return (
      <p
        role="status"
        className="animate-settle mt-2.5 flex items-center gap-1.5 text-small text-approved"
      >
        <Check className="size-4" strokeWidth={2.5} aria-hidden />
        Got it — thank you. Nothing more needed here.
      </p>
    );
  }

  return (
    <form action={action} className="mt-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="actionId" value={actionId} />
      <input type="hidden" name="slug" value={slug} />

      <input
        name="url"
        type="url"
        inputMode="url"
        placeholder="Paste a link — Drive, Dropbox, anywhere"
        className="min-h-11 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-base outline-none focus:border-ink"
      />
      <textarea
        name="text"
        rows={2}
        placeholder="Or just tell us here"
        className="w-full resize-y rounded-md border border-rule bg-paper-raised px-3 py-2 text-base outline-none focus:border-ink"
      />

      <button
        type="submit"
        disabled={pending}
        className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 font-medium text-paper-raised disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Send className="size-4" strokeWidth={1.75} aria-hidden />
        )}
        {pending ? "Sending…" : "Send this"}
      </button>

      {state.error ? (
        <p role="alert" className="animate-rise text-small text-alert">
          {state.error}
        </p>
      ) : (
        <Meta className="block">
          No need to tidy anything up — a link to wherever it already lives is perfect.
        </Meta>
      )}
    </form>
  );
}
