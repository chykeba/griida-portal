import { StudioHeader, StudioHeading, StudioPage } from "@/components/studio/shell";
import { Card, Meta } from "@/components/primitives";
import { PasswordForm } from "@/components/studio/password-form";
import { isDemoMode, requireStudio } from "@/lib/auth/dal";
import { getCurrentPerson } from "@/lib/studio/data";
import { hasPassword } from "@/lib/auth/session";

export const metadata = { title: "Your account — Griida Studio" };

export default async function AccountPage() {
  const user = await requireStudio("/studio/account");
  const me = await getCurrentPerson();
  const already = isDemoMode() ? false : await hasPassword(user.id);

  return (
    <>
      <StudioHeader person={me} active="" />
      <StudioPage>
        <StudioHeading title="Your account" sub={user.email} />

        <Card className="mt-6 max-w-xl px-5 py-5">
          <h2 className="font-display text-lead font-semibold">How you sign in</h2>
          <p className="mt-1.5 mb-4 max-w-[58ch] text-small leading-relaxed text-ink-soft">
            {already
              ? "You sign in with your email and password. A link by email still works too — it’s how you get back in if you forget."
              : "Right now you sign in with a link by email. Set a password and you can skip that step; the link keeps working either way, so there’s nothing to lose and no reset flow to remember."}
          </p>
          <PasswordForm hasPassword={already} />
        </Card>

        <Meta className="mt-4 block max-w-[58ch]">
          Clients always sign in with a link. They’re here every few weeks, not
          every day, and a password would be one more thing for them to lose.
        </Meta>
      </StudioPage>
    </>
  );
}
