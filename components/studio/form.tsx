"use client";

import { useActionState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Meta } from "../primitives";
import type { FormState } from "@/app/studio/actions";

/* ==========================================================================
   Shared form parts.

   Every field has a visible label (never placeholder-only), persistent helper
   text rather than a tooltip, and errors that state the cause and the way
   forward. Inputs are 44px+ so they're usable on a phone.
   ========================================================================== */

export function Field({
  label,
  name,
  hint,
  children,
  required,
}: {
  label: string;
  name: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-small font-medium">
        {label}
        {required ? <span className="ml-1 text-ink-faint">(required)</span> : null}
      </label>
      {hint ? <Meta className="mt-0.5 mb-1.5 block">{hint}</Meta> : <div className="mb-1.5" />}
      {children}
    </div>
  );
}

const CONTROL =
  "w-full min-h-11 rounded-md border border-rule-interactive bg-paper-raised px-3 text-base outline-none transition-colors duration-150 focus:border-ink";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} id={props.name} className={cn(CONTROL, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} id={props.name} className={cn(CONTROL, "py-2", props.className)}>
      {props.children}
    </select>
  );
}

export function CheckboxRow({
  name,
  value,
  label,
  hint,
}: {
  name: string;
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <label className="pressable flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md border border-rule px-3 py-2.5 hover:bg-paper-sunk">
      <input
        type="checkbox"
        name={name}
        value={value}
        className="mt-1 size-4 accent-[var(--color-ink)]"
      />
      <span>
        <span className="block text-small font-medium">{label}</span>
        {hint ? <Meta className="block">{hint}</Meta> : null}
      </span>
    </label>
  );
}

/**
 * Wraps a server action, surfacing its error above the submit button where the
 * eye already is — not at the top of a long form the user has scrolled past.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  busyLabel = "Saving…",
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  busyLabel?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="space-y-5">
      {children}

      {state.error ? (
        <p
          role="alert"
          className="animate-rise flex items-start gap-2 rounded-md border border-alert/35 bg-alert/[0.05] px-3.5 py-3 text-small"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alert" strokeWidth={2} aria-hidden />
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <p
          role="status"
          className="animate-rise rounded-md border border-approved/35 bg-approved/[0.05] px-3.5 py-3 text-small"
        >
          {state.ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ink px-5 font-medium text-paper-raised disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? busyLabel : submitLabel}
      </button>
    </form>
  );
}
