import { describe, expect, it } from 'vitest';
import { acknowledgeHouseholdPlan, appendPlanSitdownTurn, assembleHousehold, createPlanScenario, executeHerculesReadToolPlan, planDigest, savePlanBridgeDraft, sharePlanBridgeDraft, splitForSync } from '../src/core/index.ts';
import { executeReviewedAction, findHerculesAction, prepareAction, type ActionContext } from '../src/core/herculesActions.ts';
import { planSelectionForDraft, projectPlan, rehearsePlanPurchase } from '../src/core/planProjection.ts';
import { planLifeFixture } from './fixtures/plan-life.ts';
const memberId = 'MEM-001', today = '2026-09-11';
describe('Plan life agreement and conversation contracts', () => {
  it.each(['household', 'personal'] as const)('uses exactly the UI purchase projection in Hercules (%s)', view => {
    const h = planLifeFixture(view), draft = h.planDrafts![0]!;
    const projection = projectPlan(h, { memberId, scope: view, acceptedRevision: h.revision, asOf: today, through: '2026-10-11', selection: planSelectionForDraft(draft) });
    const result = executeHerculesReadToolPlan(h, { calls: [{ name: 'plan_cashflow_runway', args: {} }] }, today, { memberId, view, privatePlanPreparation: true, plan: { scope: view, monthKey: '2026-09', draftId: draft.id, through: '2026-10-11', purchase: { amountCents: 12000, date: today } } });
    expect(result.results[0]!.payload!.projection).toEqual(projection);
    expect(result.results[0]!.payload!.purchase).toEqual(rehearsePlanPurchase(projection, 12000, today));
    expect(result.results[0]!.facts[0]!.source.planDraftId).toBe(draft.id);
    expect(result.results[0]!.facts[0]!.source.planVersionId).toBeUndefined();
  });
  it.each(['household', 'personal'] as const)('reviews an editable Plan change privately and invalidates stale evidence (%s)', view => {
    const h = planLifeFixture(view), before = JSON.stringify(h), draft = h.planDrafts![0]!;
    const c: ActionContext = { household: h, memberId, view, today };
    const values = { planLineId: 'life-trip', amount: '150', draftId: draft.id };
    expect(findHerculesAction('Change a Plan decision', c)?.id).toBe('plan-line-change');
    const review = prepareAction(c, 'plan-line-change', values);
    expect(JSON.stringify(h)).toBe(before);
    const result = executeReviewedAction(c, review, crypto.randomUUID());
    expect(result.household.transactions).toEqual(h.transactions);
    expect(result.household.planVersions).toEqual(h.planVersions);
    expect(result.household.planDrafts![0]!.lines.find(row => row.id === 'life-trip')).toMatchObject({ amountCents: 15000, dueDate: '2026-09-25', decision: { timeConstraint: 'Keep Friday evenings free.' } });
    expect(result.household.planDrafts![0]!.note).toBe(draft.note);
    expect(() => executeReviewedAction({ ...c, household: result.household }, review, crypto.randomUUID())).toThrow(/changed/i);
    expect(() => prepareAction({ ...c, memberId: 'MEM-002' }, 'plan-line-change', values)).toThrow();
    expect(JSON.stringify(splitForSync(result.household, 'MEM-002').personal)).not.toContain('Keep Friday evenings free.');
  });
  it('rejects stale alternative and exact Bridge disclosure saves', () => {
    let h = planLifeFixture('household');
    h = createPlanScenario(h, { memberId, createdBy: memberId, scope: 'household', draftId: 'LIFE-DRAFT', name: 'Later', changedLines: h.planDrafts![0]!.lines }).household;
    const alternative = h.planScenarios![0]!;
    expect(() => createPlanScenario(h, { ...alternative, memberId, createdBy: memberId, expectedUpdatedAt: 'stale' })).toThrow(/changed/i);
    expect(() => createPlanScenario(h, { ...alternative, memberId, createdBy: memberId, changedLines: alternative.changedLines.map(row => ({ ...row, decision: { ...row.decision, targetCents: Number.MAX_SAFE_INTEGER + 1 } })) })).toThrow(/Review/);
    h = savePlanBridgeDraft(h, { memberId, createdBy: memberId, monthKey: '2026-09', kind: 'constraint', label: 'Friday evenings', expectedDate: '2026-09-18' }).household;
    const bridge = h.planBridgeDrafts![0]!;
    expect(() => sharePlanBridgeDraft(h, { memberId, createdBy: memberId, draftId: bridge.id, expectedUpdatedAt: 'stale' })).toThrow(/changed/);
    const shared = sharePlanBridgeDraft(h, { memberId, createdBy: memberId, draftId: bridge.id, expectedUpdatedAt: bridge.updatedAt }).household;
    expect(shared.planBridgeDecisions![0]!.label).toBe('Friday evenings');
  });
  it('preserves independent agreement and resumable Chapter progress across envelopes', () => {
    let h = planLifeFixture('household');
    const version = h.planVersions![0]!, digest = planDigest(version);
    expect(() => appendPlanSitdownTurn(h, { memberId, monthKey: '2026-09', sitDownSessionId: 'chapter', planDraftId: 'LIFE-DRAFT', text: 'Close', checkpoint: { stage: 7, close: true, planVersionId: version.id } })).toThrow();
    for (const actor of [memberId, 'MEM-002']) h = acknowledgeHouseholdPlan(h, { memberId: actor, createdBy: actor, planVersionId: version.id, expectedDigest: digest }).household;
    h = appendPlanSitdownTurn(h, { memberId, monthKey: '2026-09', sitDownSessionId: 'chapter', planDraftId: 'LIFE-DRAFT', text: 'Choose a rhythm', checkpoint: { stage: 4, decision: 'Get two quotes', rhythm: 'Sunday ten minutes' } }).household;
    const session = h.planHerculesSessions![0]!;
    const parts = splitForSync(h, 'MEM-002'), restored = assembleHousehold(parts.shared, parts.personal);
    expect(restored.planHerculesSessions![0]).toMatchObject({ stage: 4, rhythm: 'Sunday ten minutes', decisions: [{ text: 'Get two quotes' }] });
    expect(() => appendPlanSitdownTurn(restored, { memberId: 'MEM-002', monthKey: '2026-09', sitDownSessionId: 'chapter', sessionId: session.id, planDraftId: 'LIFE-DRAFT', text: 'Advance', expectedUpdatedAt: 'stale', checkpoint: { stage: 5 } })).toThrow(/changed/i);
    const closed = appendPlanSitdownTurn(restored, { memberId: 'MEM-002', monthKey: '2026-09', sitDownSessionId: 'chapter', sessionId: session.id, planDraftId: 'LIFE-DRAFT', text: 'Carry it forward', expectedUpdatedAt: session.updatedAt, checkpoint: { stage: 7, close: true, planVersionId: version.id } }).household;
    expect(closed.planHerculesSessions![0]!.state).toBe('closed');
    expect(closed.planVersions![0]!.digest).toBe(digest);
    expect(closed.transactions).toEqual(h.transactions);
  });
  it('keeps unavailable private selections from falling back to another Plan', () => {
    const h = planLifeFixture('household');
    const result = executeHerculesReadToolPlan(h, { calls: [{ name: 'plan_overview', args: {} }] }, today, { memberId: 'MEM-002', view: 'household', privatePlanPreparation: true, plan: { scope: 'household', monthKey: '2026-09', draftId: 'LIFE-DRAFT' } });
    expect(result.results[0]!.status).not.toBe('ok');
    expect(JSON.stringify(result)).not.toContain('Fictional private preparation');
  });
});

