import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { ActionForm, Field, Select, TextInput } from "@/components/studio/form";
import { Badge, Card, Label, Meta, Notice } from "@/components/primitives";
import { inviteTeamMemberAction } from "../actions";
import { requireStudio } from "@/lib/auth/dal";
import { getCurrentPerson, getStudio } from "@/lib/studio/data";
import { ROLE_BLURB, ROLE_LABEL, can } from "@/lib/studio/permissions";
import { pendingInvites } from "@/lib/studio/store";
import { blockingOthers, myWork } from "@/lib/studio/logic";
import { count, naturalAge } from "@/lib/copy";
import type { StudioRole } from "@/lib/studio/types";

const ROLES: StudioRole[] = ["member", "lead", "admin_pm", "super_admin"];

export default async function TeamPage() {
  const me = await getCurrentPerson();
  await requireStudio("/studio/team");
  const studio = await getStudio();
  const allowed = can(me, "manage_team");

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="" />
      <StudioPage>
        <StudioHeading
          title="Team"
          sub="Who’s here, what they can do, and what they’re carrying."
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section>
            <h2 className="label mb-3 text-ink-soft">{count(studio.people.length, "person", "people")}</h2>
            <ul className="stagger space-y-2.5">
              {studio.people.map((p) => {
                const load = myWork(studio, p.id).length;
                const blocking = blockingOthers(studio, p.id).length;
                return (
                  <Card as="li" key={p.id} className="flex items-start gap-3 px-4 py-3.5">
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-rule-strong font-mono text-small"
                    >
                      {p.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="font-medium">{p.name}</p>
                        {p.id === me.id ? <Meta>you</Meta> : null}
                      </div>
                      <Meta className="block">{ROLE_LABEL[p.role]}</Meta>
                      <p className="mt-1 text-small text-ink-soft">{ROLE_BLURB[p.role]}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="neutral">{count(load, "open task")}</Badge>
                        {blocking > 0 ? (
                          <Badge tone="caution">Blocking {count(blocking, "task")}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </ul>

            {pendingInvites.length > 0 ? (
              <>
                <h2 className="label mt-8 mb-3 text-ink-soft">Invited, not yet joined</h2>
                <ul className="space-y-2">
                  {pendingInvites.map((i) => (
                    <Card as="li" key={i.email} className="px-4 py-3">
                      <p className="text-small font-medium">{i.name}</p>
                      <Meta className="block">
                        {i.email} · {ROLE_LABEL[i.role]} · invited {naturalAge(i.invitedAt)}
                      </Meta>
                    </Card>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <aside>
            <h2 className="label mb-3 text-ink-soft">Invite someone</h2>
            {!allowed ? (
              <Notice tone="neutral" title="Only a super admin can add people">
                That’s deliberate — the same role that authors the SOP checklists
                controls who can tick them. Ask {" "}
                {studio.people
                  .filter((p) => p.role === "super_admin")
                  .map((p) => p.name)
                  .join(" or ") || "a super admin"}
                .
              </Notice>
            ) : (
              <Card className="px-4 py-4">
                <ActionForm
                  action={inviteTeamMemberAction}
                  submitLabel="Send invite"
                  busyLabel="Sending…"
                >
                  <Field label="Name" name="name" required>
                    <TextInput name="name" required placeholder="Kemi Ade" />
                  </Field>

                  <Field
                    label="Work email"
                    name="email"
                    required
                    hint="They’ll get a sign-in link. No password to set."
                  >
                    <TextInput
                      name="email"
                      type="email"
                      inputMode="email"
                      required
                      placeholder="kemi@griida.com"
                    />
                  </Field>

                  <Field label="Role" name="role" required hint="You can change this later.">
                    <Select name="role" required defaultValue="member">
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]} — {ROLE_BLURB[r]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </ActionForm>
              </Card>
            )}

            <div className="mt-5">
              <Label className="mb-2 block">What each role can do</Label>
              <dl className="space-y-2">
                {ROLES.map((r) => (
                  <div key={r} className="text-small">
                    <dt className="font-medium">{ROLE_LABEL[r]}</dt>
                    <dd className="text-ink-soft">{ROLE_BLURB[r]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </StudioPage>
    </div>
  );
}
