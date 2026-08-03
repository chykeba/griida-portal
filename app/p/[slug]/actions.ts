"use server";

import { revalidatePath } from "next/cache";
import { requireClientView, isDemoMode, getUser } from "@/lib/auth/dal";
import { respondToAction } from "@/lib/db/client-writes";

export interface RespondState {
  error: string | null;
  done?: boolean;
}

/** The client answers a "waiting on you" request. */
export async function respondAction(
  _prev: RespondState,
  formData: FormData,
): Promise<RespondState> {
  const slug = String(formData.get("slug") ?? "");
  await requireClientView(`/p/${slug}`);

  if (isDemoMode()) {
    return { error: "This is the demo — nothing you send here is kept." };
  }

  const user = await getUser();
  if (!user) return { error: "You’ve been signed out. Sign in again and it’ll still be here." };

  const result = await respondToAction(user.id, String(formData.get("actionId") ?? ""), {
    url: String(formData.get("url") ?? ""),
    text: String(formData.get("text") ?? ""),
  });

  if (!result.ok) return { error: result.error ?? "That didn’t send." };

  revalidatePath(`/p/${slug}`);
  revalidatePath("/");
  return { error: null, done: true };
}
