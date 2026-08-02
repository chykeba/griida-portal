import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { ActionForm, CheckboxRow, Field, Select, TextInput } from "@/components/studio/form";
import { Card, Label, Meta, Notice } from "@/components/primitives";
import { createProjectAction } from "../../actions";
import { getCurrentPerson, getStudio } from "@/lib/studio/data";
import { can } from "@/lib/studio/permissions";
import { clientAccounts } from "@/lib/studio/store";
import { PROJECT_TYPES } from "@/lib/studio/templates";
import { count } from "@/lib/copy";

const TAG_HINTS: Record<string, string> = {
  "dark-mode": "Adds dark-variant checks to the relevant checklists",
  "multi-language": "Adds translation and language-switcher checks",
  ecommerce: "Adds checkout and payment checks",
};

export default async function NewProjectPage() {
  const me = await getCurrentPerson();
  const studio = await getStudio();
  const allowed = can(me, "create_project");

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="" />
      <StudioPage>
        <StudioHeading
          title="New project"
          sub="Pick a type and everything comes with it — stages, deliverables, and the checklist that defines done for each."
        />

        {!allowed ? (
          <Notice tone="alert" title="You can’t create projects">
            Project managers and super admins create projects. Ask one of them, or
            ask a super admin to change your role.
          </Notice>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
            <Card className="px-5 py-5">
              <ActionForm
                action={createProjectAction}
                submitLabel="Create project"
                busyLabel="Creating…"
              >
                <Field
                  label="Client"
                  name="accountId"
                  required
                  hint="Don’t see them? Add the client first."
                >
                  <Select name="accountId" required defaultValue={clientAccounts[0]?.id}>
                    {clientAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Project type"
                  name="projectTypeId"
                  required
                  hint="This decides the stages, the deliverables and their SOP checklists."
                >
                  <Select name="projectTypeId" required defaultValue={PROJECT_TYPES[0].id}>
                    {PROJECT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Project name" name="name" required hint="What the client will see.">
                  <TextInput name="name" required placeholder="Brand Identity" />
                </Field>

                <Field label="Lead" name="leadId" required>
                  <Select name="leadId" required defaultValue={me.id}>
                    {studio.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Target finish" name="targetEndOn" hint="You can change this later.">
                    <TextInput name="targetEndOn" type="date" />
                  </Field>
                  <Field
                    label="Revision rounds"
                    name="roundsIncluded"
                    hint="Shown to the client throughout."
                  >
                    <TextInput name="roundsIncluded" type="number" min={1} max={9} defaultValue={2} />
                  </Field>
                </div>

                <fieldset>
                  <legend className="text-small font-medium">What’s in scope?</legend>
                  <Meta className="mt-0.5 mb-2 block">
                    These switch on extra checklist items. Leave them off if they
                    don’t apply — a checklist nobody needs gets rubber-stamped.
                  </Meta>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[...new Set(PROJECT_TYPES.flatMap((t) => t.tags))].map((tag) => (
                      <CheckboxRow
                        key={tag}
                        name="tags"
                        value={tag}
                        label={tag.replace("-", " ")}
                        hint={TAG_HINTS[tag]}
                      />
                    ))}
                  </div>
                </fieldset>
              </ActionForm>
            </Card>

            {/* What you're about to get — so the SOP isn't a black box */}
            <aside className="space-y-5">
              <h2 className="label text-ink-soft">What each type creates</h2>
              {PROJECT_TYPES.map((t) => (
                <Card key={t.id} className="px-4 py-4">
                  <h3 className="font-display text-lead font-semibold">{t.name}</h3>
                  <Label className="mt-2 block">Stages</Label>
                  <p className="text-small text-ink-soft">{t.milestones.join(" → ")}</p>
                  <Label className="mt-2.5 block">Deliverables</Label>
                  <ul className="space-y-0.5">
                    {t.deliverables.map((d) => (
                      <li key={d.id} className="text-small text-ink-soft">
                        {d.name}
                        {d.checklist ? (
                          <Meta className="ml-1.5">
                            {count(d.checklist.items.length, "check")} · v{d.checklist.version}
                          </Meta>
                        ) : (
                          <Meta className="ml-1.5">no checklist yet</Meta>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </aside>
          </div>
        )}
      </StudioPage>
    </div>
  );
}
