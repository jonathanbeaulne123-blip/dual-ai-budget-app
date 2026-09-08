import type {
  Environment,
  PersonalEnvelope,
  SharedEnvelope,
  UndoToken,
  Transaction,
} from "../core/types.ts";
import type { CapturedIntent } from "./capture.ts";
import { digest } from "./patch.ts";
import type { ProjectionPatch } from "./patch.ts";
export type Scope = {
  identity?: { subject: string; email: string };
  environment: Environment;
  householdId: string;
  memberId: string;
  subject: string;
  role: "owner" | "member";
  expires: number;
  aclEpoch: number;
};
export type IntentStep = {
  kind: string;
  args: unknown[];
  previewIds: string[];
  reviewed: unknown[];
  resources: { key: string; hash: string }[];
};
export type LedgerCommand = {
  version: 2;
  /** Client understands signed openings and append-only account history lineage. */
  accountHistoryVersion?: 1;
  id: string;
  householdId: string;
  environment: Environment;
  observedSequence: number;
  steps: IntentStep[];
};
export type AcceptedEvent = {
  /** Author-only correlation; stripped for every other member. */
  confirmation?: { commandId: string; idMap: Record<string, string> };
  sequence: number;
  shared: ProjectionPatch;
  personal?: ProjectionPatch;
  memberId?: string;
  acceptedAt: string;
};
export type Receipt = {
  undoRelated?: {
    field: string;
    id: string;
    before: unknown;
    afterHash: string;
  }[];
  undoEligible?: boolean;
  undoOf?: string;
  undoRestore?: { before: Transaction; afterHash: string }[];
  id: string;
  sequence: number;
  digest: string;
  actor: string;
  postedIds: string[];
  warnings: string[];
  undo: Omit<UndoToken, "snapshot">;
  commandKind: string;
  persistenceScope?: "member-personal";
  personalMemberId?: string;
};
export type Replica = {
  sequence: number;
  shared: SharedEnvelope;
  personal: PersonalEnvelope;
};
export async function commandFromCapture(
  input: CapturedIntent,
  scope: Pick<Scope, "environment" | "householdId">,
  id: string,
): Promise<LedgerCommand> {
  const command: LedgerCommand = {
    version: 2,
    accountHistoryVersion: 1,
    id,
    ...scope,
    observedSequence: input.observedRevision,
    steps: await Promise.all(
      input.steps.map(async (step) => ({
        kind: step.kind,
        args: step.args,
        previewIds: step.previewIds,
        reviewed: step.reviewed,
        resources: await Promise.all(
          step.resources.map(async (r) => ({
            key: r.key,
            hash: await digest(JSON.parse(r.canonical)),
          })),
        ),
      })),
    ),
  };
  return parseCommand(command);
}
export function parseCommand(value: unknown): LedgerCommand {
  const c = value as LedgerCommand;
  if (
    !c ||
    c.version !== 2 ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(c.id) ||
    !["development", "production"].includes(c.environment) ||
    typeof c.householdId !== "string" ||
    !Number.isSafeInteger(c.observedSequence) ||
    c.observedSequence < 0 ||
    !Array.isArray(c.steps) ||
    c.steps.length < 1 ||
    c.steps.length > 20
  )
    throw new Error("INVALID_COMMAND");
  if (new TextEncoder().encode(JSON.stringify(c)).length > 128 * 1024)
    throw new Error("COMMAND_TOO_LARGE");
  const inspect = (v: unknown, depth: number) => {
    if (depth > 24) throw new Error("COMMAND_TOO_DEEP");
    if (
      typeof v === "number" &&
      (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER)
    )
      throw new Error("INVALID_NUMBER");
    if (v && typeof v === "object")
      for (const [key, child] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(key))
          throw new Error("INVALID_KEY");
        inspect(child, depth + 1);
      }
  };
  inspect(c, 0);
  for (const s of c.steps)
    if (
      !s ||
      typeof s.kind !== "string" ||
      !Array.isArray(s.args) ||
      s.args.length > 8 ||
      !Array.isArray(s.previewIds) ||
      !s.previewIds.every((id) => typeof id === "string") ||
      !Array.isArray(s.reviewed) ||
      !Array.isArray(s.resources) ||
      !s.resources.every(
        (r) => typeof r.key === "string" && /^[a-f0-9]{64}$/.test(r.hash),
      )
    )
      throw new Error("INVALID_COMMAND");
  return c;
}
