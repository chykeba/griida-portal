"use client";

import { errors } from "@/lib/copy";

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  const copy = errors.loadFailed;
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-16">
      <div className="animate-rise">
        <h1 className="font-display text-headline leading-tight font-semibold tracking-tight">
          {copy.headline}
        </h1>
        <p className="mt-2 max-w-[46ch] leading-relaxed text-ink-soft">{copy.body}</p>
        <button
          onClick={reset}
          className="pressable mt-6 inline-flex min-h-12 items-center rounded-md bg-ink px-5 font-medium text-paper-raised"
        >
          {copy.action}
        </button>
      </div>
    </main>
  );
}
