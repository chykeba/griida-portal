import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { Badge, Card, Label, Meta, Notice } from "@/components/primitives";
import { requireStudio, isDemoMode } from "@/lib/auth/dal";
import { getCurrentPerson } from "@/lib/studio/data";
import { can } from "@/lib/studio/permissions";
import { listDeliverableTypes } from "@/lib/db/template-writes";
import { openDraftAction } from "./actions";
import { count } from "@/lib/copy";
import Link from "next/link";

export const metadata = { title: "SOP templates — internal" };

/**
 * The SOP library.
 *
 * This is the studio's actual IP — the definition of "done" for each kind of
 * work. Authoring is super-admin only (§3b), because a standard anyone can
 * quietly weaken isn't a standard.
 */
export default async function AdminPage() {
  await requireStudio("/studio/admin");
  const me = await getCurrentPerson();
  const allowed = can(me, "author_templates");
  const rows = isDemoMode() ? [] : await listDeliverableTypes();

  // One row per deliverable type; a draft alongside a published version means
  // work in progress on that standard.
  const byType = new Map<string, typeof rows>();
  for (const r of rows) {
    byType.set(r.id, [...(byType.get(r.id) ?? []), r]);
  }

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="" />
      <StudioPage>
        <StudioHeading
          title="Delivery standards"
          sub="What “done” means for each kind of work. Every project instantiates a snapshot of these, so editing one never changes a project already running."
        />

        {!allowed ? (
          <Notice tone="neutral" title="Only a super admin can author these">
            That’s deliberate — the role that defines the standard is the same
            one that controls who can sign it off.
          </Notice>
        ) : null}

        {isDemoMode() ? (
          <Notice tone="neutral" title="Demo mode">
            No database connected, so there’s nothing to author.
          </Notice>
        ) : (
          <div className="space-y-3">
            {[...byType.values()].map((versions) => {
              const published = versions.find((v) => v.status === "published");
              const draft = versions.find((v) => v.status === "draft");
              const type = versions[0];

              return (
                <Card key={type.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Label className="mb-1 block">{type.project_type_name}</Label>
                      <h2 className="font-display text-title leading-tight font-semibold">
                        {type.name}
                      </h2>
                      <Meta className="mt-1 block">
                        {published
                          ? `v${published.version} · ${count(published.items, "check")}`
                          : "No standard yet — anything of this type publishes unchecked"}
                        {draft ? ` · draft v${draft.version} in progress` : ""}
                      </Meta>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {published ? (
                        <Badge tone="approved">Published v{published.version}</Badge>
                      ) : (
                        <Badge tone="caution">No standard</Badge>
                      )}
                      {draft ? <Badge tone="neutral">Draft v{draft.version}</Badge> : null}
                    </div>
                  </div>

                  {allowed ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {draft ? (
                        <Link
                          href={`/studio/admin/${draft.template_id}`}
                          className="pressable inline-flex min-h-10 items-center rounded-md bg-ink px-4 text-small font-medium text-paper-raised"
                        >
                          Continue draft
                        </Link>
                      ) : (
                        <form action={openDraftAction}>
                          <input type="hidden" name="deliverableTypeId" value={type.id} />
                          <button
                            type="submit"
                            className="pressable inline-flex min-h-10 items-center rounded-md border border-rule-interactive px-4 text-small font-medium"
                          >
                            {published && published.version !== null
                              ? `Start v${published.version + 1}`
                              : "Create a standard"}
                          </button>
                        </form>
                      )}
                      {published ? (
                        <Link
                          href={`/studio/admin/${published.template_id}`}
                          className="pressable inline-flex min-h-10 items-center rounded-md border border-rule px-4 text-small"
                        >
                          View published
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </StudioPage>
    </div>
  );
}
