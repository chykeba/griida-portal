"use client";

import { useActionState } from "react";
import { KeyRound, Loader2, TriangleAlert } from "lucide-react";
import {
  removePasswordAction,
  setPasswordAction,
  type AccountState,
} from "@/app/studio/account/actions";
import { Meta } from "../primitives";

const idle: AccountState = { error: null, ok: null };

const field =
  "min-h-11 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-base outline-none transition-colors duration-150 focus:border-ink";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(setPasswordAction, idle);

  return (
    <div>
      <form action={action} className="max-w-sm space-y-3">
        <input type="hidden" name="hasPassword" value={hasPassword ? "yes" : "no"} />

        {hasPassword ? (
          <div>
            <label htmlFor="current" className="block text-small font-medium">
              Current password
            </label>
            <input
              id="current"
              name="current"
              type="password"
              required
              autoComplete="current-password"
              className={`mt-1.5 ${field}`}
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="password" className="block text-small font-medium">
            {hasPassword ? "New password" : "Password"}
          </label>
          <Meta className="mt-0.5 mb-1.5 block">
            At least 12 characters. Length beats punctuation — a short phrase you’d
            never write down elsewhere works better than “P@ssw0rd”.
          </Meta>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-small font-medium">
            Again, to be sure
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            className={`mt-1.5 ${field}`}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="size-4" strokeWidth={1.75} aria-hidden />
          )}
          {hasPassword ? "Change it" : "Set a password"}
        </button>

        {state.error ? (
          <p role="alert" className="animate-rise flex items-start gap-1.5 text-small text-alert">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p role="status" className="animate-rise text-small text-approved">
            {state.ok}
          </p>
        ) : null}
      </form>

      {hasPassword ? (
        <form action={removePasswordAction} className="mt-5 border-t border-rule pt-4">
          <button
            type="submit"
            className="pressable min-h-9 rounded-md border border-rule-interactive px-3 text-small font-medium"
          >
            Remove it and go back to links
          </button>
          <Meta className="mt-1.5 block">
            You’ll sign in the way clients do — a link by email, every time.
          </Meta>
        </form>
      ) : null}
    </div>
  );
}
