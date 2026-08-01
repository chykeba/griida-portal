import Link from "next/link";
import { AppHeader, Page } from "@/components/shell";
import { errors } from "@/lib/copy";

export default function NotFound() {
  const copy = errors.notFound;
  return (
    <>
      <AppHeader />
      <Page>
        <div className="animate-rise pt-16">
          <h1 className="font-display text-headline leading-tight font-semibold tracking-tight">
            {copy.headline}
          </h1>
          <p className="mt-2 max-w-[46ch] leading-relaxed text-ink-soft">{copy.body}</p>
          <Link
            href="/"
            className="pressable mt-6 inline-flex min-h-12 items-center rounded-md bg-ink px-5 font-medium text-paper-raised"
          >
            {copy.action}
          </Link>
        </div>
      </Page>
    </>
  );
}
