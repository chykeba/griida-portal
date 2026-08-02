"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/studio/data";
import { isDemoMode } from "@/lib/auth/dal";
import { assertCan } from "@/lib/studio/permissions";
import {
  createClientAccount,
  createProjectInD1,
  inviteTeamMemberInD1,
} from "@/lib/db/studio-writes";
import {
  createClient as createClientInMemory,
  createProject as createProjectInMemory,
  inviteTeamMember as inviteInMemory,
} from "@/lib/studio/store";
import type { StudioRole } from "@/lib/studio/types";

export interface FormState {
  error: string | null;
  ok?: string;
}

/**
 * Server actions for the setup flows.
 *
 * Each re-checks permission with `assertCan` before touching anything. The UI
 * hides what you can't do, but hiding is not authorisation — reaching this
 * function directly still fails.
 *
 * Writes go to D1 when it's configured and to the in-memory store in demo mode.
 * Getting that wrong is what made "create a project" 404: the row was written
 * to a module-level array while the read path had already moved to D1.
 */

export async function createClientAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentPerson();
  try {
    assertCan(me, "create_client");
    const input = {
      name: String(formData.get("name") ?? ""),
      contactName: String(formData.get("contactName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
    };
    if (isDemoMode()) createClientInMemory(me, input);
    else await createClientAccount(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }
  revalidatePath("/studio/clients");
  redirect("/studio/clients");
}

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentPerson();
  let slug: string;
  try {
    assertCan(me, "create_project");
    const rounds = Number(formData.get("roundsIncluded") ?? 2);
    const input = {
      accountId: String(formData.get("accountId") ?? ""),
      projectTypeId: String(formData.get("projectTypeId") ?? ""),
      name: String(formData.get("name") ?? ""),
      leadId: String(formData.get("leadId") ?? ""),
      targetEndOn: (formData.get("targetEndOn") as string) || null,
      roundsIncluded: Number.isFinite(rounds) && rounds > 0 ? rounds : 2,
      tags: formData.getAll("tags").map(String),
    };
    slug = isDemoMode()
      ? createProjectInMemory(me, input).slug
      : (await createProjectInD1(input)).slug;
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
  const email = String(formData.get("email") ?? "");
  try {
    assertCan(me, "manage_team");
    const input = {
      name: String(formData.get("name") ?? ""),
      email,
      role: String(formData.get("role") ?? "member") as StudioRole,
    };
    if (isDemoMode()) inviteInMemory(me, input);
    else await inviteTeamMemberInD1(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t work." };
  }
  revalidatePath("/studio/team");
  return { error: null, ok: `${email.trim().toLowerCase()} can sign in now — send them the link from the login page.` };
}
