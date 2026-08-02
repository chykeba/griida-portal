"use server";

import { headers } from "next/headers";
import { issueMagicLink } from "@/lib/auth/session";
import { looksLikeEmail } from "@/lib/auth/tokens";
import { sendMagicLink } from "@/lib/email/send";

export interface LoginState {
  sent: boolean;
  error: string | null;
  /** Shown only outside production, so the flow is usable without an inbox. */
  devUrl?: string;
}

export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!looksLikeEmail(email)) {
    return { sent: false, error: "That doesn’t look like an email address." };
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  try {
    const result = await issueMagicLink(email, origin);
    if (result.token) {
      const url = `${origin}/auth/verify?token=${result.token}${
        next ? `&next=${encodeURIComponent(next)}` : ""
      }`;
      await sendMagicLink(email, url);
      // Always the same response, whether or not the address exists — see
      // issueMagicLink. Never confirm who is a client of this studio.
      return { sent: true, error: null, devUrl: result.devUrl ? url : undefined };
    }
    return { sent: true, error: null };
  } catch {
    return {
      sent: false,
      error:
        "We couldn’t send that just now — it’s us, not you. Try again in a moment.",
    };
  }
}
