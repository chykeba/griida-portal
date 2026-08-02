"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/studio/data";
import {
  createClient,
  createProject,
  inviteTeamMember,
  type PendingInvite,
} from "@/lib/studio/store";
import type { StudioRole } from "@/lib/studio/types";

export interface FormState {
  error: string | null;
  ok?: string;
}

/**
 * Server actions for the setup flows.
 *
 * Each one re-checks permission via the store, which calls `assertCan`. The UI
 * hides what you can't do, but hiding is not authorisation — reaching this
 * function directly still fails.
 *
 * Errors are returned, not thrown, so the form can render them next to the
 * field with the cause and a way forward rather than a red "invalid".
 */

export async function createClientAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentPerson();
  try {
    createClient(me, {
      name: String(formData.get("name") ?? ""),
      contactName: String(formData.get("contactName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }
  revalidatePath("/studio");
  redirect("/studio/clients");
}

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentPerson();
  let slug: string;
  try {
    const rounds = Number(formData.get("roundsIncluded") ?? 2);
    const project = createProject(me, {
      accountId: String(formData.get("accountId") ?? ""),
      projectTypeId: String(formData.get("projectTypeId") ?? ""),
      name: String(formData.get("name") ?? ""),
      leadId: String(formData.get("leadId") ?? ""),
      targetEndOn: (formData.get("targetEndOn") as string) || null,
      roundsIncluded: Number.isFinite(rounds) && rounds > 0 ? rounds : 2,
      tags: formData.getAll("tags").map(String),
    });
    slug = project.slug;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }
  revalidatePath("/studio");
  redirect(`/studio/p/${slug}`);
}

export async function inviteTeamMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentPerson();
  let invite: PendingInvite;
  try {
    invite = inviteTeamMember(me, {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "member") as StudioRole,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }
  revalidatePath("/studio/team");
  return { error: null, ok: `Invite sent to ${invite.email}.` };
}
