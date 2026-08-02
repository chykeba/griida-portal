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
}: {
  deliverableId: string;
  slug: string;
  ready: boolean;
}) {
  const [state, action, pending] = useActionState<ItemState, FormData>(sendToClientAction, {
    error: null,
  });

  if (!ready) return null;

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="deliverableId" value={deliverableId} />
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
        {pending ? "Sending…" : "Send to client"}
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
