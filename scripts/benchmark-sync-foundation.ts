import { syncScaleFixture } from '../test/fixtures/syncScaleFixture.ts';
import { compileHousehold, trialBalance, booksEquation } from '../src/core/journal.ts';
import { assertAcceptableBooks } from '../src/core/commandRuntime.ts';
import { hashBooksSnapshot, validateHouseholdBooksStaged, closeStagedBooksHandlesForTests } from '../src/ledger/engine.ts';
function stats(a:number[]) { const s=a.toSorted((a,b)=>a-b); return {n:s.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.ceil(s.length*.95)-1)],min:s[0],max:s.at(-1)}; }
function timed(f:()=>unknown){let t=performance.now();f();return performance.now()-t}
const fixtureMs:number[]=[];let hh! : ReturnType<typeof syncScaleFixture>;
for(let i=0;i<5;i++)fixtureMs.push(timed(()=>{hh=syncScaleFixture()}));
hh.booksAcceptedHash = await hashBooksSnapshot(hh);
const compiled = compileHousehold(hh);assertAcceptableBooks(hh,compiled);
const compileMs:number[]=[], checksMs:number[]=[];
for(let i=0;i<100;i++){compileMs.push(timed(()=>compileHousehold(hh)));checksMs.push(timed(()=>{if(!trialBalance(compiled).inBalance||!booksEquation(compiled).holds)throw Error('bad books')}));}
console.log(JSON.stringify({fixture:stats(fixtureMs),transactions:hh.transactions.length,shifts:hh.shifts.length,entries:compiled.entries.length,compile:stats(compileMs),trialAndEquation:stats(checksMs)}));
let start=performance.now();let status=await validateHouseholdBooksStaged(hh,{compiled,auditHash:hh.booksAcceptedHash});console.log('coldStage',JSON.stringify({ms:performance.now()-start,status}));
const warmStage:number[]=[];
for(let i=0;i<20;i++) {const previous=hh;const tx=structuredClone(hh.transactions.find(x=>x.type==='expense'&&!x.reversalOfId)!);tx.id=`benchmark-${i}`;hh={...hh,revision:hh.revision+1,transactions:[...hh.transactions,tx]};hh.booksAcceptedHash=await hashBooksSnapshot(hh);const c=compileHousehold(hh);start=performance.now();status=await validateHouseholdBooksStaged(hh,{compiled:c,previous,auditHash:hh.booksAcceptedHash});warmStage.push(performance.now()-start);if(!status.ok)throw Error(JSON.stringify(status));}
console.log('warmStage',JSON.stringify({timing:stats(warmStage),status}));
const tx=hh.transactions.find(x=>x.type==='expense'&&!x.reversalOfId)!;
const delta={...hh,transactions:[tx]};const deltaMs:number[]=[];
for(let i=0;i<100;i++) deltaMs.push(timed(()=>{for(let k=0;k<100;k++)assertAcceptableBooks(delta)} )/100);
console.log('singleOperationCompileAndCheck',JSON.stringify(stats(deltaMs)));
await closeStagedBooksHandlesForTests();
