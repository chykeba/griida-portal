"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, ShieldCheck, TriangleAlert, Undo2 } from "lucide-react";
import { checklistAction, type ItemState } from "@/app/studio/p/[slug]/actions";
import { Meta } from "../primitives";
import { cn } from "@/lib/utils";

export interface ChecklistItemView {
  id: string;
  label: string;
  guidance: string | null;
  state: "open" | "checked" | "countersigned" | "waived";
  requiresCountersign: boolean;
  evidenceKind: "none" | "link" | "text";
  checkedByName: string | null;
  checkedAt: string | null;
  evidenceUrl: string | null;
  evidenceText: string | null;
  /** Computed on the server from the session — the UI only reflects it. */
  canTick: boolean;
  canCountersign: boolean;
  canWaive: boolean;
  /** Shown when countersigning is blocked, so the greyed-out state explains itself. */
  countersignBlockedWhy: string | null;
}

/**
 * One checklist item, with its actions.
 *
 * Ticking is not a toggle — an item that needs evidence opens a small form,
 * because the point of §5b is that a tick is an attestation with something
 * behind it, not a box someone clicked past.
 */
export function ChecklistRow({
  item,
  slug,
}: {
  item: ChecklistItemView;
  slug: string;
}) {
  const [state, action, pending] = useActionState<ItemState, FormData>(checklistAction, {
    error: null,
  });
  const [open, setOpen] = useState(false);

  const settled =
    item.state === "waived" ||
    item.state === "countersigned" ||
    (item.state === "checked" && !item.requiresCountersign);
  const awaitingSign = item.state === "checked" && item.requiresCountersign;

  return (
    <li className="border-b border-rule py-2.5 last:border-0">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
            settled
              ? "border-approved bg-approved text-paper-raised"
              : awaitingSign
                ? "border-caution"
                : "border-rule-interactive",
          )}
        >
          {settled ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
        </span>

        <div className="min-w-0 flex-1">
          <p className={cn("text-small", settled ? "text-ink-soft" : "font-medium")}>
            {item.label}
            {item.requiresCountersign ? (
              <ShieldCheck
                className="ml-1.5 inline size-3.5 text-caution"
                strokeWidth={2}
                aria-label="Needs a second pair of eyes"
              />
            ) : null}
          </p>

          {item.guidance && item.state === "open" ? (
            <Meta className="mt-0.5 block">{item.guidance}</Meta>
          ) : null}

          {item.checkedByName ? (
            <Meta className="mt-0.5 block">
              {item.checkedByName}
              {item.evidenceUrl ? (
                <>
                  {" · "}
                  <a
                    href={item.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
                  >
                    evidence
                  </a>
                </>
              ) : null}
              {item.evidenceText ? ` · “${item.evidenceText}”` : null}
            </Meta>
          ) : null}

          {item.state === "waived" ? (
            <Meta className="mt-0.5 block text-caution">Waived</Meta>
          ) : null}

          {awaitingSign ? (
            <Meta className="mt-0.5 block text-caution">
              {item.canCountersign
                ? "Needs your countersign"
                : (item.countersignBlockedWhy ?? "Waiting on a countersign")}
            </Meta>
          ) : null}

          {state.error ? (
            <p role="alert" className="animate-rise mt-1.5 flex items-start gap-1.5 text-small text-alert">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {state.error}
            </p>
          ) : null}

          {/* ---- actions ---- */}
          <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="itemId" value={item.id} />

            {item.state === "open" && item.canTick ? (
              item.evidenceKind === "none" ? (
                <Button name="op" value="tick" pending={pending} label="Tick" primary />
              ) : (
                <>
                  {open ? (
                    <>
                      <input
                        name={item.evidenceKind === "link" ? "url" : "text"}
                        placeholder={
                          item.evidenceKind === "link"
                            ? "Link to where the work is"
                            : "What did you find?"
                        }
                        className="min-h-9 min-w-0 flex-1 rounded-md border border-rule-interactive bg-paper-raised px-2.5 text-small outline-none focus:border-ink"
                      />
                      <Button name="op" value="tick" pending={pending} label="Tick" primary />
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(true)}
                      className="pressable inline-flex min-h-9 items-center rounded-md bg-ink px-3 text-small font-medium text-paper-raised"
                    >
                      Tick — needs {item.evidenceKind === "link" ? "a link" : "a note"}
                    </button>
                  )}
                </>
              )
            ) : null}

            {awaitingSign && item.canCountersign ? (
              <Button name="op" value="countersign" pending={pending} label="Countersign" primary />
            ) : null}

            {item.state !== "open" && item.canTick ? (
              <>
                <input
                  name="reason"
                  placeholder="Why?"
                  className="min-h-9 w-28 rounded-md border border-rule bg-paper-raised px-2.5 text-small outline-none focus:border-ink"
                />
                <Button name="op" value="untick" pending={pending} label="Undo" icon />
              </>
            ) : null}

            {item.state === "open" && item.canWaive ? (
              <>
                <input
                  name="reason"
                  placeholder="Reason for waiving"
                  className="min-h-9 w-40 rounded-md border border-rule bg-paper-raised px-2.5 text-small outline-none focus:border-ink"
                />
                <Button name="op" value="waive" pending={pending} label="Waive" />
              </>
            ) : null}
          </form>
        </div>
      </div>
    </li>
  );
}

function Button({
  name,
  value,
  label,
  pending,
  primary,
  icon,
}: {
  name: string;
  value: string;
  label: string;
  pending: boolean;
  primary?: boolean;
  icon?: boolean;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cn(
        "pressable inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-small font-medium disabled:opacity-50",
        primary
          ? "bg-ink text-paper-raised"
          : "border border-rule-interactive text-ink-soft hover:text-ink",
      )}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {icon && !pending ? <Undo2 className="size-3.5" strokeWidth={1.75} aria-hidden /> : null}
      {label}
    </button>
  );
}
