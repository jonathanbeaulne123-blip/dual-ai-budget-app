import { findActiveGoogleLink, normalizeGoogleEmail } from "../core/google.ts";
import type { Environment, Household } from "../core/types.ts";
import { googleConfigured, withGoogle } from "./engine.ts";

export type GoogleStepUpResult =
  | { kind: "skipped"; reason: "no-client" | "not-linked" | "no-member" }
  | { kind: "confirmed"; email: string; subject: string };

export async function confirmWithGoogleIfLinked(input: {
  household: Household;
  environment: Environment;
  memberId: string;
}): Promise<GoogleStepUpResult> {
  if (!input.memberId) return { kind: "skipped", reason: "no-member" };
  if (!googleConfigured()) return { kind: "skipped", reason: "no-client" };
  const link = findActiveGoogleLink(input.household, input.memberId);
  if (!link) return { kind: "skipped", reason: "not-linked" };
  const session = await withGoogle({
    environment: input.environment,
    memberId: input.memberId,
    householdId: input.household.householdId,
    services: ["identity"],
    stepUp: true,
    interactive: true,
    loginHint: link.email,
    fn: async (ctx) => ctx.session,
  });
  const signedEmail = normalizeGoogleEmail(session.identity.email);
  const linkedEmail = normalizeGoogleEmail(link.email);
  const sameSubject = Boolean(link.subject && session.identity.subject && link.subject === session.identity.subject);
  if (!sameSubject && signedEmail !== linkedEmail) {
    throw new Error(
      `Google signed in as ${session.identity.email}, not ${link.email}. Use the same account, or unlink in More.`,
    );
  }
  return {
    kind: "confirmed",
    email: session.identity.email,
    subject: session.identity.subject,
  };
}
