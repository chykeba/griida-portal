"use client";

import { useActionState, useState } from "react";
import { Check, Link2, Loader2, TriangleAlert } from "lucide-react";
import {
  attestAccessAction,
  setLinkAction,
  type LinkState,
} from "@/app/studio/p/[slug]/actions";
import { Meta } from "../primitives";

export interface ReviewLinkView {
  id: string;
  url: string;
  label: string;
  provider: string;
  bestOnDesktop: boolean;
  clientAccessOk: boolean | null;
  health: string;
}

/**
 * The review link, and the attestation that gates it.
 *
 * Two separate things, shown separately on purpose: the machine says whether
 * the URL resolves, a person says whether this client can open it. Merging
 * them into one green tick would imply we'd verified something we can't.
 */
export function ReviewLink({
  deliverableId,
  slug,
  link,
  canAttest,
}: {
  deliverableId: string;
  slug: string;
  link: ReviewLinkView | null;
  /** Lead and up. The action re-checks; this just stops offering a dead button. */
  canAttest: boolean;
}) {
  const [setState, setAction, setting] = useActionState<LinkState, FormData>(setLinkAction, {
    error: null,
  });
  const [attestState, attestAction, attesting] = useActionState<LinkState, FormData>(
    attestAccessAction,
    { error: null },
  );
  const [editing, setEditing] = useState(!link);

  return (
    <div className="mt-3 border-t border-rule pt-3">
      <p className="mb-2 flex items-center gap-1.5 text-small font-medium">
        <Link2 className="size-3.5 text-ink-faint" strokeWidth={1.75} aria-hidden />
        Review link
      </p>

      {link && !editing ? (
        <>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-small underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
          >
            {link.label}
          </a>
          <Meta className="mt-0.5 block">
            {link.provider}
            {link.health === "ok"
              ? " · URL resolves"
              : link.health === "unknown"
                ? " · not checked"
                : ` · ${link.health}`}
          </Meta>

          {/* The gate. Deliberately not merged with the reachability check. */}
          {link.clientAccessOk === true ? (
            <p className="mt-2 flex items-center gap-1.5 text-small text-approved">
              <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
              Confirmed this client can open it
            </p>
          ) : !canAttest ? (
            <p className="mt-2 text-small text-caution">
              Not confirmed yet. A lead needs to open it as the client would
              before this can go over.
            </p>
          ) : (
            <form action={attestAction} className="mt-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="linkId" value={link.id} />
              <input type="hidden" name="confirmed" value="yes" />
              <p className="mb-1.5 text-small text-ink-soft">
                Open it as they would — a private window, or their email on the
                share list. A 200 from us doesn’t mean they can see it.
              </p>
              <button
                type="submit"
                disabled={attesting}
                className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small font-medium disabled:opacity-50"
              >
                {attesting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                I’ve checked — they can open it
              </button>
              {attestState.error ? (
                <p role="alert" className="mt-1.5 text-small text-alert">
                  {attestState.error}
                </p>
              ) : null}
            </form>
          )}

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="pressable mt-2 text-small text-ink-faint underline decoration-rule-strong underline-offset-4 hover:text-ink"
          >
            Replace the link
          </button>
        </>
      ) : (
        <form action={setAction} className="space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="deliverableId" value={deliverableId} />

          <input
            name="url"
            type="url"
            required
            defaultValue={link?.url}
            placeholder="https://figma.com/proto/…"
            className="min-h-10 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink"
          />
          <div className="flex flex-wrap gap-2">
            <input
              name="label"
              defaultValue={link?.label}
              placeholder="What they’ll see, e.g. “Three directions”"
              className="min-h-10 min-w-0 flex-1 rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink"
            />
            <select
              name="provider"
              defaultValue={link?.provider ?? "figma"}
              className="min-h-10 rounded-md border border-rule-interactive bg-paper-raised px-2 text-small outline-none focus:border-ink"
            >
              <option value="figma">Figma</option>
              <option value="drive">Drive</option>
              <option value="staging">Staging</option>
              <option value="loom">Loom</option>
              <option value="other">Other</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-small text-ink-soft">
            <input
              type="checkbox"
              name="bestOnDesktop"
              defaultChecked={link?.bestOnDesktop}
              className="size-4 accent-[var(--color-ink)]"
            />
            Best on a computer — tell them so on their phone
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={setting}
              className="pressable inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50"
            >
              {setting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {setting ? "Saving…" : link ? "Replace link" : "Attach link"}
            </button>
            {link ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="pressable min-h-10 rounded-md border border-rule px-3 text-small"
              >
                Cancel
              </button>
            ) : null}
          </div>

          {link ? (
            <Meta className="block text-caution">
              Replacing it clears the access confirmation — someone will need to
              check the new one.
            </Meta>
          ) : null}

          {setState.error ? (
            <p role="alert" className="flex items-start gap-1.5 text-small text-alert">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {setState.error}
            </p>
          ) : null}
          {setState.note ? <Meta className="block">{setState.note}</Meta> : null}
        </form>
      )}
    </div>
  );
}
