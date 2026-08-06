"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Loader2, TriangleAlert } from "lucide-react";
import { addScheduleAction, setDueDateAction, type ScheduleState } from "@/app/studio/p/[slug]/actions";
import { Meta } from "../primitives";

const idle: ScheduleState = { error: null, ok: null };

export interface ScheduleItemView {
  id: string;
  name: string;
  status: string;
  dueOn: string | null;
}

/**
 * Building the client's delivery schedule.
 *
 * The paste box exists because the schedule already exists — in a spreadsheet,
 * on someone's screen, right now. Asking them to retype twenty rows into
 * twenty forms is how a tool loses to the spreadsheet it was meant to replace,
 * so the input is a straight paste of what they already have.
 */
export function ScheduleBuilder({
  projectId,
  slug,
  items,
  canEdit,
}: {
  projectId: string;
  slug: string;
  items: ScheduleItemView[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(addScheduleAction, idle);
  const [open, setOpen] = useState(items.length === 0);

  const dated = items.filter((i) => i.dueOn).length;

  return (
    <div>
      {items.length > 0 ? (
        <>
          <Meta className="mb-2 block">
            {items.length} item{items.length === 1 ? "" : "s"}, {dated} dated
            {dated < items.length ? ` · ${items.length - dated} with no date yet` : ""}
          </Meta>
          <ul className="mb-3 divide-y divide-rule">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-small">{item.name}</span>
                {canEdit ? (
                  <form action={setDueDateAction} className="shrink-0">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="deliverableId" value={item.id} />
                    <input
                      type="date"
                      name="dueOn"
                      defaultValue={item.dueOn ?? ""}
                      aria-label={`Due date for ${item.name}`}
                      // Submitting on change keeps this to one interaction —
                      // a Save button per row would be twenty buttons.
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      className="min-h-9 rounded-md border border-rule-interactive bg-paper-raised px-2 text-small tabular-nums outline-none focus:border-ink"
                    />
                  </form>
                ) : (
                  <span className="meta shrink-0 tabular-nums">{item.dueOn ?? "no date"}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {!canEdit ? (
        <Meta className="block">A project manager sets the schedule.</Meta>
      ) : open ? (
        <form action={action} className="space-y-2 border-t border-rule pt-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="projectId" value={projectId} />
          <label htmlFor="items" className="label block text-ink-soft">
            One per line
          </label>
          <textarea
            id="items"
            name="items"
            rows={6}
            required
            placeholder={"Homepage\t8/6/2026\nAbout us\t8/8/2026\nAcademics\t8/10/2026"}
            className="w-full rounded-md border border-rule-interactive bg-paper-raised px-3 py-2 font-mono text-small leading-relaxed outline-none focus:border-ink"
          />
          <Meta className="block">
            Paste straight from a spreadsheet, or type “Name, 8/6/2026”. No date is
            fine — you can set it below afterwards. Items only reach the client’s
            schedule once they have one.
          </Meta>
          <button
            type="submit"
            disabled={pending}
            className="pressable inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 text-small font-medium text-paper-raised disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CalendarPlus className="size-4" strokeWidth={1.75} aria-hidden />
            )}
            Add them
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rule-interactive px-3 text-small font-medium"
        >
          <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden />
          Add items
        </button>
      )}
    </div>
  );
}
