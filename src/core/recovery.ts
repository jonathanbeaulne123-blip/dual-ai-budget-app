import { booksEquation, compileHousehold, trialBalance } from "./journal.ts";
import { ensureHouseholdShape } from "./sync.ts";
import { ValidationError, type Environment, type Household } from "./types.ts";
import { financialAuditHash } from "./commandIdentity.ts";
import { shapeSharing } from "./sharing.ts";

export const HOUSEHOLD_EXPORT_KIND = "hearth-household-export" as const;
export const HOUSEHOLD_EXPORT_VERSION = 1;

export type HouseholdExport = {
  kind: typeof HOUSEHOLD_EXPORT_KIND;
  schemaVersion: number;
  environment: Environment;
  exportedAt: string;
  booksHash: string;
  household: Household;
};

export type RecoveryReport = {
  ok: boolean;
  environment: Environment;
  householdId: string;
  revision: number;
  linked: boolean;
  sharingMode: Household["sharing"]["mode"];
  booksHash: string | null;
  conflictCount: number;
  entryCount: number;
  inBalance: boolean;
  equationHolds: boolean;
  issues: string[];
};

export function redactedDiagnostics(household: Household, extras?: Partial<RecoveryReport>): RecoveryReport {
  const compiled = compileHousehold(household);
  const tb = trialBalance(compiled);
  const equation = booksEquation(compiled);
  const issues: string[] = [];
  if (!tb.inBalance) issues.push("Trial balance is off.");
  if (!equation.holds) issues.push("Accounting equation does not hold.");
  if ((household.conflicts ?? []).some((row) => !row.resolved)) issues.push("An unresolved sync conflict is waiting.");
  return {
    ok: issues.length === 0,
    environment: household.environment,
    householdId: household.householdId,
    revision: household.revision,
    linked: household.linked === true,
    sharingMode: shapeSharing(household).mode,
    booksHash: household.booksAcceptedHash ?? null,
    conflictCount: (household.conflicts ?? []).filter((row) => !row.resolved).length,
    entryCount: compiled.entries.length,
    inBalance: tb.inBalance,
    equationHolds: equation.holds,
    issues,
    ...extras,
  };
}

export async function makeHouseholdExport(household: Household): Promise<HouseholdExport> {
  const shaped = ensureHouseholdShape(household);
  const compiled = compileHousehold(shaped);
  const tb = trialBalance(compiled);
  const equation = booksEquation(compiled);
  if (!tb.inBalance || !equation.holds) {
    throw new ValidationError("This household is not balanced, so it cannot be exported as books.");
  }
  return {
    kind: HOUSEHOLD_EXPORT_KIND,
    schemaVersion: HOUSEHOLD_EXPORT_VERSION,
    environment: shaped.environment,
    exportedAt: new Date().toISOString(),
    booksHash: await financialAuditHash(shaped),
    household: shaped,
  };
}

export function parseHouseholdExport(raw: string): HouseholdExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("That file is not a Hearth household export.");
  }
  if (!parsed || typeof parsed !== "object") throw new ValidationError("That export is empty.");
  const record = parsed as Record<string, unknown>;
  if (record.kind === HOUSEHOLD_EXPORT_KIND) {
    if (record.schemaVersion !== HOUSEHOLD_EXPORT_VERSION) {
      throw new ValidationError("That export was written by a different Hearth schema. It was not imported.");
    }
    if (!record.household || typeof record.household !== "object") {
      throw new ValidationError("That export is missing a household snapshot.");
    }
    return {
      kind: HOUSEHOLD_EXPORT_KIND,
      schemaVersion: HOUSEHOLD_EXPORT_VERSION,
      environment: (record.environment as Environment) ?? (record.household as Household).environment,
      exportedAt: String(record.exportedAt ?? ""),
      booksHash: String(record.booksHash ?? ""),
      household: ensureHouseholdShape(record.household as Household),
    };
  }
  if (record.version === 1 && record.householdId && Array.isArray(record.transactions)) {
    const household = ensureHouseholdShape(record as unknown as Household);
    return {
      kind: HOUSEHOLD_EXPORT_KIND,
      schemaVersion: HOUSEHOLD_EXPORT_VERSION,
      environment: household.environment,
      exportedAt: household.lastCommittedAt ?? "",
      booksHash: "",
      household,
    };
  }
  throw new ValidationError("That file is not a Hearth household export.");
}

export async function validateHouseholdImport(
  raw: string,
  operatingEnvironment: Environment,
  options: { confirm: boolean },
): Promise<{ household: Household; report: RecoveryReport }> {
  if (!options.confirm) {
    throw new ValidationError("Import needs an explicit Confirm. The live household was left alone.");
  }
  const file = parseHouseholdExport(raw);
  if (file.household.environment !== operatingEnvironment) {
    throw new ValidationError(
      `That file is a ${file.household.environment} household. You are in ${operatingEnvironment}, so it was not imported.`,
    );
  }
  const household = ensureHouseholdShape(file.household);
  const compiled = compileHousehold(household);
  const tb = trialBalance(compiled);
  const equation = booksEquation(compiled);
  if (!tb.inBalance || !equation.holds) {
    throw new ValidationError("That import would create unbalanced books. The live household was left alone.");
  }
  const hash = await financialAuditHash(household);
  if (file.booksHash && file.booksHash !== hash) {
    throw new ValidationError("That export's books hash does not match its snapshot. The live household was left alone.");
  }
  return {
    household: { ...household, booksAcceptedHash: hash },
    report: redactedDiagnostics(household, { booksHash: hash, ok: true }),
  };
}
