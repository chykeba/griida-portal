"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudio, isDemoMode } from "@/lib/auth/dal";
import { getCurrentPerson } from "@/lib/studio/data";
import { assertCan } from "@/lib/studio/permissions";
import {
  addItem,
  discardDraft,
  editableDraftFor,
  publishTemplate,
  removeItem,
  updateItem,
} from "@/lib/db/template-writes";

export interface AdminState {
  error: string | null;
}

const DEMO = "This is the demo — connect D1 to author templates for real.";

/** Authoring SOPs is super-admin only. Centralised so the SOP means something. */
async function gate() {
  await requireStudio("/studio/admin");
  const me = await getCurrentPerson();
  assertCan(me, "author_templates");
  return me;
}

export async function openDraftAction(formData: FormData): Promise<void> {
  const deliverableTypeId = String(formData.get("deliverableTypeId") ?? "");
  await gate();
  if (isDemoMode()) return;
  const templateId = await editableDraftFor(deliverableTypeId);
  revalidatePath("/studio/admin");
  redirect(`/studio/admin/${templateId}`);
}

export async function itemAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const templateId = String(formData.get("templateId") ?? "");
  const op = String(formData.get("op") ?? "");

  try {
    const me = await gate();
    if (isDemoMode()) return { error: DEMO };

    switch (op) {
      case "add":
        await addItem(templateId, String(formData.get("label") ?? ""));
        break;
      case "update":
        await updateItem(templateId, String(formData.get("itemId") ?? ""), {
          label: String(formData.get("label") ?? ""),
          guidance: String(formData.get("guidance") ?? "") || null,
          evidenceKind: String(formData.get("evidenceKind") ?? "none") as "none" | "link" | "text",
          expectedSource: String(formData.get("expectedSource") ?? "") || null,
          requiresCountersign: formData.get("requiresCountersign") === "on",
          isFinalDeliverable: formData.get("isFinalDeliverable") === "on",
          appliesWhenTag: String(formData.get("appliesWhenTag") ?? "") || null,
          isRequired: formData.get("isRequired") === "on",
        });
        break;
      case "remove":
        await removeItem(templateId, String(formData.get("itemId") ?? ""));
        break;
      case "publish":
        await publishTemplate(templateId, me.id);
        break;
      default:
        return { error: "Unknown action." };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }

  revalidatePath(`/studio/admin/${templateId}`);
  revalidatePath("/studio/admin");
  return { error: null };
}

export async function discardAction(formData: FormData): Promise<void> {
  const templateId = String(formData.get("templateId") ?? "");
  await gate();
  if (!isDemoMode()) await discardDraft(templateId);
  revalidatePath("/studio/admin");
  redirect("/studio/admin");
}
