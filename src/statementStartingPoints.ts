import { useEffect, useMemo, useState } from "react";
import { acceptedAccountOpeningCoverage, type Household, type LedgerView } from "./core/index.ts";
import { emptyStatementDraft, loadStatementSuggestionHandoff } from "./imports/statementSetup/drafts.ts";
import { statementSetupSuggestions } from "./imports/statementSetup/suggestions.ts";
import type { StatementSuggestion } from "./imports/statementSetup/types.ts";
import { todayKey } from "./core/calendar.ts";

export function useStatementStartingPoints(household: Household, memberId: string, authUserId: string, view: LedgerView = "household") {
  const [selected, setSelected] = useState<StatementSuggestion[]>([]);
  const [loadError, setLoadError] = useState("");
  const scope = useMemo(() => ({ environment: household.environment, householdId: household.householdId, memberId, authUserId, view }), [household.environment, household.householdId, memberId, authUserId, view]);
  useEffect(() => { let live = true; setSelected([]); setLoadError("");
    void loadStatementSuggestionHandoff(scope).then(rows => { if (live) setSelected(rows); }).catch(() => { if (live) setLoadError("Saved statement suggestions could not be loaded. You can still choose your own starting points."); });
    return () => { live = false; };
  }, [scope]);
  const derived = useMemo(() => {
    const coverage = acceptedAccountOpeningCoverage(household, { visibility: view, memberId });
    return statementSetupSuggestions({ household, scope, draft: emptyStatementDraft(scope), today: todayKey(), acceptedCoverage: coverage.checkpoints.flatMap(checkpoint => (checkpoint.statementCoverage ?? []).map(span => ({ accountId: checkpoint.accountId, from: span.start, through: span.end, sourceIds: [checkpoint.confirmationId] }))) });
  }, [household, scope, memberId, view]);
  return { selected, estimates: derived.suggestions.filter(row => row.kind === "estimate"), estimateStatus: derived.estimateStatus, loadError };
}
