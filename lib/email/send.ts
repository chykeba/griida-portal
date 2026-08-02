import "server-only";

/**
 * Email sending.
 *
 * No provider is wired yet, so this logs and returns. That is deliberate rather
 * than pretending: the auth flow is complete and correct, and the only missing
 * piece is a transactional email account. Add RESEND_API_KEY and the branch
 * below starts sending for real, with nothing else to change.
 *
 * §6b: the sign-in link is the whole client experience of authentication, so
 * when this does go live the email needs the same care as the portal — plain
 * language, one obvious action, no marketing chrome.
 */

export interface EmailAddress {
  email: string;
}

const FROM = process.env.EMAIL_FROM ?? "Griida <hello@griida.com>";

export async function sendMagicLink(to: string, url: string): Promise<void> {
  const subject = "Your sign-in link";
  const text = [
    "Here's your link to sign in to the Griida portal:",
    "",
    url,
    "",
    "It works once and lasts an hour. If you didn't ask for it, you can ignore",
    "this — nobody can get in without the link.",
  ].join("\n");

  await send({ to, subject, text });
}

async function send({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Not an error: the flow is meant to work locally without an email account.
    // The login screen surfaces the link directly outside production.
    console.info(`[email] would send to ${to}: ${subject}\n${text}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, text }),
  });

  if (!response.ok) {
    // Surfaced to the caller so the user is told honestly that it didn't send,
    // rather than being left waiting for an email that will never arrive.
    throw new Error(`Email send failed: ${response.status}`);
  }
}
