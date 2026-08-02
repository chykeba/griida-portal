import Link from "next/link";
import { Plus } from "lucide-react";
import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { Card, Label, Meta } from "@/components/primitives";
import { requireStudio } from "@/lib/auth/dal";
import { getCurrentPerson, getStudio } from "@/lib/studio/data";
import { can } from "@/lib/studio/permissions";
import { clientAccounts } from "@/lib/studio/store";
import { isDemoMode } from "@/lib/auth/dal";
import { listClientAccounts } from "@/lib/db/studio-writes";
import { count, naturalDate } from "@/lib/copy";

export default async function ClientsPage() {
  const me = await getCurrentPerson();
  await requireStudio("/studio/clients");
  const studio = await getStudio();
  const accounts = isDemoMode()
    ? clientAccounts.map((c) => ({ ...c, contact_name: c.contactName, contact_email: c.contactEmail, created_at: c.createdAt }))
    : await listClientAccounts();

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="" />
      <StudioPage>
        <StudioHeading
          title="Clients"
          sub="Each client is an account that outlives any one project — their brand library and preferences carry across."
          aside={
            can(me, "create_client") ? (
              <Link
                href="/studio/clients/new"
                className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-md bg-ink px-4 font-medium text-paper-raised"
              >
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                Add a client
              </Link>
            ) : null
          }
        />

        <ul className="stagger grid gap-3 lg:grid-cols-2">
          {accounts.map((c) => {
            const projects = studio.projects.filter((p) => p.clientName === c.name);
            return (
              <Card as="li" key={c.id} className="px-4 py-4">
                <h2 className="font-display text-title leading-tight font-semibold">{c.name}</h2>
                <Meta className="mt-1 block">
                  {c.contact_name} · {c.contact_email}
                </Meta>
                <Label className="mt-3 block">
                  {projects.length === 0 ? "No projects yet" : count(projects.length, "project")}
                </Label>
                {projects.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {projects.map((p) => (
                      <li key={p.id} className="text-small">
                        <Link
                          href={`/studio/p/${p.slug}`}
                          className="underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                        >
                          {p.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Meta className="mt-3 block">Client since {naturalDate(c.created_at)}</Meta>
              </Card>
            );
          })}
        </ul>
      </StudioPage>
    </div>
  );
}
