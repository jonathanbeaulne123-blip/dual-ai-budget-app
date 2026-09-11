// Fictional Kitty Bank Studio fixture: the real room over planLifeFixture books. Local proof only.
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KittyBankRoom } from '/src/kitty/KittyBankRoom.tsx';
import { planLifeFixture } from '/test/fixtures/plan-life.ts';
import { saveGoalEnvelope, fundGoal, allocateHouseholdFundSurplus } from '/src/core/index.ts';
import { defaultGoalEnvelope } from '/src/core/goalEnvelopes.ts';
import { newKittyPiece } from '/src/core/kittyStudio.ts';
import '/src/styles.css';
import '/src/hearth-theme.css';
const q = new URLSearchParams(location.search);
const view = (q.get('view') === 'personal' ? 'personal' : 'household') as 'personal' | 'household';
const theme = q.get('theme') || 'classic';
document.documentElement.dataset.theme = theme;
const member = 'MEM-001';
let initial = planLifeFixture(view);
const goal = initial.goals[0]!;
const seed = q.get('seed');
if (seed) {
  // A painted draft on the wheel, or a fired piece on the shelf.
  const piece = newKittyPiece('seed-piece', '2026-09-11T10:00:00.000Z', '#3f6fa3');
  piece.sculpt = { ...piece.sculpt, body: 'pear', head: 'chubby', ears: 'round', eyes: 'happy', mouth: 'smile', whiskers: 'long', tail: 'up', nose: 'heart', profile: [1.08, 0.9, 0.85, 0.62] };
  piece.paint = { base: '#3f6fa3', parts: { head: '#f6f1e7', earL: '#e8742d', earR: '#e8742d', tail: '#e3a534' }, strokes: [
    { part: 'body', tool: 'brush', color: '#f3e08a', size: 18, opacity: 0.9, mirror: true, pts: [0.42, 0.5, 0.45, 0.62, 0.5, 0.7] },
    { part: 'body', tool: 'sponge', color: '#ef8fb8', size: 30, opacity: 0.8, mirror: false, pts: [0.2, 0.4, 0.22, 0.45, 0.25, 0.5] },
    { part: 'head', tool: 'marker', color: '#a3283d', size: 10, opacity: 1, mirror: true, pts: [0.4, 0.6, 0.44, 0.66, 0.48, 0.7] },
  ], stamps: [ { id: 'st1', anchor: 'forehead', kind: 'star', color: '#e3a534', size: 0.22, rotation: 10 }, { id: 'st2', anchor: 'belly', kind: 'heart', color: '#a3283d', size: 0.26, rotation: 0 }, { id: 'st3', anchor: 'leftFlank', kind: 'initial', color: '#2b2926', size: 0.24, rotation: -10, text: 'JB' } ] };
  const studio = seed === 'fired' ? { version: 1 as const, draft: null, fired: [{ ...piece, firedAt: '2026-09-11T11:00:00.000Z', firedBy: member }] } : { version: 1 as const, draft: piece, fired: [] };
  initial = saveGoalEnvelope(initial, { goalId: goal.id, expectedUpdatedAt: goal.updatedAt, name: goal.name, target: goal.targetCents / 100, arrivalDate: goal.arrivalDate, envelope: { ...defaultGoalEnvelope(), studio }, createdBy: member }).household;
}
function Harness() {
  const [h, setH] = useState(initial);
  const ref = useRef(h); ref.current = h;
  (window as any).deposit = () => { const g = ref.current.goals[0]!; const next = view === 'personal' ? fundGoal(ref.current, { goalId: g.id, amount: 150, fromAccountId: 'ACC-CHEQUING', date: '2026-09-11', createdBy: member }).household : allocateHouseholdFundSurplus(ref.current, { memberId: member, date: '2026-09-11', allocations: [{ goalId: g.id, amount: '150' }] }).household; ref.current = next; setH(next); };
  return <KittyBankRoom household={h} view={view} memberId={member} identity={`development:fixture:${member}:${view}`} onClose={() => {}} onCommand={async (fn, options) => { const result = fn(ref.current); ref.current = result.household; setH(result.household); return { ok: true, household: result.household, confirmationId: options?.confirmationId }; }} />;
}
createRoot(document.getElementById('root')!).render(<Harness />);
