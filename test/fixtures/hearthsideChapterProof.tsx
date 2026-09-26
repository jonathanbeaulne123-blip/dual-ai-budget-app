import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CampfireRitual } from '../../src/campfire/CampfireRitual.tsx';
import { catalogHousehold } from '../../src/core/seed.ts';
import { addGoal, contributeToGoal } from '../../src/core/commands.ts';
import { openChapter } from '../../src/core/chapters.ts';
import type { Household, CommitResult } from '../../src/core/types.ts';
import '../../src/styles.css';
import '../../src/household-home.css';
import '../../src/theme/worlds.css';
import '../../src/theme/page-plan.css';
import { resolveThemeScene, sceneTokens, TAYLOR_SCENES, type ThemeId } from '../../src/theme/scenes.ts';
function setTheme(theme: ThemeId, dark = false) { const scene = dark ? TAYLOR_SCENES.reputation : resolveThemeScene(theme, 'plan', 'household'); const root = document.documentElement; root.dataset.theme = theme; root.dataset.scene = scene.id; root.dataset.sceneLighting = scene.dark ? 'dark' : 'light'; root.dataset.material = scene.material; root.dataset.worldPage = 'plan'; for (const [key,value] of Object.entries(sceneTokens(scene))) root.style.setProperty(key,value); }
setTheme('classic');
const initial = () => openChapter(catalogHousehold(), { memberId: 'MEM-001', foundationId: 'make-rent-boring', at: '2026-09-12T12:00:00Z' }).household;
declare global { interface Window { chapterProof: { household: () => Household; member: (id: string) => void; replace: (value: Household) => void; reset: () => void; funded: () => void; theme: (theme: ThemeId, dark?: boolean) => void } } }
function Proof() {
  const [household, setHousehold] = useState(initial), [memberId, setMember] = useState('MEM-001'), [error, setError] = useState('');
  window.chapterProof = { theme: setTheme, household: () => structuredClone(household), member: setMember, replace: setHousehold, reset: () => { setHousehold(initial()); setMember('MEM-001'); }, funded: () => { let h = openChapter(catalogHousehold(), { memberId: 'MEM-001', foundationId: 'build-breathing-room' }).household; h = addGoal(h, { name: 'Our breathing room', target: 100, shared: true }).household; h = contributeToGoal(h, h.goals[0]!.id, 3, { createdBy: 'MEM-001', date: '2026-09-12' }).household; setHousehold(h); setMember('MEM-001'); } };
  const run = async (command: (h: Household) => CommitResult) => { setError(''); try { const result = command(household); setHousehold(result.household); return { ok: true, household: result.household }; } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed'); throw cause; } };
  return <main style={{ maxWidth: 1080, margin: 'auto', padding: '20px 12px 180px' }}><nav aria-label="Synthetic proof controls"><p>Local synthetic Chapter proof · no account, network or payment</p><label>Current participant<select value={memberId} onChange={event => setMember(event.target.value)}>{household.members.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></nav>{error && <p role="alert">{error}</p>}<div className="proof-ritual"><CampfireRitual key={`${household.householdId}:${memberId}`} household={household} memberId={memberId} today="2026-09-12" onCommand={run} busy={false} onClose={() => undefined} /></div></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Proof /></StrictMode>);
