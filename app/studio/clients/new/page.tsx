import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { ActionForm, Field, TextInput } from "@/components/studio/form";
import { Card, Notice } from "@/components/primitives";
import { createClientAction } from "../../actions";
import { requireStudio } from "@/lib/auth/dal";
import { getCurrentPerson } from "@/lib/studio/data";
import { can } from "@/lib/studio/permissions";

export default async function NewClientPage() {
  await requireStudio("/studio/clients/new");
  const me = await getCurrentPerson();

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="" />
      <StudioPage>
        <StudioHeading
          title="Add a client"
          sub="The account outlives any single project. Their brand library, preferences and past work all hang off it."
        />

        {!can(me, "create_client") ? (
          <Notice tone="alert" title="You can’t add clients">
            Project managers and super admins add clients. Ask one of them.
          </Notice>
        ) : (
          <Card className="max-w-xl px-5 py-5">
            <ActionForm action={createClientAction} submitLabel="Add client" busyLabel="Adding…">
              <Field
                label="Client name"
                name="name"
                required
                hint="The organisation, not the person. This is what appears on their portal."
              >
                <TextInput name="name" required placeholder="Ovis Health" autoFocus />
              </Field>

              <Field
                label="Main contact"
                name="contactName"
                hint="Whoever you’ll actually be talking to day to day."
              >
                <TextInput name="contactName" placeholder="Tunde" />
              </Field>

              <Field
                label="Their email"
                name="contactEmail"
                hint="Used to send their sign-in link. They never need a password."
              >
                <TextInput
                  name="contactEmail"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="tunde@ovishealth.com"
                />
              </Field>
            </ActionForm>
          </Card>
        )}
      </StudioPage>
    </div>
  );
}
