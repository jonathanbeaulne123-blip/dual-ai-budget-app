/** Actual App, isolated synthetic local Development fixture; never a hosted ledger. */
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const entry = `
import { completedExistingBooksHousehold } from '/test/fixtures/existing-books-onboarding.ts';
import { addGoal, openChapter } from '/src/core/index.ts';
import { saveHousehold } from '/src/storage.ts';
import { saveSession } from '/src/session.ts';
import { defaultGoalEnvelope } from '/src/core/goalEnvelopes.ts';
import { newKittyPiece } from '/src/core/kittyStudio.ts';
localStorage.setItem('hearth:appearance:v1:development:guest', JSON.stringify({appearance:{theme:new URLSearchParams(location.search).get('theme')||'classic',atmosphere:false},pending:false}));
let h = completedExistingBooksHousehold('2026-09-12T12:00:00.000Z');
h.householdId = 'HOUSEHOLD-FEEDBACK-PROOF'; h.name = 'Our fictional home'; h.linked = false;
h = openChapter(h, {memberId:'MEM-001',foundationId:'see-our-shared-life',at:'2026-09-12T12:00:00Z'}).household;
for (const name of ['A slower week away','Our kitchen garden']) h = addGoal(h,{name,target:'1200',shared:true,ownerMemberId:'MEM-001'}).household;
for (const [i,g] of h.goals.entries()) { const piece = newKittyPiece('proof-'+i,'2026-09-12T12:00:00Z', i ? 'sea-glass' : 'rose'); piece.sculpt.ears = i ? 'round' : 'pointed'; g.envelope = {...defaultGoalEnvelope(),studio:{version:1,draft:piece,fired:[]}}; }
await saveHousehold(h); saveSession('development',{memberId:'MEM-001',view:'household',householdId:h.householdId});
await import('/src/main.tsx');`;
export async function startHomeFeedbackProof({port=0}={}) {
const server=await createServer({server:{host:'127.0.0.1',port,watch:null,hmr:false},plugins:[{name:'home-feedback-proof',resolveId(id){if(id==='/feedback-seed.js')return '\0feedback-seed';},load(id){if(id==='\0feedback-seed')return entry;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.url?.split('?')[0]!=='/feedback-app')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/feedback-app',readFileSync('index.html','utf8').replace('src="/src/main.tsx"','src="/feedback-seed.js"')));});}}]});await server.listen();return{url:`http://127.0.0.1:${server.httpServer.address().port}/feedback-app`,close:()=>server.close()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const proof=await startHomeFeedbackProof({port:5187});console.log(proof.url);process.once('SIGINT',async()=>{await proof.close();process.exit(0);});}
