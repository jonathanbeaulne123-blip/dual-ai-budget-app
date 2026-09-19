import {expect,it} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {catalogHousehold} from '../src/core/index.ts';
import {MessageReader,encodeMessage} from '../src/ledgerSync/wire.ts';

it('delivers participant-scoped live paint and drains the durable peer outbox after an R2 acknowledgement failure',async()=>{
  const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
    import {LedgerRoom} from './workers/ledgerRoom.ts';
    import {handleLedgerSync} from './workers/ledgerSync.ts';
    export class FaultRoom extends LedgerRoom {
      constructor(ctx,env){let fail=false;const archive={get:(...args)=>env.LEDGER_ARCHIVE.get(...args),put:(key,...args)=>{if(fail&&key.includes('/events/')){fail=false;throw Error('SYNTHETIC_R2_FAILURE');}return env.LEDGER_ARCHIVE.put(key,...args);}};super(ctx,{...env,LEDGER_ARCHIVE:archive});this.toggleFault=()=>{fail=true;};}
      failNext(){this.toggleFault();}
    }
    export default {fetch(request,env){if(new URL(request.url).pathname==='/fault')return env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-creative-presence')).failNext().then(()=>Response.json({ok:true}));return handleLedgerSync(request,env);}};
  `},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],durableObjects:{LEDGER_ROOMS:{className:'FaultRoom',useSQLite:true}},r2Buckets:['LEDGER_ARCHIVE'],bindings:{LEDGER_SYNC_LOCAL_AUTH:'true',HEARTHSIDE_DESIGN_WRITES:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));
  const sockets:WebSocket[]=[];
  try{
    const base=(await mf.ready).toString().replace(/\/$/,''),path='/ledger-sync/v2/development/HH-creative-presence';
    const headers=(actor:string)=>({Authorization:`Bearer local:${actor}`,'Content-Type':'application/json'});
    const post=(action:string,body:unknown,actor='MEM-001')=>fetch(base+path+'/'+action,{method:'POST',headers:headers(actor),body:JSON.stringify(body)});
    const h={...catalogHousehold(),householdId:'HH-creative-presence'};
    for(const actor of ['MEM-001','MEM-002'])expect((await post('import',h,actor)).status).toBe(200);
    expect((await post('design',{version:1,kind:'create',designId:'DESIGN-one',bankId:null})).status).toBe(200);
    const common={version:1,designId:'DESIGN-one',pieceId:'PIECE-one'};
    expect((await post('design',{version:1,kind:'operate',operation:{...common,id:'OP-create',gestureId:'GESTURE-create',kind:'create-piece',base:'cream'}})).status).toBe(200);
    async function connect(actor:string,lane:'ledger'|'presence'){
      const ticket=await (await post('ticket',{},actor)).json() as {ticket:string};
      const ws=new WebSocket(base.replace(/^http/,'ws')+path+'/socket?lane='+lane);sockets.push(ws);ws.binaryType='arraybuffer';
      const messages:Record<string,any>[]=[],reader=new MessageReader();let tail=Promise.resolve();
      ws.addEventListener('message',event=>{tail=tail.then(async()=>{if(typeof event.data==='string'){messages.push(JSON.parse(event.data));return;}const data=event.data as ArrayBuffer,value=await reader.accept(data);ws.send(JSON.stringify({type:'credit',bytes:data.byteLength}));if(value)messages.push(value as Record<string,unknown>);});});
      const next=async(type:string)=>{for(let i=0;i<300;i++){await tail;const at=messages.findIndex(m=>m.type===type);if(at>=0)return messages.splice(at,1)[0]!;if(messages.some(m=>m.type==='error'))throw Error(JSON.stringify(messages));await new Promise(r=>setTimeout(r,10));}throw Error(`Missing ${type}: ${JSON.stringify(messages)}`);};
      await new Promise<void>((resolve,reject)=>{ws.addEventListener('open',()=>resolve(),{once:true});ws.addEventListener('error',reject,{once:true});});
      ws.send(JSON.stringify({type:'auth',ticket:ticket.ticket}));await next('authenticated');
      if(lane==='ledger'){for(const frame of await encodeMessage({type:'resume',sequence:0}))ws.send(frame);await next('snapshot');await next('ready');}
      return {ws,next,messages};
    }
    const watcher=await connect('MEM-002','ledger'),a=await connect('MEM-001','presence'),b=await connect('MEM-002','presence');
    const target={designId:'DESIGN-one',pieceId:'PIECE-one',room:'studio'};
    a.ws.send(JSON.stringify({type:'creative-join',version:1,target:{...target,deviceId:'DEVICE-a'}}));
    b.ws.send(JSON.stringify({type:'creative-join',version:1,target:{...target,deviceId:'DEVICE-b'}}));
    await a.next('creative-peer');await b.next('creative-peer');
    const stroke={part:'body',tool:'brush',color:'#b32255',size:12,opacity:1,mirror:false,pts:[.2,.2,.3,.3]};
    const start=performance.now();a.ws.send(JSON.stringify({type:'creative-preview',version:1,gestureId:'GESTURE-live',stroke}));
    expect(await b.next('creative-peer')).toMatchObject({memberId:'MEM-001',stroke});
    const delivery=performance.now()-start;expect(delivery).toBeLessThan(250);
    const deliveries=[delivery];
    for(let i=0;i<29;i++){await new Promise(resolve=>setTimeout(resolve,60));const sample=performance.now();a.ws.send(JSON.stringify({type:'creative-preview',version:1,gestureId:'GESTURE-sample-'+i,stroke}));expect(await b.next('creative-peer')).toMatchObject({memberId:'MEM-001',stroke});deliveries.push(performance.now()-sample);}
    const sorted=deliveries.slice().sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1]!;expect(p95).toBeLessThan(250);expect(watcher.messages.some(m=>m.type==='creative-peer')).toBe(false);
    const read=await (await post('design',{version:1,kind:'read',designId:'DESIGN-one'})).json() as {document:{revision:number}};expect(read.document.revision).toBe(1);
    await fetch(base+'/fault');
    const operation={...common,id:'OP-accepted-once',gestureId:'GESTURE-live',kind:'append-stroke',expectedEditEpoch:0,surfaceRevision:0,stroke};
    expect((await post('design',{version:1,kind:'operate',operation})).status).not.toBe(200);
    expect(watcher.messages.filter(m=>m.type==='event')).toHaveLength(0);
    const retry=await post('design',{version:1,kind:'operate',operation});expect(retry.status,await retry.clone().text()).toBe(200);
    const accepted=await retry.json() as {document:{revision:number;operations:unknown[]};sequence:number};
    expect(accepted.document.revision).toBe(2);expect(accepted.document.operations).toHaveLength(2);
    expect(await watcher.next('event')).toMatchObject({event:{sequence:accepted.sequence}});
    expect(watcher.messages.filter(m=>m.type==='event')).toHaveLength(0);
    console.log(JSON.stringify({fixture:'loopback two member presence',samples:deliveries.length,transport:'actual WebSocket, separate synthetic members, loopback without network shaping',previewDeliveryMs:Math.round(delivery),previewP95Ms:Math.round(p95)}));
  }finally{for(const ws of sockets)ws.close();await mf.dispose();}
},60_000);
