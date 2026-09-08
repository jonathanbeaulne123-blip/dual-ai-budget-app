// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingReady } from "../src/OnboardingReady.tsx";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import { approveOnboardingReady, assembleHousehold, chapterProgressSatisfied,
  completeHouseholdOnboarding, evidenceFor, householdGatesOutstanding, memberProgress,
  nextChapterFor, onboardingCompletionDigest, recordChapterAcknowledgement,
  reprobeMemberOnboardingProgress, splitForSync, memberRequirementSatisfied,
  requiredHouseholdChapters, onboardingReadyPresentation, acceptHouseholdWrite,
  acceptedHouseholdOnboarding, shapeMemberOnboardingProgress, emptyMemberOnboardingProgress,
  postEntry, updateAccount, mergeShared, type Household,
} from "../src/core/index.ts";
import { A,B, setupFacts, activeSetup, acknowledge, readySetup, practiceProof } from "./fixtures/onboarding-v2.ts";
import { clearCapturedIntent, capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ""; vi.useRealTimers(); });
describe("onboarding v2 audited flow regressions", () => {
  it("lets the accounts observer acknowledge accepted Shared facts and advance", () => {
    let h = setupFacts();
    for (const id of ["ch-01-meet", "ch-02-household", "ch-03-charter"]) h = acknowledge(h, B, id);
    expect(evidenceFor(h, "ch-04-accounts", B).kind).toBe("accepted");
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    act(() => root.render(createElement(OnboardingChat, { household: h, memberId: B, today: practiceProof(B).date,
      onCommit: fn => { h = fn(h).household; }, onDismiss: () => {}, onOpenAccounts: () => {} })));
    const next = [...host.querySelectorAll("button")].find(button => button.textContent === "Next");
    expect(next).toBeDefined(); act(() => next!.click());
    expect(nextChapterFor(h, B)?.id).toBe("ch-05-opening");
    act(() => root.unmount());
  });
  it("preserves both members' accepted gates while keeping each Personal progress private", () => {
    const h = readySetup(true);
    expect(householdGatesOutstanding(h)).toEqual([]);
    for (const memberId of [A,B]) {
      const { shared, personal } = splitForSync(h,memberId); const device = assembleHousehold(shared,personal);
      expect(device.members.find(member => member.id !== memberId)?.onboardingProgress).toBeUndefined();
      expect(JSON.stringify(shared)).not.toContain("PRACTICE-0123456789ABCDEF0123");
      expect(householdGatesOutstanding(device)).toEqual([]);
      expect(() => approveOnboardingReady(device,{memberId,createdBy:memberId,digest:onboardingCompletionDigest(device)})).not.toThrow();
    }
  });
  it("re-acknowledges restored evidence with a timestamp after lifecycle invalidation", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-08T15:00:00Z"));
    let h = setupFacts(); h = acknowledge(h,A,"ch-04-accounts");
    const accounts = h.accounts; h.accounts=[];
    h.members.find(m=>m.id===A)!.onboardingProgress = reprobeMemberOnboardingProgress(h,A,"2026-09-08T16:00:00Z");
    h.accounts=accounts; vi.setSystemTime(new Date("2026-09-08T17:00:00Z")); h=acknowledge(h,A,"ch-04-accounts");
    const row=memberProgress(h,A).rows.find(r=>r.chapterId==="ch-04-accounts")!;
    expect(row.acknowledgedAt).toBe("2026-09-08T17:00:00.000Z"); expect(chapterProgressSatisfied(row)).toBe(true);
    expect(memberRequirementSatisfied(h,A,"ch-04-accounts")).toBe(true);
  });
  it("saves the first person's Practice, waits, then both approve the complete accepted proof set", () => {
    let h=readySetup(); h=acknowledge(h,A,"ch-12-ready"); const pendingDigest=onboardingCompletionDigest(h);
    expect(()=>approveOnboardingReady(h,{memberId:A,createdBy:A,digest:pendingDigest})).toThrow(/every setup check/);
    expect(onboardingReadyPresentation(h,A,practiceProof(A).date)).toMatchObject({practiceAccepted:true,viewerApproved:false,bothApproved:false});
    h=acknowledge(h,B,"ch-12-ready"); const digest=onboardingCompletionDigest(h);
    expect(digest).not.toBe(pendingDigest);
    h=approveOnboardingReady(h,{memberId:A,createdBy:A,digest}).household;
    h=approveOnboardingReady(h,{memberId:B,createdBy:B,digest}).household;
    h=completeHouseholdOnboarding(h,{memberId:B,createdBy:B}).household;
    expect(acceptedHouseholdOnboarding(h)?.state).toBe("complete");
  });
  it("authority revokes changed Shared checks for both people and stale replicas cannot restore them", async () => {
    let h = readySetup(true); const original = h; const digest = onboardingCompletionDigest(h);
    const accept = async (before: Household, candidate: ReturnType<typeof updateAccount>) => {
      const outcome = await acceptHouseholdWrite({previous:before,candidate:candidate.household,
        confirmationId:crypto.randomUUID(),commandKind:candidate.undo.commandKind,postedIds:candidate.postedIds,
        actingMemberId:A,adapters:{persist:async()=>{},ingest:async()=>({ok:true})}});
      expect(outcome.ok, outcome.userMessage ?? undefined).toBe(true); return outcome.household;
    };
    const account=h.accounts[0]!;
    h=await accept(h,updateAccount(h,{accountId:account.id,name:"Changed Shared account"}));
    expect(h.onboardingAttestationInvalidations?.length).toBeGreaterThanOrEqual(2);
    h=await accept(h,updateAccount(h,{accountId:account.id,name:account.name}));
    const current=splitForSync(h,A), stale=splitForSync(original,B);
    const shared=mergeShared(current.shared,stale.shared);
    for (const memberId of [A,B]) {
      const device=assembleHousehold(shared,splitForSync(h,memberId).personal);
      expect(memberRequirementSatisfied(device,memberId,"ch-04-accounts")).toBe(false);
      expect(onboardingCompletionDigest(device)).not.toBe(digest);
    }
    const priorIds=h.onboardingAttestations!.map(f=>f.id);
    vi.useFakeTimers();vi.setSystemTime(new Date(Date.now()+1000));
    h=acknowledge(h,A,"ch-04-accounts");
    expect(h.onboardingAttestations!.some(f=>!priorIds.includes(f.id))).toBe(true);
    const oldClient=structuredClone(h);oldClient.onboardingAttestationInvalidations=[];
    const rejected=await acceptHouseholdWrite({previous:h,candidate:oldClient,confirmationId:crypto.randomUUID(),
      commandKind:"updateAccount",postedIds:[],actingMemberId:A,adapters:{persist:async()=>{},ingest:async()=>({ok:true})}});
    expect(rejected.ok).toBe(false);
  });
  it("shows a saved-Practice wait without offering premature Ready approval", () => {
    const h=acknowledge(readySetup(),A,"ch-12-ready");
    const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
    act(()=>root.render(createElement(OnboardingReady,{household:h,memberId:A,today:practiceProof(A).date,
      onCommit:async()=>null,onDismiss:()=>{}})));
    expect(host.textContent).toContain("Your Practice is saved");
    expect([...host.querySelectorAll("button")].some(b=>b.textContent==="I'm ready")).toBe(false);
    expect(host.querySelector('[role="alert"]')).toBeNull();act(()=>root.unmount());
  });
  it("captures the reviewed Ready digest and refuses a queued approval after facts change", async () => {
    const h=readySetup(true);const latest=structuredClone(h);latest.accounts[0]!.name="Changed while queued";
    let error: unknown;
    const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
    act(()=>root.render(createElement(OnboardingReady,{household:h,memberId:A,today:practiceProof(A).date,
      onCommit:async fn=>{try { fn(latest); } catch(e) { error=e; } return null;},onDismiss:()=>{}})));
    await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent==="I'm ready")!.click());
    expect(String(error)).toContain("every setup check");
    expect(host.querySelector('[role="alert"]')).not.toBeNull();act(()=>root.unmount());
  });
  it("requires Practice even when real expense evidence is available", () => {
    let h=readySetup(); h=postEntry(h,{date:practiceProof(A).date,type:"expense",amount:5,accountId:"ACC-CHEQUING",subcategoryId:"SUB-FOOD-GROCERIES",createdBy:A}).household;
    expect(onboardingReadyPresentation(h,A,practiceProof(A).date).proofAccepted).toBe(false);
    expect(()=>recordChapterAcknowledgement(h,{memberId:A,createdBy:A,chapterId:"ch-12-ready"})).toThrow(/Practice/);
  });
  it("has no Fund, credit-card, full-bill or work requirement and ordinary purchases keep the digest", () => {
    const h=readySetup(true); const digest=onboardingCompletionDigest(h);
    expect(requiredHouseholdChapters().map(c=>c.id)).not.toEqual(expect.arrayContaining(["ch-06-fund","ch-07-recurrences","ch-08-cadence"]));
    expect(h.householdFund).toBeFalsy(); expect(h.recurrences).toHaveLength(0);
    const next=postEntry(h,{date:practiceProof(A).date,type:"expense",amount:5,accountId:"ACC-CHEQUING",subcategoryId:"SUB-FOOD-GROCERIES",createdBy:A}).household;
    expect(onboardingCompletionDigest(next)).toBe(digest); expect(householdGatesOutstanding(next)).toEqual([]);
    next.accounts[0]!.name="A different Shared account";
    expect(householdGatesOutstanding(next)).toContain("ch-04-accounts");
  });
  it("rejects fabricated shared facts and another actor's acknowledgement at acceptance", async () => {
    const h=activeSetup(); const result=recordChapterAcknowledgement(h,{memberId:A,createdBy:A,chapterId:"ch-01-meet"});
    result.household.onboardingAttestations![0]!.memberId=B;
    const outcome=await acceptHouseholdWrite({previous:h,candidate:result.household,confirmationId:crypto.randomUUID(),commandKind:"recordChapterAcknowledgement",postedIds:result.postedIds,actingMemberId:A,adapters:{persist:async()=>{},ingest:async()=>({ok:true})}});
    expect(outcome.ok).toBe(false);
  });
  it("accepts acknowledgements through the real v2 server authority and replicates peer progress", async () => {
    const h=activeSetup(); const one=splitForSync(h,A),two=splitForSync(h,B);
    let state:AuthorityState={sequence:0,shared:one.shared,personal:new Map([[A,one.personal],[B,two.personal]])};
    for(const memberId of [A,B]) {
      const scope:Scope={environment:h.environment,householdId:h.householdId,memberId,subject:`test-${memberId}`,role:"owner",expires:Date.now()+60000,aclEpoch:1};
      const own=assembleHousehold(state.shared,state.personal.get(memberId)); clearCapturedIntent(own);
      const preview=recordChapterAcknowledgement(own,{memberId,createdBy:memberId,chapterId:"ch-01-meet"});
      const command=await commandFromCapture(capturedIntent(preview.household)!,scope,crypto.randomUUID());
      const accepted=await prepareCommand(state,command,scope,()=>{});
      state={sequence:accepted.receipt.sequence,shared:accepted.shared,personal:new Map([...state.personal,[memberId,accepted.personal]])};
    }
    const device=assembleHousehold(state.shared,state.personal.get(A));
    expect(memberRequirementSatisfied(device,A,"ch-01-meet")).toBe(true); expect(memberRequirementSatisfied(device,B,"ch-01-meet")).toBe(true);
  });
  it("migrates v1 identity-scoped progress without accepting old Ready or optional gates", () => {
    const h=activeSetup(); const progress=emptyMemberOnboardingProgress({environment:h.environment,householdId:h.householdId,memberId:A});
    progress.id=progress.id.replace(/v2$/,"v1"); progress.registryVersion=1; progress.rows[6]!.acknowledgedAt=new Date().toISOString();
    const migrated=shapeMemberOnboardingProgress(progress,{environment:h.environment,householdId:h.householdId,memberId:A})!;
    expect(migrated.registryVersion).toBe(2); expect(migrated.rows[6]!.acknowledgedAt).toBeTruthy();
    h.householdOnboarding!.registryVersion=1; h.members[0]!.onboardingProgress=progress;
    expect(nextChapterFor(h,A)?.id).toBe("ch-01-meet"); expect(onboardingCompletionDigest(h)).toMatch(/^ready-v2-/);
    h.householdOnboarding={...h.householdOnboarding!,state:"complete",completedAt:new Date().toISOString(),completionDigest:`ready-v1-${"a".repeat(64)}`};
    expect(acceptedHouseholdOnboarding(h)?.state).toBe("complete"); expect(householdGatesOutstanding(h)).toEqual([]);
    h.householdOnboarding.forcedUnlock=true; expect(acceptedHouseholdOnboarding(h)?.state).toBe("stopped-incomplete");
  });
});
