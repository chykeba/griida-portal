"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { issueMagicLink, signInWithPassword } from "@/lib/auth/session";
import { looksLikeEmail, safeNext } from "@/lib/auth/tokens";
import { sendMagicLink } from "@/lib/email/send";

export interface LoginState {
  sent: boolean;
  error: string | null;
  /** Set when a password was tried and rejected, so the form stays open. */
  passwordFailed?: boolean;
  /** Shown only outside production, so the flow is usable without an inbox. */
  devUrl?: string;
}

/**
 * One form, two ways in.
 *
 * A password typed means "sign me in now"; an empty one means "send me a
 * link". That keeps a single form for both audiences — the studio types a
 * password, clients ignore the field entirely — with no mode switch to
 * understand and nothing to explain.
 */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const next = String(formData.get("next") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!looksLikeEmail(email)) {
    return { sent: false, error: "That doesn’t look like an email address." };
  }

  if (password) {
    let destination: string | null = null;
    try {
      const result = await signInWithPassword(email, password);
      if (result.ok) {
        destination = safeNext(next, result.user.kind === "studio" ? "/studio" : "/");
      } else if (result.reason === "locked") {
        return {
          sent: false,
          passwordFailed: true,
          error:
            "Too many tries — this account is locked for 15 minutes. You can still " +
            "get in with a link: clear the password box and press Sign in.",
        };
      } else {
        // One message for every failure. Which one it was is exactly what an
        // attacker is trying to learn.
        return {
          sent: false,
          passwordFailed: true,
          error:
            "That email and password don’t match. If you haven’t set a password, " +
            "leave it blank and we’ll email you a link.",
        };
      }
    } catch {
      return {
        sent: false,
        passwordFailed: true,
        error: "We couldn’t check that just now — it’s us, not you. Try again in a moment.",
      };
    }
    // Outside the try: redirect() signals by throwing, and catching it here
    // would turn a successful sign-in into "try again in a moment".
    redirect(destination);
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
