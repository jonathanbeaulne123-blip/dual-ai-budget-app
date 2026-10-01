/** Standalone native scene review: same mount/place/dressing as HarbourWorld, no ledger or Horizon region. */
import {mountHarbourWorld} from '../../src/harbour/scene/runtime.ts';
import {villageCourt} from '../../src/harbour/village/VillageCourt.ts';
import {COURT_DRESSING} from '../../src/harbour/court/dressing.ts';
import {sceneDressingFrom} from '../../src/harbour/scene/place.ts';
import {poseFrom} from '../../src/harbour/camera/poses.ts';
import {groundHeightAt} from '../../src/harbour/scene/ground.ts';
import {queryWorldSurface} from '../../src/harbour/mountain/surfaces.ts';
import {MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE} from '../../src/harbour/mountain/roads.ts';
import {SKILL_BRANCHES,MOUNTAIN_VERSION,GEOGRAPHY_REVISION} from '../../src/harbour/mountain/definition.ts';
import {setWorldDiagnostics} from '../../src/house/world/diagnostics.ts';

const params=new URLSearchParams(location.search),theme=params.get('theme')??'classic',tier=params.get('tier')??'full';
if(!['classic','taylor','newfoundland'].includes(theme)||!['full','lite'].includes(tier))throw Error('Unknown native review theme/tier');
setWorldDiagnostics(true);
const host=document.getElementById('native-mountain-stage'),status=document.getElementById('native-mountain-status');
let ready=false,failed=false,requested=null;
const world=mountHarbourWorld(host,theme,tier,{place:villageCourt,dressing:sceneDressingFrom(COURT_DRESSING[theme]),reading:null,composition:'desktop',onReady(){ready=true;status.textContent='Native Mountain v2 · authored daylight';},onFailure(){failed=true;status.textContent='Native Mountain v2 · renderer unavailable';}});
world.mountainCalm(true);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const inwards=(points,end,metres)=>{let d=0,i=end,direction=end===0?1:-1;while(i+direction>=0&&i+direction<points.length&&d<metres){d+=distance(points[i],points[i+direction]);i+=direction;}if(i===end)throw Error('Branch has no distinct camera tangent');return i;};
const eyeAt=(p,id)=>{const hit=queryWorldSurface({x:p[0],z:p[2],y:p[1],supportId:id,stepHeight:.48},groundHeightAt);return{eye:[p[0],hit.y+1.65,p[2]],support:hit};};
const poses=[];
for(const id of ['library-balcony','dam-promenade','hearth-awning']){
 const b=SKILL_BRANCHES.find(b=>b.id===id);if(!b)throw Error('Missing native branch '+id);const p=b.points,last=p.length-1,back=inwards(p,last,8);
 for(const [suffix,i,j]of [['entry',0,inwards(p,0,8)],['landing-down',back,last],['landing-up',last,back]]){
  const seated=eyeAt(p[i],id),target=eyeAt(p[j],id).eye;if(distance(seated.eye,target)<.01)throw Error('Zero camera direction '+id+suffix);
  poses.push({id:id+'-'+suffix,branchId:id,...seated,target});
 }
}
// Inspect the separately approved D-MR19/20 frames and D-MR22 junction in the
// actual native renderer, with the same queried support used by other poses.
const roadPose=(id,line,index,reverse=false)=>{
 const points=line.samples.map(s=>s.at),p=points[index],step=reverse?-8:8;
 const j=Math.max(0,Math.min(points.length-1,index+step));
 const targetIndex=j===index?Math.max(0,Math.min(points.length-1,index-step)):j;
 const seated=eyeAt(p,line.id);let target=eyeAt(points[targetIndex],line.id).eye;
 if(j===index)target=target.map((n,k)=>2*seated.eye[k]-n);
 poses.push({id,...seated,target});
};
for(const [name,anchor] of [['lower-bend',[70,-77]],['awning-bend',[85,-284]],['orchard-bend',[19,-93]]]){
 const samples=MOUNTAIN_ROAD_LINE.samples;
 const i=samples.reduce((best,s,n)=>Math.hypot(s.at[0]-anchor[0],s.at[2]-anchor[1])<Math.hypot(samples[best].at[0]-anchor[0],samples[best].at[2]-anchor[1])?n:best,0);
 for(const reverse of[false,true])roadPose(name+(reverse?'-down':'-up'),MOUNTAIN_ROAD_LINE,i,reverse);
}
for(const [name,index]of[['orchard-entry',0],['orchard-bridge-start',8],['orchard-bridge-fairing-end',26]]){
 for(const reverse of[false,true])roadPose(name+(reverse?'-back':'-out'),ORCHARD_LANE_LINE,index,reverse);
}
poses.push({id:'native-overview',shot:'view:world'});
const snapshot=()=>({ready,failed,theme,tier,worldVersion:MOUNTAIN_VERSION,geographyRevision:GEOGRAPHY_REVISION,lighting:'fixed authored daylight; native runtime has no day/night clock',requested,camera:world.camera(),pose:world.pose(),resident:world.resident(),drawCalls:Number(host.dataset.drawCalls??0),geometries:Number(host.dataset.geometries??0),textures:Number(host.dataset.textures??0),renderMs:Number(host.dataset.renderMs??0),cameraGround:groundHeightAt(world.camera()[0],world.camera()[2]),measure:world.measure('read')});
window.__nativeMountain={poses,snapshot,show(id){const p=poses.find(p=>p.id===id);if(!p)throw Error('Unknown native view '+id);requested=p;world.measure('start',id);if(p.shot){if(!world.shot(p.shot))throw Error('Unknown runtime shot '+p.shot);}else{world.look(poseFrom(p.eye,p.target));}world.invalidate();return snapshot();},async settle(timeoutMs=45000){
 const start=performance.now();let stableSince=0,previous=null;
 while(performance.now()-start<timeoutMs){await new Promise(resolve=>setTimeout(resolve,100));const s=snapshot(),stable=previous&&Math.hypot(...s.camera.map((n,i)=>n-previous.camera[i]))<.01&&s.drawCalls===previous.drawCalls&&s.geometries===previous.geometries&&s.drawCalls>0;
  if(stable){stableSince||=performance.now();if(performance.now()-stableSince>=1200){world.measure('stop');const observed=snapshot(),requestedEye=requested?.eye;return{settled:true,elapsedMs:performance.now()-start,...observed,...(requestedEye?{cameraDisplacement:Math.hypot(...observed.camera.map((n,i)=>n-requestedEye[i]))}:{})};}}else stableSince=0;previous=s;
 }
 world.measure('stop');return{settled:false,elapsedMs:performance.now()-start,...snapshot()};
},dispose(){world.dispose();}};
window.addEventListener('pagehide',()=>world.dispose(),{once:true});
