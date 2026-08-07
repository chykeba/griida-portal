"use server";

import { revalidatePath } from "next/cache";
import { requireStudio, isDemoMode } from "@/lib/auth/dal";
import { getUser } from "@/lib/auth/dal";
import { removePassword, setPassword, verifyCurrentPassword } from "@/lib/auth/session";

export interface AccountState {
  error: string | null;
  ok: string | null;
}

/**
 * Setting a password on your own account.
 *
 * Anyone who already has one must type it again to change it. A logged-in
 * session is enough to *set* a first password — you proved control of the
 * address to get here — but not enough to silently replace an existing one,
 * which is what an unattended laptop would otherwise be worth.
 */
export async function setPasswordAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  await requireStudio("/studio/account");
  if (isDemoMode()) {
    return { error: "This is the demo — there’s no database behind it.", ok: null };
  }

  const me = await getUser();
  if (!me) return { error: "You’ve been signed out. Sign in and try again.", ok: null };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const hadOne = String(formData.get("hasPassword") ?? "") === "yes";

  if (next !== confirm) {
    return { error: "Those two don’t match.", ok: null };
  }

  if (hadOne) {
    if (!(await verifyCurrentPassword(me.id, current))) {
      return { error: "That’s not your current password.", ok: null };
    }
  }

  try {
    await setPassword(me.id, next);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn’t save.", ok: null };
  }

  revalidatePath("/studio/account");
  return { error: null, ok: hadOne ? "Password changed." : "Password set — you can use it next time." };
}

export async function removePasswordAction(): Promise<void> {
  await requireStudio("/studio/account");
  if (isDemoMode()) return;
  const me = await getUser();
  if (me) await removePassword(me.id);
  revalidatePath("/studio/account");
}
