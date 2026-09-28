import type {XYZ} from '../land/interfaces.ts';

/**
 * Wave 6 (CONTRACT §2: one continuous world, no loading, collision = render): the body never enters ground whose geometry
 * chunk — its solids, i.e. its collision — is not resident. Three rules share this module:
 *
 * - the GATE: a step whose footprint cells (HorizonChunkRef.footprint) belong to a chunk that has not arrived is held at
 *   that boundary — no teleport, no fall-through; the walker waits in place and keeps its path;
 * - ROUTE-AHEAD: a walk plan (walkTo, tap-to-walk) requests the chunks its path crosses, in path order (nearest first),
 *   ahead of the ones the camera merely sees;
 * - ARRIVAL: the camera district and every chunk within the body's reach (CHUNK_REACH_EU) are resident before the first
 *   interactive frame.
 *
 * A stale index without footprints falls back to the district partition (districtAt at the point and around it).
 */
export const CHUNK_REACH_EU = 30;
/** The gate's probe radius around a step: the body (0.3) plus the blocker probes, rounded up. */
export const CHUNK_GATE_RADIUS_EU = 1;
/** Route-ahead samples a plan every this many eu, each with a disc of this radius. */
export const CHUNK_ROUTE_STEP_EU = 8;
export interface ChunkCoverage {ready(id:string):boolean;covering(x:number,z:number,radius:number):string[]|null}
export interface ChunkGate {
  /** Chunks the disc (x, z, r) needs that are not resident. */
  missingAt(x:number,z:number,radius?:number):string[];
  /** Every chunk a path crosses, in path order (first crossed first), resident or not. */
  along(points:readonly XYZ[],radius?:number):string[];
  /** Every chunk within `radius` of a point (resident or not). */
  near(x:number,z:number,radius:number):string[];
}
export function createChunkGate(loader:ChunkCoverage,districtAt:(x:number,z:number)=>string):ChunkGate{
  const near=(x:number,z:number,radius:number):string[]=>{
    const covered=loader.covering(x,z,radius);if(covered)return covered;
    const out=new Set([districtAt(x,z)]);
    for(let k=0;k<8;k++){const a=k*Math.PI/4;out.add(districtAt(x+Math.cos(a)*radius,z+Math.sin(a)*radius));}
    return [...out];
  };
  return{
    near,
    missingAt:(x,z,radius=CHUNK_GATE_RADIUS_EU)=>near(x,z,radius).filter(id=>!loader.ready(id)),
    along(points,radius=CHUNK_ROUTE_STEP_EU){
      const out:string[]=[],seen=new Set<string>(),add=(x:number,z:number)=>{for(const id of near(x,z,radius))if(!seen.has(id)){seen.add(id);out.push(id);}};
      for(let i=0;i<points.length;i++){
        const a=points[i]!;add(a[0],a[2]);
        const b=points[i+1];if(!b)continue;
        const length=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.floor(length/CHUNK_ROUTE_STEP_EU);
        for(let k=1;k<=n;k++){const t=k/(n+1);add(a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t);}
      }
      return out;
    },
  };
}
/** R3-118: a chunk whose download fails is tried this many times, these many ms apart (after the 1st and 2nd failure). */
export const CHUNK_RETRY_TRIES = 3;
export const CHUNK_RETRY_BACKOFF_MS = [1000, 4000] as const;
/** The status line a held walker sees while a chunk it needs is still arriving (or has failed and waits for its retry). */
export const CHUNK_ARRIVING_STATUS = 'The island is still arriving here. Walking resumes when this part has loaded.';
export const CHUNK_FAILED_STATUS = 'Part of the island did not load. Trying again; walking resumes when it arrives.';
export interface ChunkFailure {id:string;tries:number;retryAt:number|null;exhausted:boolean}
/**
 * One chunk at a time, by priority: the route's chunks (path order), then the ones the view asked for, then — after the
 * first frame — the rest, nearest the body first. `load` is the loader's (fetch + parse + append once).
 *
 * Wave 7 (R3-118): a failed load is not forgotten. It is retried with back-off (CHUNK_RETRY_BACKOFF_MS) up to
 * CHUNK_RETRY_TRIES; after that it is `exhausted` and waits for the next demand. The gate never opens on a failed chunk: it
 * stays held and says so (`failures`).
 *
 * PR #561 review (Codex P2): only a GENUINE demand gives an exhausted chunk its tries back — never a repeated identical one.
 * The district stream asks `view` for the chunk it sees on every animation frame, and a held ride polls `route` every frame;
 * re-arming on each call fetched, decompressed and parsed a persistently missing chunk forever. So:
 * - `route(ids, fresh)`: a new walk plan (`fresh`) re-arms every chunk it names; otherwise (a gate hold, a held ride's poll)
 *   only a chunk NEWLY entering the route list is re-armed — one already queued there stays exhausted;
 * - `view(ids)`: only a chunk newly entering the demanded set (in neither list) is re-armed;
 * - `retry(ids)`: an explicit user action on held ground (Look → Walk, a restore) re-arms those chunks once.
 */
