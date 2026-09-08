import { expect, it } from "vitest";
import { resolveOnboardingResume, type ReturnMessageRecord } from "../src/core/onboarding/returnMessage.ts";
import { throughSittingOne } from "./fixtures/onboardingReturnHousehold.ts";
it("resolves only the current actor's unfinished chapter in the current household and environment", () => {
  const h=throughSittingOne();
  const record:ReturnMessageRecord={environment:h.environment,householdId:h.householdId,memberId:'MEM-001',chapterId:'ch-04-accounts',tab:'ledger',setAt:'2026-09-08T17:00:00Z'};
  expect(resolveOnboardingResume(record,h,'MEM-001')).toEqual({chapterId:'ch-04-accounts',target:{tab:'ledger'}});
  for(const changed of [{...record,memberId:'MEM-002'},{...record,householdId:'foreign'},{...record,environment:'production' as const},{...record,tab:'more' as const},{...record,chapterId:'ch-03-charter'}]) expect(resolveOnboardingResume(changed,h,'MEM-001')).toBeNull();
  expect(resolveOnboardingResume(record,{...h,members:h.members.map(m=>({...m,active:false}))},'MEM-001')).toBeNull();
  expect(resolveOnboardingResume({...record,memberId:'MEM-002'},h,'MEM-002')).toBeNull();
});