describe('Plan decision protocol preservation', () => {
 it('replays new decisions and refuses a writer that would drop the additive fields', async () => {
  const { capturedIntent, clearCapturedIntent } = await import('../src/ledgerSync/capture.ts');
  const { commandFromCapture } = await import('../src/ledgerSync/protocol.ts');
  const { prepareCommand } = await import('../src/ledgerSync/authority.ts');
  const { savePlanDraft } = await import('../src/core/index.ts');
  const h=planLifeFixture('household'), one=splitForSync(h,memberId), two=splitForSync(h,'MEM-002');
  const scope={environment:h.environment,householdId:h.householdId,memberId,subject:'fictional-subject',role:'owner' as const,expires:Date.now()+60000,aclEpoch:1};
  const state={sequence:h.revision,shared:one.shared,personal:new Map([[memberId,one.personal],['MEM-002',two.personal]])};
  clearCapturedIntent(h);
  const candidate=savePlanDraft(h,{...h.planDrafts![0]!,memberId,createdBy:memberId,note:'Updated privately'});
  const command=await commandFromCapture(capturedIntent(candidate.household)!,scope,crypto.randomUUID());
  expect(command.planDecisionVersion).toBe(1);
  const accepted=await prepareCommand(state,command,scope,()=>{});
  expect(accepted.personal.planDrafts![0]!.lines[1]!.decision).toEqual(h.planDrafts![0]!.lines[1]!.decision);
  await expect(prepareCommand(state,{...command,planDecisionVersion:undefined},scope,()=>{})).rejects.toThrow(/CLIENT_RELOAD_REQUIRED/);
 });
});

describe('deliberate private life preferences', () => {
 it('keeps remember, edit and forget private and excludes them from shared facilitation', () => {
  const c:ActionContext={household:planLifeFixture('household'),memberId,view:'household',today};
  const remember={operation:'remember',preference:'PRIVATE PREFERENCE: Friday evenings matter'};
  const review=prepareAction(c,'plan-coaching-preference',remember);
  expect(c.household.planCoachingPreferences??[]).toEqual([]);
  c.household=executeReviewedAction(c,review,crypto.randomUUID()).household;
  const parts=splitForSync(c.household,memberId);
  expect(JSON.stringify(parts.shared)).not.toContain('PRIVATE PREFERENCE');
  const shared=executeHerculesReadToolPlan(c.household,{calls:[{name:'plan_overview',args:{}}]},today,{memberId,view:'household',plan:{scope:'household',monthKey:'2026-09'}});
  expect(JSON.stringify(shared)).not.toContain('PRIVATE PREFERENCE');
  const own=executeHerculesReadToolPlan(c.household,{calls:[{name:'plan_overview',args:{}}]},today,{memberId,view:'household',privatePlanPreparation:true,plan:{scope:'household',monthKey:'2026-09',draftId:'LIFE-DRAFT'}});
  expect(own.talk.spoken).toContain('Friday evenings matter');
  c.household=executeReviewedAction(c,prepareAction(c,'plan-coaching-preference',{operation:'forget',preference:remember.preference}),crypto.randomUUID()).household;
  expect(c.household.planCoachingPreferences![0]!.lifePreferences).toEqual([]);
 });
});


it('keeps ordinary conversation preferences out of the Plan action router', async()=>{
 const {findHerculesAction}=await import('../src/core/herculesActions.ts');
 const c={household:planLifeFixture('personal'),memberId:'MEM-001',view:'personal' as const,today:'2026-09-11'};
 expect(findHerculesAction('Forget that preference',c)?.id).not.toBe('plan-coaching-preference');
 expect(findHerculesAction('Remember that keep answers short',c)?.id).not.toBe('plan-coaching-preference');
 expect(findHerculesAction('Remember a Plan coaching preference',c)?.id).toBe('plan-coaching-preference');
});
