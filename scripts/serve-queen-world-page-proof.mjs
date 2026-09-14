/** The actual App page with the Queen's Nest on (`VITE_QUEENS_NEST=1`), booted from an isolated fictional local
    Development household — never a hosted ledger. This is the harness the Still Queen was missing: her earlier
    proof (`serve-household-home-proof.mjs`, `chrome=1`) rendered stand-ins for the App's chrome, and the stand-ins
    were about five times shorter than the real top bar, sync line, household switcher, scene heading and office
    disclosure. Everything measured here is the App's own shell.
    `?theme=classic|taylor|newfoundland`, `queen=0` boots the same App with the Nest off (the
    panel composition and the ordinary shell, the "before" and the fallback), `replicas=1` keeps a second fictional
    household on the device so the switcher has something to switch. */
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const entry = `
import { completedExistingBooksHousehold } from '/test/fixtures/existing-books-onboarding.ts';
import { addGoal, openChapter, recordRitualHeld, offerMove, openChapterFor } from '/src/core/index.ts';
import { saveHousehold } from '/src/storage.ts';
import { saveSession } from '/src/session.ts';
import { financialAuditHash } from '/src/core/commandIdentity.ts';
const q = new URLSearchParams(location.search);
localStorage.setItem('hearth:appearance:v1:development:guest', JSON.stringify({appearance:{theme:q.get('theme')||'classic',atmosphere:false},pending:false}));
let h = completedExistingBooksHousehold('2026-09-12T12:00:00.000Z');
h.householdId = 'HOUSEHOLD-QUEEN-WORLD-PROOF'; h.name = 'Our fictional home'; h.linked = false;
h = openChapter(h, {memberId:'MEM-001',foundationId:'make-rent-boring',at:'2026-09-01T12:00:00Z'}).household;
const chapter = openChapterFor(h); const ritual = h.rituals.find(row => row.chapterId === chapter.id);
if (ritual) h = recordRitualHeld(h, {memberId:'MEM-001',ritualId:ritual.id,onDate:'2026-09-04'}).household;
h = offerMove(h, {memberId:'MEM-002',chapterId:chapter.id,text:'Confirm which payday the pre-rent check belongs to',needsAcknowledgment:true}).household;
for (const name of ['A slower week away','Our kitchen garden']) h = addGoal(h,{name,target:'1200',shared:true,ownerMemberId:'MEM-001'}).household;
/* The fictional books carry their accepted-books receipt so the PGlite gate settles; gate=blocked leaves it off to show the books banner above her. */
if (q.get('gate') !== 'blocked') h.booksAcceptedHash = await financialAuditHash(h);
await saveHousehold(h);
if (q.get('replicas') === '1') { const other = {...completedExistingBooksHousehold('2026-09-12T12:00:00.000Z'), householdId:'HOUSEHOLD-QUEEN-WORLD-OTHER', name:'Another fictional home', linked:false}; await saveHousehold(other); }
saveSession('development',{memberId:'MEM-001',view:'household',householdId:h.householdId});
await import('/src/main.tsx');`;
export async function startQueenWorldPageProof({port=0, queen=true}={}) {
process.env.VITE_QUEENS_NEST = queen ? '1' : '0';
process.env.VITE_HOUSEHOLD_HOME_V2 = '1';
const server=await createServer({configFile:false,optimizeDeps:{exclude:['@electric-sql/pglite']},worker:{format:'es'},server:{host:'127.0.0.1',port,watch:null,hmr:false},plugins:[{name:'queen-world-page-proof',resolveId(id){if(id==='/queen-world-seed.js')return '\0queen-world-seed';},load(id){if(id==='\0queen-world-seed')return entry;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.method==='POST'){res.statusCode=503;res.end(JSON.stringify({ok:false}));return;}if(req.url?.split('?')[0]!=='/queen-world-app')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/queen-world-app',readFileSync('index.html','utf8').replace('src="/src/main.tsx"','src="/queen-world-seed.js"')));});}}]});await server.listen();return{url:`http://127.0.0.1:${server.httpServer.address().port}/queen-world-app`,close:()=>server.close()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const proof=await startQueenWorldPageProof({port:5188,queen:process.argv[2]!=='panels'});console.log(`Fictional Queen world page (actual App): ${proof.url}`);process.once('SIGINT',async()=>{await proof.close();process.exit(0);});}