export function createChunkScheduler(options:{ready:(id:string)=>boolean;load:(id:string)=>Promise<unknown>;background:()=>string[];yield?:()=>Promise<void>;isDisposed:()=>boolean;now?:()=>number;setTimer?:(fn:()=>void,ms:number)=>unknown}){
  const route:string[]=[],view:string[]=[];let pumping=false,backgroundOn=false;
  const now=options.now??(()=>Date.now()),setTimer=options.setTimer??((fn:()=>void,ms:number)=>setTimeout(fn,ms));
  const failed=new Map<string,ChunkFailure>();
  /** Waiting for its back-off, or exhausted: skipped by the pump for now (kept in its list, so it is retried in its place). */
  const waiting=(id:string)=>{const f=failed.get(id);return !!f&&(f.exhausted||(f.retryAt!==null&&f.retryAt>now()));};
  const nextOf=(list:string[])=>{while(list.length&&options.ready(list[0]!)){failed.delete(list[0]!);list.shift();}return list.find(id=>!options.ready(id)&&!waiting(id));};
  function next(){return nextOf(route)??nextOf(view)??(backgroundOn?options.background().find(id=>!options.ready(id)&&!waiting(id)):undefined);}
  function fail(id:string){
    const f=failed.get(id)??{id,tries:0,retryAt:null,exhausted:false};f.tries++;
    if(f.tries>=CHUNK_RETRY_TRIES){f.exhausted=true;f.retryAt=null;}
    else{const ms=CHUNK_RETRY_BACKOFF_MS[f.tries-1]??CHUNK_RETRY_BACKOFF_MS.at(-1)!;f.retryAt=now()+ms;setTimer(()=>{if(!options.isDisposed())void pump();},ms);}
    failed.set(id,f);
  }
  let rearms=0;
  /** A genuine demand gives an exhausted chunk its tries back (see above: never a repeated identical one). */
  const demand=(ids:readonly string[])=>{for(const id of ids){const f=failed.get(id);if(f?.exhausted){f.exhausted=false;f.tries=0;f.retryAt=null;rearms++;}}};
  async function pump(){
    if(pumping)return;pumping=true;
    try{for(let id=next();id!==undefined&&!options.isDisposed();id=next()){try{await options.load(id);failed.delete(id);}catch{fail(id);}await (options.yield?.()??new Promise<void>(r=>setTimeout(r,0)));}}
    finally{pumping=false;}
  }
  return{
    /**
     * Route chunks go to the FRONT in the given order, once each (a new plan replaces the old route's priority). `fresh` (a new
     * walk plan) re-arms every exhausted chunk it names; otherwise only one that was not already in the route list.
     */
    route(ids:readonly string[],fresh=false){
      const before=new Set(route);route.length=0;
      for(const id of ids)if(!options.ready(id)&&!route.includes(id))route.push(id);
      demand(fresh?route:route.filter(id=>!before.has(id)));void pump();
    },
    /** Chunks the camera sees (asked every frame by the district stream): only a newly demanded one is re-armed. */
    view(ids:readonly string[]){const fresh:string[]=[];for(const id of ids)if(!options.ready(id)&&!view.includes(id)){if(!route.includes(id))fresh.push(id);view.push(id);}demand(fresh);void pump();},
    /** An explicit user action on held ground (Look → Walk, a restore): these chunks get their tries back once. */
    retry(ids:readonly string[]){demand(ids);void pump();},
    startBackground(){backgroundOn=true;void pump();},
    queued:()=>({route:route.filter(id=>!options.ready(id)),view:view.filter(id=>!options.ready(id))}),
    /** Chunks that failed and are not resident: their tries, the next retry, exhausted or not. */
    failures:():ChunkFailure[]=>[...failed.values()].filter(f=>!options.ready(f.id)).map(f=>({...f})),
    /** How many times an exhausted chunk was given its tries back (review evidence: a repeated demand never adds one). */
    rearms:()=>rearms,
  };
}
/**
 * v2.2 (reconciled with main #551/#552): the RIDE rule. A board, a bicycle, a glider or a parachute crosses district
 * boundaries faster than the walking gate can hold it (a glider cannot wait in the air), and a glide or a board line can
 * reach any district. So a ride is taken only with its ground loaded: accepting a feet → mover offer waits — no teleport,
 * no fall-through, the offer stays on show — until every chunk is resident (the whole island; the bytes are already fetched
 * after the first frame). A held offer boards by itself the moment the last chunk lands, if it is still the one on show;
 * walking away (another or no offer) drops it. Parking (mover → feet) never waits.
 */
export interface RideGateLoader {refs:readonly {districtId:string}[];ready(id:string):boolean}
export function rideMissing(loader:RideGateLoader):string[]{return loader.refs.map(r=>r.districtId).filter(id=>!loader.ready(id));}
export function createRideGate<T extends {id:string;to:string}>(loader:RideGateLoader|null|undefined){
  let pending:T|null=null,holds=0;
  const missing=()=>loader?rideMissing(loader):[];
  return{
    missing,
    /** Ask to take `offer`: true = go now; false = held (pending until every chunk is resident). Parking never waits. */
    request(offer:T):boolean{
      if(offer.to==='feet'||!missing().length){pending=null;return true;}
      if(pending?.id!==offer.id)holds++;pending=offer;return false;
    },
    /** Once a frame with the offer on show: the held offer when it may go now (and it is cleared), else null. Another or no offer drops it. */
    poll(shown:T|null):T|null{
      if(!pending)return null;
      if(!shown||shown.id!==pending.id){pending=null;return null;}
      if(missing().length)return null;
      const go=pending;pending=null;return go;
    },
    pending:()=>pending,
    /** Drop a held offer (a restore, a door, leaving Walk). */
    clear(){pending=null;},
    stats:()=>({pending:pending?.id??null,holds}),
  };
}
