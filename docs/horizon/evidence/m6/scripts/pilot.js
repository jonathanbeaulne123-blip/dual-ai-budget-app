// In-page M6 ride pilot (injected by rides.mjs). Reads the live controller that the runtime is riding
// (`window.__horizonFlight`, dev only) through its public `probe()` / `hud()` / `update()` and flies it with the
// same two inputs a player has (bar, bank; for the canopy: brakes = bar pushed out, yaw = bank, pull). No state
// is written into the controller or the runtime other than those inputs. Fixed step 1/60 s.
(()=>{
  const DEG=Math.PI/180,DT=1/60,MAX_BANK=50*DEG,TURN_G=4.9,WIND=[0,-4];
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ang=(a,b)=>{let d=(a-b)%(2*Math.PI);if(d>Math.PI)d-=2*Math.PI;if(d<=-Math.PI)d+=2*Math.PI;return d;};
  const c=()=>window.__horizonFlight,h=()=>window.__harbour;
  const bearing=(p,to)=>Math.atan2(to[0]-p.x,to[1]-p.z);
  const dist=(p,to)=>Math.hypot(to[0]-p.x,to[1]-p.z);
  /** Heading that makes the ground track run along `b` in the south wind (a crab). */
  function track(b,airspeed){
    const dx=Math.sin(b),dz=Math.cos(b),nx=dz,nz=-dx,s=clamp(-(WIND[0]*nx+WIND[1]*nz)/Math.max(1,airspeed),-1,1),co=Math.sqrt(1-s*s);
    return Math.atan2(co*dx+s*nx,co*dz+s*nz);
  }
  function steer(p,heading,maxDeg=40){
    const err=ang(heading,p.heading),omega=-TURN_G*Math.tan(p.bank)/Math.max(1,p.airspeed);
    return clamp(-2*(err-omega*.6),-maxDeg*DEG,maxDeg*DEG)/MAX_BANK;
  }
  const agl=()=>{const hud=c().hud();return hud.height??NaN;};
  // ---- glider legs ----
  // {kind:'to', to:[x,z], bar, within, maxBank} fly to a point; {kind:'heading', heading, bar, seconds};
  // {kind:'orbit', core:[x,z], r, untilY, maxSeconds}; {kind:'beat', x:[x1,x2], z, untilY, maxSeconds};
  // {kind:'land', heading?} wings level, push out full in the last 1.5 m; {kind:'fold'} press the Fold bubble.
  function gliderInput(leg,p,mem){
    const a=agl();
    if(leg.kind==='land'){return{bar:a<1.5?-1:0,bank:leg.heading===undefined?steer(p,p.heading,0):steer(p,leg.heading,15)};}
    if(leg.kind==='to'){const hd=track(bearing(p,leg.to),p.airspeed);return{bar:leg.bar??0,bank:steer(p,hd,leg.maxBank??40)};}
    if(leg.kind==='landOn'){
      // journeys.ts Pilot.landOn, made wind-aware for the build's 4 m/s south wind: circle down over a point `upwind` m
      // north of the field's centre (min-sink bar), then from `finalAgl` fly the final into the wind (south) wings
      // near level, pushing out full in the last 1.5 m.
      const orbitR=Math.min(20,leg.r/2),core=[leg.xy[0],leg.xy[1]-(leg.upwind??25)],d=dist(p,core);
      if(mem.final||a<(leg.finalAgl??8)){mem.final=true;return{bar:a<1.5?-1:0,bank:steer(p,0,20)};}
      if(d>orbitR*1.5)return{bar:0,bank:steer(p,track(bearing(p,core),p.airspeed),40)};
      const dx=p.x-core[0],dz=p.z-core[1],n=Math.hypot(dx,dz)||1,rx=dx/n,rz=dz/n,k=clamp((n-orbitR)/orbitR,-1,1);
      const hd=track(Math.atan2(rz-rx*k,-rx-rz*k),p.airspeed),feed=-Math.atan(p.airspeed*p.airspeed/(TURN_G*orbitR));
      return{bar:-2/3,bank:clamp(feed-1.5*ang(hd,p.heading),-45*DEG,45*DEG)/MAX_BANK};
    }
    if(leg.kind==='gate'){
      // Arrive at the gate's centre height: the bar from the sink the remaining ground distance needs (polar 1.2 at trim → 3 at 17).
      const d=Math.max(1,dist(p,leg.gate)),gs=Math.max(4,p.groundSpeed),need=(p.y-leg.h)/(d/gs);
      const bar=need>1.8?clamp(.5+(need-1.8)/1.2*.5,0,1):need>1.2?(need-1.2)/.6*.5:need<1.05?-.6:0;
      const hd=track(bearing(p,leg.aim??leg.gate),p.airspeed);return{bar,bank:steer(p,hd,leg.maxBank??30)};
    }
    if(leg.kind==='heading'){return{bar:leg.bar??0,bank:steer(p,leg.heading,leg.maxBank??40)};}
    if(leg.kind==='orbit'){
      const dx=p.x-leg.core[0],dz=p.z-leg.core[1],d=Math.hypot(dx,dz)||1,rx=dx/d,rz=dz/d,k=clamp((d-leg.r)/leg.r,-1,1);
      const hd=track(Math.atan2(rz-rx*k,-rx-rz*k),p.airspeed),feed=-Math.atan(p.airspeed*p.airspeed/(TURN_G*leg.r));
      return{bar:leg.bar??-2/3,bank:clamp(feed*(d<leg.r*1.6?1:0)-1.5*ang(hd,p.heading),-45*DEG,45*DEG)/MAX_BANK};
    }
    if(leg.kind==='beat'){
      // Beat east/west along the ridge box at z, turning at the ends (the ridge only lifts a heading along the face).
      mem.dir??=1;const [x1,x2]=leg.x;if(p.x>=x2)mem.dir=-1;if(p.x<=x1)mem.dir=1;
      const target=[mem.dir>0?x2+40:x1-40,leg.z];const hd=track(bearing(p,target),p.airspeed);
      return{bar:0,bank:steer(p,hd,35)};
    }
    return{bar:0,bank:0};
  }
  function legDone(leg,p,mem,t0){
    if(leg.kind==='gate')return dist(p,leg.gate)<=(leg.within??3);
    if(leg.kind==='to')return dist(p,leg.to)<=(leg.within??30)||(leg.belowY!==undefined&&p.y<=leg.belowY);
    if(leg.kind==='heading')return p.t-t0>=leg.seconds;
    if(leg.kind==='orbit'&&leg.belowY!==undefined)return p.y<=leg.belowY||p.t-t0>=(leg.maxSeconds??240);
    if(leg.kind==='orbit'||leg.kind==='beat')return p.y>=leg.untilY||p.t-t0>=(leg.maxSeconds??240);
    if(leg.kind==='fold')return true;
    return false;
  }
  // ---- canopy legs ----
  // {kind:'drift', target:[x,z], standUp:true|false, pullAtAgl, flareBrake} freefall (lean 0), pull by hand at pullAtAgl
  // (or wait for the auto-pull), then face into the wind and hold over the target; the last 5 m at `flareBrake`.
  function chuteInput(leg,p){
    const a=agl();
    if(p.phase==='freefall'){return{bar:0,bank:0,pull:leg.pullAtAgl!==undefined&&a<=leg.pullAtAgl};}
    if(p.phase==='opening')return{bar:0,bank:0,pull:false};
    const t=leg.target,dx=t[0]-p.x,dz=t[1]-p.z;
    if(a<=5.5&&leg.flareBrake!==undefined){
      // The flare: face the heading the leg asks for (south = 0, into the wind; north = π, downwind), brakes at flareBrake.
      const want=leg.flareHeading??0;return{bar:-leg.flareBrake,bank:clamp(ang(p.heading,want)*2,-1,1),pull:false};
    }
    // Face south into the wind; lateral error by a small yaw off south; along-wind error by the brakes
    // (hands up = 2 m/s over the ground toward the south, half brakes = hover, more = drift north).
    const face=clamp(dx*.02,-.6,.6),yaw=clamp(ang(p.heading,face)*2,-1,1);
    const brake=dz>1.5?0:dz>-2?.5:.8;
    return{bar:-brake,bank:yaw,pull:false};
  }
  let log=[],events=[],legs=[],legIndex=0,legT0=0,mem={},lastSecond=-1,kind='glider',input={bar:0,bank:0};
  function row(p,extra={}){const hud=c().hud(),o=c().outcome?.();return{t:+p.t.toFixed(2),x:+p.x.toFixed(1),y:+p.y.toFixed(1),z:+p.z.toFixed(1),phase:p.phase,airspeed:+p.airspeed.toFixed(2),vs:+p.vs.toFixed(2),lift:+p.lift.toFixed(2),bankDeg:+(p.bank/DEG).toFixed(1),headingDeg:+(p.heading/DEG).toFixed(1),agl:hud.height!==undefined?+hud.height.toFixed(1):null,groundSpeed:+p.groundSpeed.toFixed(2),...(p.brake!==undefined?{brake:+p.brake.toFixed(2)}:{}),bar:+input.bar.toFixed(2),bankIn:+input.bank.toFixed(2),...(hud.place?{place:`${hud.place.label} · ${Math.round(hud.place.distance)} m (${hud.place.action})`}:{}),...(o?{outcome:o.kind,outcomeLabel:o.label,at:o.at.map(v=>+v.toFixed(1))}:{}),...extra};}
  window.__m6={
    start(k,plan){kind=k;legs=plan;legIndex=0;legT0=c().probe().t;mem={};log=[];events=[];lastSecond=-1;},
    /** Fly up to `seconds` of sim time; returns {done, rows}. */
    run(seconds){
      const ctl=c(),t0=ctl.probe().t;let fold=false;
      while(true){
        if(ctl.finished?.())return{done:true,finished:true,rows:log.length,last:row(ctl.probe())};
        const p=ctl.probe();
        if(p.t-t0>=seconds)return{done:false,rows:log.length,last:row(p)};
        if(Math.floor(p.t)!==lastSecond){lastSecond=Math.floor(p.t);log.push(row(p,{leg:legs[legIndex]?.name??legs[legIndex]?.kind??'end'}));}
        const leg=legs[legIndex];
        if(leg&&leg.kind==='pause'){events.push({t:p.t,event:`pause for ${leg.name??'the harness'}`,x:p.x,y:p.y,z:p.z});legIndex++;legT0=p.t;return{done:false,paused:true,rows:log.length,last:row(p)};}
        if(kind==='glider'){
          if(leg&&legDone(leg,p,mem,legT0)){events.push({t:p.t,event:`leg ${leg.name??leg.kind} done`,y:p.y,x:p.x,z:p.z});if(leg.kind==='fold')fold=true;legIndex++;legT0=p.t;mem={};}
          input=legs[legIndex]?gliderInput(legs[legIndex],p,mem):{bar:0,bank:0};
          ctl.update(DT,{forward:input.bar,strafe:input.bank,run:false,bar:input.bar,bank:input.bank,pull:false,look:[0,0],fold});fold=false;
        }else{
          input=chuteInput(leg,p);
          ctl.update(DT,{forward:0,strafe:0,run:false,bar:input.bar,bank:input.bank,pull:!!input.pull,look:[0,0]});
          if(input.pull&&!mem.pulled){mem.pulled=true;events.push({t:p.t,event:'pull (by hand)',agl:agl()});}
        }
        const q=ctl.probe();if(q.phase!==p.phase)events.push({t:q.t,event:`phase ${p.phase} → ${q.phase}`,x:+q.x.toFixed(1),y:+q.y.toFixed(1),z:+q.z.toFixed(1),airspeed:+q.airspeed.toFixed(2),vs:+q.vs.toFixed(2),groundSpeed:+q.groundSpeed.toFixed(2)});
      }
    },
    input:()=>input,
    log:()=>log,events:()=>events,
    probe:()=>c()?.probe(),
  };
})();
