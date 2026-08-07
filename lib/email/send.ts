import "server-only";

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  magicLinkEmail,
  reviewReadyEmail,
  teamInviteEmail,
  updatePublishedEmail,
  type EmailBody,
} from "./content.ts";

/**
 * Email via Amazon SES.
 *
 * **Why the credentials are `SES_`-prefixed rather than `AWS_`:** Vercel
 * functions run on AWS Lambda, and Lambda populates `AWS_ACCESS_KEY_ID`,
 * `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` and `AWS_SESSION_TOKEN` with its own
 * execution-role credentials. Using those names invites a collision where the
 * SDK silently picks up Vercel's role instead of your SES user and fails with a
 * confusing permissions error. Own names, passed explicitly, no credential
 * chain, no ambiguity.
 *
 * With no credentials configured the send is logged rather than performed, so
 * the auth flow is walkable locally before SES is wired.
 */

/**
 * The sender, always with a display name.
 *
 * A bare address leaves the mail client to invent one from the local part, so
 * `hello@…` was arriving as "Hello" — a stranger's first impression of the
 * studio. If EMAIL_FROM already carries a name in angle-bracket form it is
 * used as given; a bare address gets one attached.
 */
const SENDER_NAME = process.env.EMAIL_FROM_NAME ?? "Griida Projects";

export function senderAddress(configured = process.env.EMAIL_FROM ?? "hello@griida.com"): string {
  return configured.includes("<") ? configured : `${SENDER_NAME} <${configured.trim()}>`;
}

const FROM = senderAddress();
const REPLY_TO = process.env.EMAIL_REPLY_TO;

interface SesConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function readConfig(): SesConfig | null {
  const region = process.env.SES_REGION;
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) return null;
  return { region, accessKeyId, secretAccessKey };
}

export function isEmailConfigured(): boolean {
  return readConfig() !== null;
}

/** Which region we're actually sending through. Surfaced so it can be checked. */
export function emailRegion(): string | null {
  return readConfig()?.region ?? null;
}

/** One client per lambda instance rather than per send. */
let cached: SESv2Client | null = null;

function client(config: SesConfig): SESv2Client {
  if (!cached) {
    cached = new SESv2Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return cached;
}

async function send(to: string, body: EmailBody): Promise<void> {
  const config = readConfig();

  if (!config) {
    // Not an error — the flow is meant to work before SES exists. The login
    // screen surfaces the link directly outside production.
    console.info(`[email] not configured; would send to ${to}\n${body.subject}\n${body.text}`);
    return;
  }

  try {
    await client(config).send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: [to] },
        ReplyToAddresses: REPLY_TO ? [REPLY_TO] : undefined,
        Content: {
          Simple: {
            Subject: { Data: body.subject, Charset: "UTF-8" },
            Body: {
              // Both parts, always. Text-only looks broken in modern clients;
              // HTML-only trips spam filters and fails in text-mode readers.
              Text: { Data: body.text, Charset: "UTF-8" },
              Html: { Data: body.html, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
  } catch (error) {
    // Rethrow with something a human can act on. SES's own errors are precise
    // but jargon-heavy, and the two below account for most first-run failures.
    const name = error instanceof Error ? error.name : "Unknown";
    if (name === "MessageRejected") {
      // The region is named because sandbox status, production access and
      // verified identities are all PER-REGION. Getting production access in
      // one region and pointing SES_REGION at another looks exactly like
      // never having asked for it, and the error alone gave no way to tell.
      throw new Error(
        `SES rejected this in ${config.region}. Sandbox status, production access and ` +
          `verified identities are all per-region — if you were granted production ` +
          `access in a different region, this one is still sandboxed and will only ` +
          `send to verified addresses. (${name})`,
      );
    }
    if (name === "NotFoundException" || name === "BadRequestException") {
      throw new Error(
        `SES refused the sender "${FROM}". The From address or its domain has to ` +
          `be a verified identity in ${config.region}. (${name})`,
      );
    }
    throw error;
  }
}

export async function sendMagicLink(to: string, url: string): Promise<void> {
  await send(to, magicLinkEmail(url));
}

export async function sendUpdate(
  to: string,
  params: { firstName: string; projectName: string; body: string; url: string },
): Promise<void> {
  await send(to, updatePublishedEmail(params));
}

export async function sendTeamInvite(
  to: string,
  params: {
    firstName: string;
    invitedBy: string;
    roleLabel: string;
    roleBlurb: string;
    loginUrl: string;
  },
): Promise<void> {
  await send(to, teamInviteEmail(params));
}

export async function sendReviewReady(
  to: string,
  params: { firstName: string; projectName: string; deliverableName: string; url: string },
): Promise<void> {
  await send(to, reviewReadyEmail(params));
}
