"use server";

import { revalidatePath } from "next/cache";
import { requireStudio } from "@/lib/auth/dal";
import { isDemoMode } from "@/lib/auth/dal";
import { getCurrentPerson } from "@/lib/studio/data";
import { assertCan, can } from "@/lib/studio/permissions";
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
import { attestClientAccess, checkReachable, setReviewLink } from "@/lib/db/link-writes";
import {
  acceptClientAction,
  addClientToProject,
  createClientAction,
  removeClientFromProject,
  projectIdForSlug,
  reopenClientAction,
  setHealth,
} from "@/lib/db/project-writes";

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

export interface LinkState {
  error: string | null;
  note?: string;
}

/** Attach or replace the review link on a deliverable's current round. */
export async function setLinkAction(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const slug = String(formData.get("slug") ?? "");
  const deliverableId = String(formData.get("deliverableId") ?? "");

  await requireStudio(`/studio/p/${slug}`);
  if (isDemoMode()) return { error: DEMO_NOTE };
  const me = await getCurrentPerson();

  try {
    const linkId = await setReviewLink({
      deliverableId,
      url: String(formData.get("url") ?? ""),
      label: String(formData.get("label") ?? ""),
      provider: String(formData.get("provider") ?? "other"),
      bestOnDesktop: formData.get("bestOnDesktop") === "on",
      actorId: me.id,
    });
    // Check reachability immediately — a typo is worth catching now, not when
    // the client clicks it.
    const reach = await checkReachable(linkId);
    revalidatePath(`/studio/p/${slug}`);
    return { error: null, note: reach.note };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t save." };
  }
}

/** The human attestation that this client can actually open it. */
export async function attestAccessAction(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const slug = String(formData.get("slug") ?? "");
  const linkId = String(formData.get("linkId") ?? "");
  const confirmed = String(formData.get("confirmed") ?? "") === "yes";

  const { me, projectId } = await studioGate(slug);
  if (isDemoMode()) return { error: DEMO_NOTE };

  try {
    assertCan(me, "attest_link_access");
    await attestClientAccess(linkId, me.id, confirmed, sameProject(null, projectId));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t save." };
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
  const reason = String(formData.get("reason") ?? "");

  await requireStudio(`/studio/p/${slug}`);
  if (isDemoMode()) return { error: DEMO_NOTE };

  const me = await getCurrentPerson();
  if (!can(me, "publish_update")) {
    return { error: "Sending work to a client is for leads and above." };
  }

  try {
    const check = await sendToClient(deliverableId, me.id, reason ? { reason } : undefined);
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


/* -------------------------------------------------------------------------- */
/* People, requests and health                                                */
/* -------------------------------------------------------------------------- */

/**
 * Signed in, on the studio side, and standing in a real project.
 *
 * Returns the project id resolved from the ROUTE. Actions must use this rather
 * than the `projectId` in the form — the form is attacker-controlled, and the
 * route is what the page was authorised against. Anything still sending a
 * projectId field is reconciled against this and refused if it disagrees.
 */
async function studioGate(slug: string) {
  await requireStudio(`/studio/p/${slug}`);
  const [me, projectId] = await Promise.all([getCurrentPerson(), projectIdForSlug(slug)]);
  return { me, projectId };
}

/** Refuses a form that names a different project than the page it came from. */
function sameProject(formValue: FormDataEntryValue | null, projectId: string | null): string {
  const claimed = String(formValue ?? "");
  if (!projectId) throw new Error("That project has gone.");
  if (claimed && claimed !== projectId) {
    throw new Error("That request didn’t match this project. Reload the page and try again.");
  }
  return projectId;
}

export async function addClientAction(
  _prev: ItemState,
  formData: FormData,
): Promise<ItemState> {
  const slug = String(formData.get("slug") ?? "");
  const { me, projectId } = await studioGate(slug);
  if (isDemoMode()) return { error: DEMO_NOTE };

  try {
    assertCan(me, "manage_project_clients");
    await addClientToProject({
      projectId: sameProject(formData.get("projectId"), projectId),
      actorId: me.id,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "reviewer") as "owner" | "reviewer" | "viewer",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }
  revalidatePath(`/studio/p/${slug}`);
  return { error: null };
}

export async function removeClientAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const { me, projectId } = await studioGate(slug);
  if (isDemoMode()) return;
  assertCan(me, "manage_project_clients");
  await removeClientFromProject(
    sameProject(formData.get("projectId"), projectId),
    String(formData.get("userId") ?? ""),
    me.id,
  );
  revalidatePath(`/studio/p/${slug}`);
}

export async function askClientAction(
  _prev: ItemState,
  formData: FormData,
): Promise<ItemState> {
  const slug = String(formData.get("slug") ?? "");
  const { me, projectId } = await studioGate(slug);
  if (isDemoMode()) return { error: DEMO_NOTE };

  try {
    await createClientAction({
      projectId: sameProject(formData.get("projectId"), projectId),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      blocksNote: String(formData.get("blocksNote") ?? "") || null,
      dueOn: String(formData.get("dueOn") ?? "") || null,
      actorId: me.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }
  revalidatePath(`/studio/p/${slug}`);
  revalidatePath(`/p/${slug}`);
  return { error: null };
}

export async function resolveActionAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const { me, projectId } = await studioGate(slug);
  if (isDemoMode()) return;
  // Same reasoning as sameProject: the action id comes from the form, so the
  // write is scoped to the project this page is for.
  const id = String(formData.get("actionId") ?? "");
  const scope = sameProject(null, projectId);
  if (String(formData.get("op") ?? "") === "reopen") {
    await reopenClientAction(id, me.id, scope);
  } else {
    await acceptClientAction(id, me.id, scope);
  }
  revalidatePath(`/studio/p/${slug}`);
  revalidatePath(`/p/${slug}`);
}

export async function setHealthAction(
  _prev: ItemState,
  formData: FormData,
): Promise<ItemState> {
  const slug = String(formData.get("slug") ?? "");
  const { me, projectId } = await studioGate(slug);
  if (isDemoMode()) return { error: DEMO_NOTE };

  try {
    await setHealth({
      projectId: sameProject(formData.get("projectId"), projectId),
      health: String(formData.get("health") ?? "on_track") as
        | "on_track" | "at_risk" | "blocked",
      note: String(formData.get("note") ?? ""),
      actorId: me.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }
  revalidatePath(`/studio/p/${slug}`);
  revalidatePath(`/p/${slug}`);
  return { error: null };
}
