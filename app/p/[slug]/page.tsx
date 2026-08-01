import { notFound } from "next/navigation";
import { AppHeader, Footer, Page } from "@/components/shell";
import { WaitingList } from "@/components/waiting";
import { DeliverableCard, LinkRow } from "@/components/deliverable";
import { Timeline } from "@/components/timeline";
import {
  Badge,
  Card,
  EmptyState,
  Label,
  SectionHeading,
  StatusDot,
} from "@/components/primitives";
import { getProject, getWaitingOnYou, getWorkspace } from "@/lib/data";
import { empty, healthCopy, naturalAge, naturalDate } from "@/lib/copy";

/** Next 16: params is a Promise and must be awaited. */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const ws = await getWorkspace();
  const waiting = await getWaitingOnYou(project.id);
  const health = healthCopy(project.health, project.healthNote, project.targetEndOn);

  return (
    <>
      <AppHeader
        accountName={ws.accountName}
        back={{ href: "/", label: "All projects" }}
      />

      <Page>
        {/* --- Health banner: status, why, and when. Always together. --- */}
        <section className="animate-rise pt-8 pb-7">
          <Label className="mb-1.5 block">{project.typeName}</Label>
          <h1 className="font-display text-display leading-[1.1] font-semibold tracking-tight">
            {project.name}
          </h1>

          <p className="mt-4 flex items-start gap-2.5 font-display text-lead leading-snug">
            <StatusDot tone={health.tone} className="mt-2.5" />
            <span>{health.headline}</span>
          </p>
          {health.detail ? (
            <p className="mt-1.5 max-w-[46ch] pl-[1.125rem] leading-relaxed text-ink-soft">
              {health.detail}
            </p>
          ) : null}
        </section>

        {/* --- Where we are ------------------------------------------- */}
        <section className="mb-10">
          <SectionHeading>Where we are</SectionHeading>
          <Timeline milestones={project.milestones} />
        </section>

        {/* --- Needs you (scoped to this project) --------------------- */}
        <section id="needs-you" className="mb-10 scroll-mt-20">
          <SectionHeading
            aside={
              waiting.length > 0 ? (
                <Badge tone="caution">{waiting.length} open</Badge>
              ) : (
                <Badge tone="calm">All clear</Badge>
              )
            }
          >
            Needs you
          </SectionHeading>
          <WaitingList items={waiting} showProject={false} />
        </section>

        {/* --- Work: the emotional heart of the portal (§4) ------------ */}
        <section className="mb-10">
          <SectionHeading>The work</SectionHeading>
          {project.deliverables.length === 0 ? (
            <EmptyState
              headline={empty.deliverables.headline}
              body={empty.deliverables.body}
            />
          ) : (
            <div className="stagger space-y-3">
              {project.deliverables.map((d) => (
                <DeliverableCard key={d.id} deliverable={d} projectSlug={project.slug} />
              ))}
            </div>
          )}
        </section>

        {/* --- Updates ------------------------------------------------- */}
        <section className="mb-10">
          <SectionHeading>What’s happened</SectionHeading>
          {project.updates.length === 0 ? (
            <EmptyState headline={empty.updates.headline} body={empty.updates.body} />
          ) : (
            <ol className="stagger space-y-5">
              {project.updates.map((u) => (
                <li key={u.id} className="border-l-2 border-rule pl-4">
                  <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-faint">
                    {u.author} · {naturalAge(u.publishedAt)}
                  </p>
                  <p className="mt-1.5 leading-relaxed">{u.body}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* --- Decisions: ends the "I thought we agreed" conversation --- */}
        {project.decisions.length > 0 ? (
          <section className="mb-10">
            <SectionHeading>What we’ve agreed</SectionHeading>
            <Card className="divide-y divide-rule">
              {project.decisions.map((d) => (
                <div key={d.id} className="px-4 py-3">
                  <p className="text-small leading-relaxed">{d.summary}</p>
                  <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-faint">
                    {d.decidedBy} · {naturalDate(d.decidedOn)}
                  </p>
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        {/* --- Documents ------------------------------------------------ */}
        <section>
          <SectionHeading>Documents</SectionHeading>
          {project.documents.length === 0 ? (
            <EmptyState headline={empty.documents.headline} body={empty.documents.body} />
          ) : (
            <div className="stagger space-y-2">
              {project.documents.map((link) => (
                <LinkRow key={link.id} link={link} />
              ))}
            </div>
          )}
        </section>
      </Page>

      <Footer lastUpdated={project.lastUpdatedAt} />
    </>
  );
}
