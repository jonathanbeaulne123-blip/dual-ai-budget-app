import ts from 'typescript';
import {readFile,writeFile} from 'node:fs/promises';
const registry=await readFile('src/ledgerSync/registry.ts','utf8'),actions=(await Promise.all(['src/core/herculesActions.ts','src/core/herculesAppointmentActions.ts','src/core/herculesCompanionActions.ts'].map(path=>readFile(path,'utf8')))).join('\n'),tools=await readFile('src/core/herculesTools.ts','utf8');
const names=new Set([...registry.matchAll(/register\(\s*([`"])(.*?)\1/gs)].flatMap(m=>m[2].split(/\s+/).filter(Boolean)));
for(const m of registry.matchAll(/\["([A-Za-z]+)",\s*\d,\s*"/g))names.add(m[1]);names.add('buildBatchImport');
const mapping=new Map();
const source=ts.createSourceFile('herculesActions.ts',actions,ts.ScriptTarget.Latest,true);
function inspect(node){
 if(ts.isObjectLiteralExpression(node)){
  const identity=node.properties.find(p=>ts.isPropertyAssignment(p)&&p.name?.getText(source)==='id');
  const execute=node.properties.find(p=>ts.isPropertyAssignment(p)&&p.name?.getText(source)==='execute');
  if(identity&&ts.isStringLiteral(identity.initializer)&&execute){
   for(const match of execute.getText(source).matchAll(/commands\.([A-Za-z]+)/g))mapping.set(match[1],[...(mapping.get(match[1])??[]),identity.initializer.text]);
  }
 }
 ts.forEachChild(node,inspect);
}
inspect(source);
for(const [name,ids] of Object.entries({postEntry:['expense','income','refund'],postTransfer:['transfer'],saveNativeEvent:['create-event','edit-event','move-event','remove-event'],saveBoardTask:['task','edit-task','complete-task'],saveBoardMilestone:['milestone','edit-milestone','complete-milestone'],removeBoardTask:['remove-task'],removeBoardMilestone:['remove-milestone'],clockInShift:['clock-in'],clockOutShift:['clock-out'],endShiftBreak:['end-break']}))mapping.set(name,ids);
const legacy=new Set(['recordHerculesTalk','forgetHerculesMemory','wipeHerculesChat']);
const internal=new Set(['executeHerculesAction','cancelHerculesSubmission']);
mapping.set('commitCompanion',['wear-saved-look','save-current-look','remove-saved-look','remembering','forget-preference','clear-conversation']);mapping.set('commitCompanionGallery',['publish-saved-look','rename-gallery-look','remove-gallery-look']);
const pretty=s=>s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
let md=`# Hercules capability coverage\n\nLocal implementation inventory; generated from the current registry. This is a coverage ledger, not a completion certificate.\n\nThe requested whole-app outcome remains OPEN. Adapters listed below exist in code; only the explicitly listed test evidence in the worksession is verified. Chat actions default off and need both client and server enablement. Google event management and several dedicated workflows remain unimplemented.\n\n## Common acceptance contract\n\nEvery app change starts as a private draft, receives an editable review bound to scope and accepted source facts, and requires its Final Confirm button or the exact standalone command. The authority revalidates and consumes the private claim with the domain result. Duplicate/retried requests use their original identity. Resuming a draft never carries review authority. Unresolved submissions retain their identity; cancellation races with submission on the same claim.\n\nFor every command adapter, acceptance means: screen/chat parity; missing inputs and ambiguous targets remain unresolved; changed source facts invalidate review; no domain mutation before confirmation; exact receipt recovery; permitted actor/view only. These are required tests, not an assertion that each operation has passed.\n\n## Application commands\n\n| User operation / command | Current access | Required adapter / completion evidence | Confirmation and acceptance test |\n|---|---|---|---|\n`;
for(const name of [...names].sort()){
 const access=legacy.has(name)?'Retired; runtime rejected':internal.has(name)?'Internal service':mapping.has(name)?'Registered command; named chat paths below':'Registered app command; chat adapter missing';
 const adapter=legacy.has(name)?'Use private companion operations; never re-enable':internal.has(name)?'Private resource / command receipt infrastructure':mapping.has(name)?`${[...new Set(mapping.get(name))].join(" / ")}; partial command coverage unless every option is exercised; accepted command receipt`:'Missing guided adapter or embedded specialized review';
 const test=legacy.has(name)?'Must remain rejected':internal.has(name)?'CAS, generation, privacy, replay and unknown receipt tests':`${/approve|confirm|Charter|Onboarding/.test(name)?'Actor approval only; preserve independent approvals. ':''}Final Confirm; ${/Import|Duplicate|History/.test(name)?'preserve unresolved rows and duplicate decisions':/Shift|Work|Earning|Coworker/.test(name)?'earned/received, actual/estimated and owner rules':/Fund|Charter/.test(name)?'Fund role, source and allocation invariants':/close|reopen/.test(name)?'books closure and correction checks':'command parity and stale/retry checks'}`;
 md+=`| ${pretty(name)} — \`${name}\` | ${access} | ${adapter} | ${test} |\n`;
}
const readBlock=tools.slice(tools.indexOf('export const HERCULES_READ_TOOL_NAMES'),tools.indexOf('] as const',tools.indexOf('export const HERCULES_READ_TOOL_NAMES')));
const reads=[...readBlock.matchAll(/"([a-z_]+)"/g)].map(m=>m[1]);
md+=`\n## Deterministic reads (${reads.length})\n\n| Operation | Current access | Adapter / completion evidence | Confirmation and acceptance test |\n|---|---|---|---|\n`;
for(const name of reads)md+=`| ${pretty(name.replaceAll('_',' '))} — \`${name}\` | Existing read tool | Existing scoped calculator; current fact references | No confirmation; grounded values, current data, owner/view filtering and useful follow-up |\n`;
md+=`\n## Dedicated and external surfaces\n\n| User-facing operation | Current access | Required adapter | Confirmation and acceptance test |\n|---|---|---|---|\n`;
const external=[
 ['Choose a file or take a document/receipt photo','BatchImportCard / document capture','Chat file-picker handoff, preserve row editing','Final Confirm for accepted rows; incomplete rows and duplicates block acceptance'],
 ['Save, retry or delete a receipt in Drive','Drive receipt controls','Embedded file/receipt review and separately recovered provider receipt','Review exact file and destination; lost acknowledgements do not duplicate uploads'],
 ['Import OFX/QFX or bank evidence','Existing import and Flinks surfaces','Embedded import session and bank connection consent','Final Confirm after matching and duplicate review; no inferred bank authority'],
 ['Read, export or delete work evidence; manage uploader/extension pairing','SevenShiftsEvidenceCenter','Embedded evidence and pairing controls','Final Confirm for changes; preserve owner mapping and external consent'],
 ['Scan a completed shift report','Existing shift report scan','Embedded image review returning to current shift draft','No estimate becomes actual work; preserve Shift order'],
 ['Connect, refresh or revoke 7shifts; import Gmail schedule email','Existing 7shifts APIs and Gmail-specific importer','Chat handoff to connection and evidence review','Real authentication; no generic Gmail capability'],
 ['Export active-view JSON, journal CSV, SQL or Calendar ICS','Existing download helpers; native events added to ICS','Chat export adapter using current view','Read-only download; no private records outside selected export'],
 ['Upload the sit-down workbook to Drive','Existing Drive helper','Reviewed destination and provider receipt','Final Confirm; a failed upload does not mark completion'],
 ['Google sign-in, sign-out, step-up and service consent','GoogleBridgeCard / App','Embed existing auth controls','User completes authentication; no model credentials or simulated consent'],
 ['Google calendar overlay search','Existing bounded overlay reader','General event search/read adapter still missing','No confirmation; query proper timezone and permission scope'],
 ['Publish/update Hearth bill reminders in Google','Existing reminder publisher','Reviewed reminder diff with per-event receipts','Final Confirm; preserve recurrence links and report partial outcomes'],
 ['Create/edit/move/delete ordinary Google events','Not built','Google CRUD with ETags, deterministic IDs, instance/series review and external receipt recovery','Separate Final Confirm per provider; permission changes, DST and partial failures'],
 ['Switch books or open a discovered membership','Existing App identity flows','Chat navigation with generation invalidation','No stale confirmation authority after switching away and back'],
 ['Create household, invite, accept invitation or change membership','Existing setup/invite/charter surfaces','Embed authoritative setup and invite controls','Final Confirm for saved changes; independent member acceptance and real auth'],
 ['Choose theme, device clock/location or appearance; push/pull desk appearance','Existing theme/settings and Google desk controls','Typed preference review and optional external handoff','Final Confirm for requested saves; preserve scope and drafts'],
 ['Retry sharing, reconnect, diagnose sync or verify import parity','Existing continuity controls','Scoped recovery adapter','Read-only checks need no confirm; changes preserve receipts and accepted data'],
 ['Restore cloud/restore-point copy, remove device copy or start over','Existing recovery/admin surfaces','Dedicated destructive review with owner/environment guards','Explicit reviewed confirmation; never infer Production or destructive authority'],
 ['Wear/save/delete an outfit; publish/rename/remove shared gallery copy','Existing private wardrobe and gallery commands','Embedded fitting controls plus chat review adapters','Final Confirm for requested saves; private look stays private until explicit sharing'],
 ['Remember/forget style preferences, toggle remembering or clear conversation','Existing private companion controls','Route requested saves through review; retain already-enabled automatic preference memory','Final Confirm for intentional changes; clear invalidates drafts and retains unresolved receipt identities'],
 ['Snooze, disable or resume suggestions','Existing discovery controls','Extend states to complete workflow catalogue','Preserve controls; resolved items suppressed and at most three suggestions'],
];
for(const row of external)md+=`| ${row.join(' | ')} |\n`;
md+=`\n## Missing discovery reads and integration gates\n\nGeneral native/Google event search, board-item search, companion catalogue queries, evidence browsing, connection status and administration status need conversational read adapters. Account-history, imports, jobs/attendance, appointments/claims, remaining Fund setup/settlement options, onboarding, administration and wardrobe need their remaining guided controls. Explicit sequential requests now have a private checklist; each item gets an independent fresh review. Broader model-driven compound interpretation remains open.\n\nNative event local tests cover civil time, clock gaps/folds, recurrence exceptions, private round trips, revisions, tombstones, planned-expense links and basic ICS. Arbitrary-timezone ICS interoperability, every native editing path, Google provider operations, authenticated cross-device workflows and live-model dialogue acceptance remain open.\n\nRollback: stop new chat executions while retaining private claim cancellation, accepted receipts and persisted fields. Do not delete event or workflow data. Deploying, schema application and Production activation require separate authorization.\n`;
await writeFile('docs/HERCULES_CAPABILITY_COVERAGE.md',md);console.log(`${names.size} command rows; ${reads.length} read rows; ${external.length} external/dedicated rows`);
