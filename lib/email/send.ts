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

const FROM = process.env.EMAIL_FROM ?? "Griida <hello@griida.com>";
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
      throw new Error(
        `SES rejected the message. If the account is still in the sandbox it can ` +
          `only send to verified addresses — check the SES console, or request ` +
          `production access. (${name})`,
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
