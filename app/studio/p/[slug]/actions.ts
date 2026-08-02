"use server";

import { revalidatePath } from "next/cache";
import { requireStudio } from "@/lib/auth/dal";
import { isDemoMode } from "@/lib/auth/dal";
import { getCurrentPerson } from "@/lib/studio/data";
import { can } from "@/lib/studio/permissions";
import {
  countersign,
  itemContext,
  publishUpdate,
  sendToClient,
  tick,
  untick,
  waive,
} from "@/lib/db/checklist-writes";
import { notifyReviewReady, notifyUpdatePublished } from "@/lib/db/notify";

export interface ItemState {
  error: string | null;
}

const DEMO_NOTE =
  "This is the demo — there’s no database behind it, so nothing sticks. Connect D1 to make these real.";

/**
 * Checklist mutations.
 *
 * Permission is re-derived here from the session and the item, never taken
 * from the form. The UI hides what you can't do; this refuses it.
 */
export async function checklistAction(
  _prev: ItemState,
  formData: FormData,
): Promise<ItemState> {
  const slug = String(formData.get("slug") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const op = String(formData.get("op") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const url = String(formData.get("url") ?? "");
  const text = String(formData.get("text") ?? "");

  await requireStudio(`/studio/p/${slug}`);
  if (isDemoMode()) return { error: DEMO_NOTE };

  const me = await getCurrentPerson();
  const ctx = await itemContext(itemId);
  if (!ctx) return { error: "That item has gone — someone may have changed the checklist." };

  try {
    switch (op) {
      case "tick":
        await tick(ctx, me.id, me.role, { url, text });
        break;
      case "untick":
        await untick(ctx, me.id, me.role, reason);
        break;
      case "countersign":
        await countersign(ctx, me.id, me.role);
        break;
      case "waive":
        if (!can(me, "waive_checklist_item")) {
          return { error: "Waiving is for project managers and super admins." };
        }
        await waive(ctx, me.id, reason);
        break;
      default:
        return { error: "Unknown action." };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }

  revalidatePath(`/studio/p/${slug}`);
  return { error: null };
}

/** Move a deliverable to the client. The gate is enforced in sendToClient. */
export async function sendToClientAction(
  _prev: ItemState,
  formData: FormData,
): Promise<ItemState> {
  const slug = String(formData.get("slug") ?? "");
  const deliverableId = String(formData.get("deliverableId") ?? "");

  await requireStudio(`/studio/p/${slug}`);
  if (isDemoMode()) return { error: DEMO_NOTE };

  const me = await getCurrentPerson();
  if (!can(me, "publish_update")) {
    return { error: "Sending work to a client is for leads and above." };
  }

  try {
    const check = await sendToClient(deliverableId, me.id);
    // Emailing is a courtesy on top of a fact. If it fails, the work has still
    // moved — notify swallows and logs rather than throwing.
    await notifyReviewReady({
      projectId: check.projectId,
      projectSlug: check.projectSlug,
      projectName: check.projectName,
      deliverableId,
      deliverableName: check.name,
      actorId: me.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t send." };
  }

  revalidatePath(`/studio/p/${slug}`);
  revalidatePath(`/p/${slug}`);
  return { error: null };
}

export async function publishAction(
  _prev: ItemState,
  formData: FormData,
): Promise<ItemState> {
  const slug = String(formData.get("slug") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const body = String(formData.get("body") ?? "");

  await requireStudio(`/studio/p/${slug}`);
  if (isDemoMode()) return { error: DEMO_NOTE };

  const me = await getCurrentPerson();
  if (!can(me, "publish_update")) {
    return { error: "Publishing to a client is for leads and above." };
  }

  try {
    await publishUpdate(projectId, me.id, body);
    const project = await import("@/lib/studio/data").then((m) => m.getStudioProject(slug));
    if (project) {
      await notifyUpdatePublished({
        projectId,
        projectSlug: slug,
        projectName: project.name,
        body,
        actorId: me.id,
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t send." };
  }

  revalidatePath(`/studio/p/${slug}`);
  revalidatePath(`/p/${slug}`);
  return { error: null };
}
