import type { Household } from '../types.ts';
import { ValidationError } from '../types.ts';

const UNSUPPORTED_ARRAYS = [
  'onboardingAttestations', 'onboardingAttestationInvalidations', 'acceptedStarterPlans',
  'accountOpeningCheckpoints', 'accountHistoryApprovals', 'accountHistoryReviews',
] as const;

function hasUnsupportedFacts(h: Household | null): boolean {
  if (!h) return false;
  if (UNSUPPORTED_ARRAYS.some(key => {
    const value = h[key];
    return Array.isArray(value) ? value.length > 0 : value != null;
  })) return true;
  return h.transactions.some(row => row.historyCorrectionId !== undefined
    || row.openingSignedBalanceCents !== undefined || row.importSourceIdentity !== undefined
    || row.importSourceHash !== undefined);
}

function hasNewCurriculumMutation(previous: Household | null, candidate: Household): boolean {
  const before=previous?.householdOnboarding, after=candidate.householdOnboarding;
  if ((before?.registryVersion ?? 0) < 2 && (after?.registryVersion ?? 0) < 2) return false;
  const facts=(record: Household['householdOnboarding']) => record
    ? JSON.stringify(Object.fromEntries(Object.entries(record).filter(([key])=>key!=='registryVersion').sort(([a],[b])=>a.localeCompare(b))))
    : null;
  // Merely shaping an untouched v1 record to version 2 is not a new curriculum
  // action. New mode transitions are; their proof requires the current transport.
  return facts(before)!==facts(after);
}

/** Inspect raw source data: normalization alone must not turn v1 books into a compatibility refusal. */
export function assertLegacyOnboardingCompatible(previous: Household | null, candidate: Household): void {
  if (hasUnsupportedFacts(previous) || hasUnsupportedFacts(candidate)
    || hasNewCurriculumMutation(previous, candidate)) {
    throw new ValidationError('This ledger needs the current sync connection before it can save changes. Nothing was posted.');
  }
}
