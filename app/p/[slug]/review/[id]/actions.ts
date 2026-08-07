"use server";

import { revalidatePath } from "next/cache";
import { requireClientView } from "@/lib/auth/dal";
import { isDemoMode } from "@/lib/auth/dal";
import {
  approve,
  requestChanges,
  reviewableForUser,
  NotCurrent,
} from "@/lib/db/client-writes";

export interface ReviewState {
  done: null | "approved" | "changes";
  error: string | null;
  /** True when the round just requested falls outside the agreement (§5). */
  billable?: boolean;
}

/**
 * The client's decision on a piece of work.
 *
 * The deliverable id arrives from the form, so it is never trusted: every
 * write re-derives it through project_client_roles. Posting someone else's id
 * changes nothing.
 */
export async function decide(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const deliverableId = String(formData.get("deliverableId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  const user = await requireClientView(`/p/${slug}/review/${deliverableId}`);

  if (isDemoMode()) {
    // Nothing to write to. Still exercise the branch so the demo shows the
    // same confirmation the real thing does.
    return { done: decision === "approve" ? "approved" : "changes", error: null };
  }

  if (decision === "changes" && notes.length === 0) {
    return { done: null, error: "Tell us what you'd like changed and we'll get on it. Even a sentence helps." };
  }

  const ctx = await reviewableForUser(user.id, deliverableId);
  if (!ctx) {
    return {
      done: null,
      error:
        "This isn't waiting on you any more — someone may have decided already, or we've moved it on. Refresh to see where it is.",
    };
  }

  try {
    if (decision === "approve") {
      await approve(user.id, ctx, notes || null);
      revalidatePath(`/p/${slug}`);
      return { done: "approved", error: null };
    }
    const { billable } = await requestChanges(user.id, ctx, notes);
    revalidatePath(`/p/${slug}`);
    return { done: "changes", error: null, billable };
  } catch (e) {
    // A state conflict isn't a failure, and telling someone "try again" when
    // the work has already moved on sends them round the same loop.
    if (e instanceof NotCurrent) return { done: null, error: e.message };
    return {
      done: null,
      error: "That didn't send — it's us, not you. Nothing was recorded, so try again in a moment.",
    };
  }
}
