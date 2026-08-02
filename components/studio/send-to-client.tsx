"use client";

import { useActionState } from "react";
import { Loader2, Send, TriangleAlert } from "lucide-react";
import { sendToClientAction, type ItemState } from "@/app/studio/p/[slug]/actions";

/**
 * The moment work crosses to the client.
 *
 * Enabled only when the gate is open, but the gate is re-derived server-side
 * anyway — a stale page must not be able to push unfinished work at a client.
 */
export function SendToClient({
  deliverableId,
  slug,
  ready,
  outstanding = 0,
}: {
  deliverableId: string;
  slug: string;
  /** False only when the link is missing or unverified — the one hard block. */
  ready: boolean;
  /** Required checks not yet settled. Sending anyway needs a reason. */
  outstanding?: number;
}) {
  const [state, action, pending] = useActionState<ItemState, FormData>(sendToClientAction, {
    error: null,
  });

  if (!ready) return null;

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="deliverableId" value={deliverableId} />

      {outstanding > 0 ? (
        <div className="mb-2">
          <p className="mb-1.5 text-small text-ink-soft">
            {outstanding === 1 ? "One check isn’t" : `${outstanding} checks aren’t`} settled.
            You can still send it — say why and it goes in the record.
          </p>
          <input
            name="reason"
            required
            placeholder="Why this is going out early"
            className="min-h-10 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink"
          />
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="pressable inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Send className="size-4" strokeWidth={1.75} aria-hidden />
        )}
        {pending ? "Sending…" : outstanding > 0 ? "Send anyway" : "Send to client"}
      </button>
      {state.error ? (
        <p role="alert" className="animate-rise mt-2 flex items-start gap-1.5 text-small text-alert">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
