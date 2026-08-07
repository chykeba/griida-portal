"use client";

import { useActionState } from "react";
import { Loader2, Mail } from "lucide-react";
import { requestMagicLink, type LoginState } from "@/app/login/actions";
import { Meta } from "./primitives";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    requestMagicLink,
    { sent: false, error: null },
  );

  if (state.sent) {
    return (
      <div
        className="animate-settle rounded-lg border border-approved/30 bg-approved/[0.04] px-5 py-6"
        role="status"
        aria-live="polite"
      >
        <p className="font-display text-lead font-semibold">Check your email</p>
        <p className="mt-1.5 max-w-[44ch] text-small leading-relaxed text-ink-soft">
          If that address is on a project with us, a sign-in link is on its way.
          It works once and lasts an hour.
        </p>

        {/* Development only — lets the flow be walked without an inbox. */}
        {state.devUrl ? (
          <div className="mt-4 border-t border-approved/25 pt-3">
            <Meta className="block">Development — the link, since no email provider is configured:</Meta>
            <a
              href={state.devUrl}
              className="mt-1 block break-all text-small underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
            >
              {state.devUrl}
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="email" className="block text-small font-medium">
          Your email
        </label>
        <Meta className="mt-0.5 mb-1.5 block">
          Use the address we usually write to.
        </Meta>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@company.com"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "email-error" : undefined}
          className={`min-h-12 w-full rounded-md border bg-paper-raised px-3.5 text-base outline-none transition-colors duration-150 focus:border-ink ${
            state.error ? "border-alert" : "border-rule-interactive"
          }`}
        />
      </div>

      {/* Optional on purpose. The studio types one; clients never see a mode
          to choose, they just leave it empty and get a link. */}
      <div>
        <label htmlFor="password" className="block text-small font-medium">
          Password{" "}
          <span className="font-normal text-ink-faint">— if you’ve set one</span>
        </label>
        <Meta className="mt-0.5 mb-1.5 block">
          Leave it blank and we’ll email you a link instead.
        </Meta>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue=""
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "sign-in-error" : undefined}
          className={`min-h-12 w-full rounded-md border bg-paper-raised px-3.5 text-base outline-none transition-colors duration-150 focus:border-ink ${
            state.error ? "border-alert" : "border-rule-interactive"
          }`}
        />
      </div>

      {state.error ? (
        <p id="sign-in-error" role="alert" className="animate-rise text-small text-alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-5 font-medium text-paper-raised disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Mail className="size-4" strokeWidth={1.75} aria-hidden />
        )}
        {pending ? "One moment…" : "Sign in"}
      </button>
    </form>
  );
}
