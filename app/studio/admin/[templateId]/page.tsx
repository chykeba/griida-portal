import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StudioHeader, StudioPage } from "@/components/studio/shell";
import { Badge, Card, Label, Meta, Notice } from "@/components/primitives";
import { TemplateEditor } from "@/components/studio/template-editor";
import { requireStudio, isDemoMode } from "@/lib/auth/dal";
import { getCurrentPerson } from "@/lib/studio/data";
import { can } from "@/lib/studio/permissions";
import { loadTemplate } from "@/lib/db/template-writes";
import { count } from "@/lib/copy";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  await requireStudio("/studio/admin");
  const me = await getCurrentPerson();
  if (isDemoMode()) notFound();

  const template = await loadTemplate(templateId);
  if (!template) notFound();

  const editable = template.status === "draft" && can(me, "author_templates");

  return (
    <div className="flex min-h-full flex-col bg-paper-sunk">
      <StudioHeader person={me} active="" />
      <StudioPage>
        <div className="animate-rise pt-8 pb-5">
          <Link
            href="/studio/admin"
            className="pressable -ml-2 mb-2 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-small text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
            All standards
          </Link>
          <Label className="mb-1 block">{template.projectTypeName}</Label>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-headline leading-tight font-semibold">
              {template.deliverableTypeName}
            </h1>
            <Badge tone={template.status === "published" ? "approved" : "neutral"}>
              v{template.version} · {template.status}
            </Badge>
          </div>
          <Meta className="mt-1 block">
            {count(template.items.length, "check")}
            {template.instancesUsing > 0
              ? ` · ${count(template.instancesUsing, "project")} shipped against this version`
              : ""}
          </Meta>
        </div>

        {template.status === "published" ? (
          <div className="mb-5">
            <Notice tone="neutral" title="Published versions are read-only">
              {template.instancesUsing > 0
                ? `${count(template.instancesUsing, "project")} already record having met this exact standard. Changing it would rewrite what they claim. Start v${template.version + 1} instead — projects already running keep their own snapshot either way.`
                : `Start v${template.version + 1} to change it. Projects already running keep their own snapshot either way.`}
            </Notice>
          </div>
        ) : null}

        <Card className="px-5 py-5">
          <TemplateEditor
            templateId={template.id}
            items={template.items}
            editable={editable}
          />
        </Card>
      </StudioPage>
    </div>
  );
}
