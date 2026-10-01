/** Authored walking lines only. Clip each source segment, never connect disjoint pieces. */
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
function interval(a,b,box){let lo=0,hi=1;for(const [k,min,max]of [[0,box.minX,box.maxX],[2,box.minZ,box.maxZ]]){const d=b[k]-a[k];if(Math.abs(d)<1e-12){if(a[k]<min||a[k]>max)return null;continue;}const t0=(min-a[k])/d,t1=(max-a[k])/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return null;}return [lo,hi];}
export function contiguousClips(points,boxes){const parts=[];let active=null;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],ranges=boxes.map(box=>interval(a,b,box)).filter(Boolean).sort((a,b)=>a[0]-b[0]),merged=[];for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1]+1e-9)last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}if(!merged.length){active=null;continue;}for(const [lo,hi]of merged){if(hi-lo<1e-10)continue;const start=lerp(a,b,lo),end=lerp(a,b,hi);if(!active||distance(active.points.at(-1),start)>1e-7){active={points:[start],sourceFrom:i-1+lo,sourceTo:i-1+hi};parts.push(active);}if(distance(active.points.at(-1),end)>1e-9)active.points.push(end);active.sourceTo=i-1+hi;if(hi<1-1e-9)active=null;}}return parts.filter(p=>p.points.length>1);}
/** @param {{beds: {id:string,points:number[][]}[]}|null} baseline */
export function mountainFootwayRoutes(world,baseline=null,nativeSnapshot=null,baselineNativeSnapshot=null){
 const region=world.regions.find(r=>r.id==='mountainV2');if(!region)throw Error('Missing mountain region');
 const road=world.beds.find(b=>b.id==='spur stillwater');if(!road)throw Error('Missing Stillwater link');
 // Twelve metres beyond the authored road plan is local approach coverage, not an invented path.
 const local={minX:Math.min(...road.points.map(p=>p[0]))-12,maxX:Math.max(...road.points.map(p=>p[0]))+12,minZ:Math.min(...road.points.map(p=>p[2]))-12,maxZ:Math.max(...road.points.map(p=>p[2]))+12};
 const result=[],named=['walk mountainV2.promenade','walk crown','walk summit','walk summitStation','crownLaunch.stair','walk footQuay','walk lakerim','southPortal.link'];
 const record=(id,bed,part,scope,extra={})=>{const points=part.points,old=baseline?.beds.find(b=>b.id===bed.id),length=points.slice(1).reduce((n,p,i)=>n+Math.hypot(points[i][0]-p[0],points[i][2]-p[2]),0);result.push({id,kind:'footway',points,sourceBedId:bed.id,sourceKind:bed.kind,scope,sourceRange:[part.sourceFrom,part.sourceTo],start:[...points[0]],end:[...points.at(-1)],lengthM:length,lengthConvention:'horizontal plan distance, matching controller progress',independentAttempt:true,validAttempt:length>1,baseline:{status:old?(digest(old.points)===digest(bed.points)?'protected-centreline-unchanged':'source-centreline-changed'):'not-compared',sourcePointsSha256:old?digest(old.points):null,currentSourcePointsSha256:digest(bed.points),limit:'Centreline comparison only; surfaces/structures may have changed.'},...extra});};
 for(const id of named){const b=world.beds.find(b=>b.id===id);if(!b)throw Error('Missing protected walking line '+id);record(id,b,{points:b.points,sourceFrom:0,sourceTo:b.points.length-1},'complete authored walking line');}
 const year=world.beds.find(b=>b.id==='yearWalk');if(!year)throw Error('Missing Year Walk');
 contiguousClips(year.points,[region.footprint,local]).forEach((p,i)=>record('yearWalk mountain/Stillwater part '+(i+1),year,p,'contiguous Year Walk inside native footprint or Stillwater local area',{selectionBoxes:[region.footprint,local],januaryAnchorEnd:p.sourceFrom===0?'departure':p.sourceTo===year.points.length-1?'arrival':null}));
 const jan=world.journey?.stations.find(s=>s.id==='jan');if(!jan?.stretch?.points)throw Error('Missing authored December-to-January walk stretch');
 contiguousClips(jan.stretch.points,[region.footprint,local]).forEach((p,i)=>record('yearWalk January arrival part '+(i+1),year,p,'contiguous authored January arrival stretch in the local area',{sourceGeometry:'journey.stations.jan.stretch.points',sourceStretchFrom:jan.stretch.from,overlappingCoverage:'Overlaps the Year Walk inventory; independent view of January access, never additional or whole-loop coverage.'}));
 for(const b of world.beds.filter(b=>['walk','trail','stair'].includes(b.kind)&&b.id!=='yearWalk'&&!named.includes(b.id)))contiguousClips(b.points,[local]).forEach((p,i)=>{const length=p.points.slice(1).reduce((n,x,k)=>n+distance(p.points[k],x),0);record(b.id+' Stillwater local part '+(i+1),b,p,'existing authored approach in Stillwater local area',{selectionBoxes:[local]});});
 // The new road itself is walkable: include its complete Foot→rim→Green approach separately from protected footways.
 record('Stillwater approach on road',road,{points:road.points,sourceFrom:0,sourceTo:road.points.length-1},'new walkable road approach; independent from road-chain attempts');
 // Source paths are independent attempts, not synthetic links between the above
 // Horizon beds. Their exported coordinates are already in Horizon space.
 if(nativeSnapshot)result.push(...nativeFootwayRoutes(nativeSnapshot,baselineNativeSnapshot));
 return result;
}
export function nativeFootwayRoutes(snapshot,baseline=null){
 const walks=snapshot.nativePlanning?.walks;if(!Array.isArray(walks))throw Error('Missing exported native walking paths');
 const seen=new Set();
 return walks.map((walk,index)=>{
  if(seen.has(walk.id))throw Error('Duplicate exported native walking path '+walk.id);seen.add(walk.id);
  const points=Array.isArray(walk.points)?walk.points:[],old=baseline?.nativePlanning?.walks?.find(w=>w.id===walk.id);
  const valid=Array.isArray(points)&&points.length>1&&points.every(p=>p.length===3&&p.every(Number.isFinite));
  const length=valid?points.slice(1).reduce((n,p,i)=>n+Math.hypot(points[i][0]-p[0],points[i][2]-p[2]),0):0;
  const geometryChanged=old&&(digest(old.points)!==digest(points)||old.halfWidth!==walk.halfWidth||old.kind!==walk.kind);
  return {id:'native '+walk.id,kind:'footway',points,sourcePathId:walk.id,sourceBedId:null,sourceKind:walk.kind,
   sourceHalfWidthM:walk.halfWidth,sourceWidthM:walk.halfWidth*2,
   sourceGeometry:`src/harbour/horizon/land/mountainV2/v2-data.json:nativePlanning.walks[${index}].points`,
   sourceCoordinateFrame:'Horizon coordinates already translated by the native export; no additional offset',
   scope:'complete independent exported native path; no connectors between paths',sourceRange:[0,points.length-1],
   start:points[0]?[...points[0]]:null,end:points.at(-1)?[...points.at(-1)]:null,lengthM:length,
   lengthConvention:'horizontal plan distance, matching controller progress',independentAttempt:true,validAttempt:valid&&length>1,
   overlappingCoverage:'May share physical ground with Horizon-bed attempts; counts as this source path only, not added network length.',
   baseline:{status:old?(geometryChanged?'native-source-changed':'native-export-unchanged'):'not-compared',sourcePointsSha256:old?digest(old.points):null,currentSourcePointsSha256:digest(points),
    limit:'Exported source comparison only; rounded coordinates, source kind and width do not prove unchanged terrain, water, support or controller outcomes.'}};
 });
}
