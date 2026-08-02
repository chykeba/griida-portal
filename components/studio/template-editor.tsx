"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { discardAction, itemAction, type AdminState } from "@/app/studio/admin/actions";
import { Meta } from "../primitives";
import type { TemplateItem } from "@/lib/db/template-writes";

/**
 * Editing one version of a standard.
 *
 * The item form carries the flags that actually change behaviour downstream —
 * evidence, countersign, conditional tag — with the consequence spelled out
 * next to each, because an author choosing "needs a countersign" is deciding
 * that someone will be blocked later, and should know it.
 */
export function TemplateEditor({
  templateId,
  items,
  editable,
}: {
  templateId: string;
  items: TemplateItem[];
  editable: boolean;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(itemAction, {
    error: null,
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const required = items.filter((i) => i.isRequired).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-small font-medium">The checks</p>
        <Meta className={items.length > 12 ? "text-caution" : undefined}>
          {required} required of {items.length}
          {items.length > 12 ? " — past a dozen they get rubber-stamped" : ""}
        </Meta>
      </div>

      {items.length === 0 ? (
        <p className="mb-4 text-small text-ink-soft">
          Nothing yet. A deliverable type with no standard publishes unchecked —
          which is a decision, just not usually the one you meant.
        </p>
      ) : (
        <ul className="mb-5 divide-y divide-rule border-y border-rule">
          {items.map((item) => (
            <li key={item.id} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-small font-medium">
                    {item.position}. {item.label}
                    {item.requiresCountersign ? (
                      <ShieldCheck
                        className="ml-1.5 inline size-3.5 text-caution"
                        strokeWidth={2}
                        aria-label="Needs a second pair of eyes"
                      />
                    ) : null}
                  </p>
                  {item.guidance ? <Meta className="mt-0.5 block">{item.guidance}</Meta> : null}
                  <Meta className="mt-0.5 block">
                    {[
                      item.isRequired ? "required" : "optional",
                      item.evidenceKind === "none" ? "no evidence" : `needs a ${item.evidenceKind}`,
                      item.isFinalDeliverable ? "final deliverable" : null,
                      item.appliesWhenTag ? `only when ${item.appliesWhenTag}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Meta>
                </div>

                {editable ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                    className="pressable shrink-0 text-small text-ink-faint underline decoration-rule-strong underline-offset-4 hover:text-ink"
                  >
                    {expanded === item.id ? "Close" : "Edit"}
                  </button>
                ) : null}
              </div>

              {editable && expanded === item.id ? (
                <form action={action} className="mt-3 space-y-2 border-l-2 border-rule pl-3">
                  <input type="hidden" name="templateId" value={templateId} />
                  <input type="hidden" name="itemId" value={item.id} />

                  <input
                    name="label"
                    defaultValue={item.label}
                    className="min-h-10 w-full rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink"
                  />
                  <input
                    name="guidance"
                    defaultValue={item.guidance ?? ""}
                    placeholder="How to do it — shown at the moment someone ticks it"
                    className="min-h-10 w-full rounded-md border border-rule bg-paper-raised px-3 text-small outline-none focus:border-ink"
                  />

                  <div className="flex flex-wrap gap-2">
                    <select
                      name="evidenceKind"
                      defaultValue={item.evidenceKind}
                      className="min-h-10 rounded-md border border-rule bg-paper-raised px-2 text-small outline-none focus:border-ink"
                    >
                      <option value="none">No evidence</option>
                      <option value="link">Needs a link</option>
                      <option value="text">Needs a note</option>
                    </select>
                    <input
                      name="expectedSource"
                      defaultValue={item.expectedSource ?? ""}
                      placeholder="Where from, e.g. Figma"
                      className="min-h-10 w-40 rounded-md border border-rule bg-paper-raised px-3 text-small outline-none focus:border-ink"
                    />
                    <input
                      name="appliesWhenTag"
                      defaultValue={item.appliesWhenTag ?? ""}
                      placeholder="Only when… e.g. dark-mode"
                      className="min-h-10 w-44 rounded-md border border-rule bg-paper-raised px-3 text-small outline-none focus:border-ink"
                    />
                  </div>

                  <Flag name="isRequired" defaultChecked={item.isRequired}
                    label="Required" hint="Blocks sending the work to the client until it's settled" />
                  <Flag name="requiresCountersign" defaultChecked={item.requiresCountersign}
                    label="Needs a second pair of eyes" hint="Someone other than the person who ticked it must confirm" />
                  <Flag name="isFinalDeliverable" defaultChecked={item.isFinalDeliverable}
                    label="Final deliverable" hint="Its link appears in the handover bundle at the end" />

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="submit" name="op" value="update" disabled={pending}
                      className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-md bg-ink px-3 text-small font-medium text-paper-raised disabled:opacity-50">
                      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                      Save
                    </button>
                    <button type="submit" name="op" value="remove" disabled={pending}
                      className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small text-alert disabled:opacity-50">
                      <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                      Remove
                    </button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {state.error ? (
        <p role="alert" className="animate-rise mb-4 flex items-start gap-1.5 rounded-md border border-alert/35 bg-alert/[0.05] px-3 py-2.5 text-small">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alert" strokeWidth={2} aria-hidden />
          {state.error}
        </p>
      ) : null}

      {editable ? (
        <>
          <form action={action} className="flex flex-wrap gap-2">
            <input type="hidden" name="templateId" value={templateId} />
            <input
              name="label"
              required
              placeholder="Add a check — e.g. “Favicon and social preview set”"
              className="min-h-10 min-w-0 flex-1 rounded-md border border-rule-interactive bg-paper-raised px-3 text-small outline-none focus:border-ink"
            />
            <button type="submit" name="op" value="add" disabled={pending}
              className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small font-medium disabled:opacity-50">
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              Add
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
            <form action={action}>
              <input type="hidden" name="templateId" value={templateId} />
              <button type="submit" name="op" value="publish" disabled={pending}
                className="pressable inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50">
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Publish this version
              </button>
            </form>
            <form action={discardAction}>
              <input type="hidden" name="templateId" value={templateId} />
              <button type="submit"
                className="pressable min-h-10 rounded-md border border-rule px-3 text-small text-ink-soft">
                Discard draft
              </button>
            </form>
            <Meta className="w-full">
              Publishing applies to projects created from now on. Anything
              already running keeps the snapshot it started with.
            </Meta>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Flag({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-small">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 accent-[var(--color-ink)]"
      />
      <span>
        {label}
        <Meta className="block">{hint}</Meta>
      </span>
    </label>
  );
}
