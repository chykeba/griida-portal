import { redirect } from "next/navigation";
import { AppHeader, Page } from "@/components/shell";
import { Notice } from "@/components/primitives";
import { LoginForm } from "@/components/login-form";
import { getUser, isDemoMode } from "@/lib/auth/dal";
import { safeNext } from "@/lib/auth/tokens";

export const metadata = { title: "Sign in — Griida" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null, "/");
  const problem = typeof params.problem === "string" ? params.problem : null;

  // Already signed in? Don't make them prove it twice.
  const user = await getUser();
  if (user) redirect(user.kind === "studio" ? "/studio" : "/");

  return (
    <>
      <AppHeader />
      <Page>
        <div className="animate-rise mx-auto max-w-md pt-12">
          <h1 className="font-display text-headline leading-tight font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="mt-2 leading-relaxed text-ink-soft">
            Pop in your email and we’ll send you a link. No password to
            remember, and nothing to set up.
          </p>

          {problem === "expired" ? (
            <div className="mt-5">
              <Notice tone="caution" title="That link has expired">
                Links last an hour and work once, for security. Enter your email
                and we’ll send a fresh one.
              </Notice>
            </div>
          ) : null}
          {problem === "used" ? (
            <div className="mt-5">
              <Notice tone="caution" title="That link has already been used">
                Each link works once. Enter your email and we’ll send another.
              </Notice>
            </div>
          ) : null}
          {problem === "invalid" ? (
            <div className="mt-5">
              <Notice tone="alert" title="We didn’t recognise that link">
                It may have been copied incompletely. Enter your email and we’ll
                send a new one.
              </Notice>
            </div>
          ) : null}

          {problem === "unavailable" ? (
            <div className="mt-5">
              <Notice tone="alert" title="We couldn’t check that link just now">
                That’s a fault on our side, not a problem with your link or your
                account. Try again in a minute — if it keeps happening, reply to
                any of our emails and we’ll sort it.
              </Notice>
            </div>
          ) : null}

          {isDemoMode() ? (
            <div className="mt-5">
              <Notice tone="neutral" title="This is the demo">
                No database is connected, so the portal is showing example data
                and needs no sign-in. Everything you see belongs to a fictional
                client.
              </Notice>
            </div>
          ) : (
            <div className="mt-6">
              <LoginForm next={next} />
            </div>
          )}
        </div>
      </Page>
    </>
  );
}
