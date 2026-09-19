/* Field planning preserves the original IDs and existing visit storage. */
(function (root) {
  'use strict';
  const keys={state:'toronto42-flow-v1',outcomes:'toronto42-outcomes-v1',visits:'toronto42-culinary-passport-v1',steps:'toronto42-nextsteps-v1'};
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch(_){return fallback;}}
  function minutes(t){const m=/^(\d{2}):(\d{2})$/.exec(String(t));return m&&+m[1]<24&&+m[2]<60?+m[1]*60+ +m[2]:NaN;}
  function clock(n){n=Math.max(0,Math.min(1439,Math.round(n)));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
  function torontoNow(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return{date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};}
  const scoreHiring={'CONFIRMED ACTIVE':40,'VERY RECENT SIGNAL':24,'GENERAL HIRING / ACCEPTING APPLICATIONS':12,'NO CURRENT HIRING FOUND':5,'STALE / HISTORICAL ONLY':0};
  function rank(r,cluster){const s=r.scores||{};return(scoreHiring[r.hiring.status]||0)+(s.fit||0)+(s.access||0)+(s.career||0)+(r.cluster===cluster?10:0)+(s.confidence||0);}
  function remaining(records,outcomes,state,date){return records.filter(r=>r.price.status==='PASS'&&!r.closedSaturday&&!r.operatingUncertain&&!outcomes[r.id]&&!((state.deferred||{})[r.id]===date||(state.deferred||{})[r.id]===true));}
  function transition(from,to,travel,records,cluster){
    if(String(from)===String(to.id))return{minutes:0,label:'You are already here',verified:false};
    const exact=(travel||[]).find(x=>String(x.from)===String(from)&&String(x.to)===String(to.id));if(exact)return exact;
    const origin=(records||[]).find(r=>String(r.id)===String(from)),same=(origin?origin.cluster:cluster)===to.cluster;
    return{minutes:same?20:50,label:same?'Allow 20 min within this area; confirm the actual walk in Maps':'Allow 50 min for this district change, including a buffer; check live transit in Maps',verified:false};
  }
  function plan(records,input,travel){
    const state=input.state||{},outcomes=input.outcomes||{},date=input.date,now=minutes(input.time),steps=input.steps||{},data=root.FLOW_DATA||{};
    const byId=id=>records.find(r=>String(r.id)===String(id));
    const allAnchors=(state.anchors||data.defaultAnchors||[]).filter(a=>a.date===date&&Number.isFinite(minutes(a.time))).sort((a,b)=>minutes(a.time)-minutes(b.time));
    const anchors=allAnchors.filter(a=>!a.done);
    if(date!==data.date)return{moves:[{kind:'refresh',title:'Refresh before using this route',reason:'Hours, hiring and visit windows were checked for Saturday, September 19. Select that date to inspect the baseline; recheck evidence for another day.'}],anchors,queue:[],deferred:records,pending:[]};
    if(!Number.isFinite(now))return{moves:[{kind:'refresh',title:'Choose a valid planning time',reason:'Enter the time in Toronto to calculate your next moves.'}],anchors,queue:[],deferred:records,pending:[]};
    const queue=remaining(records,outcomes,state,date).sort((a,b)=>rank(b,input.cluster)-rank(a,input.cluster));
    const applications=records.filter(r=>r.price.status==='PASS'&&!r.operatingUncertain&&r.hiring.status==='CONFIRMED ACTIVE'&&r.hiring.applicationUrl&&!outcomes[r.id]&&!((state.deferred||{})[r.id]===date||(state.deferred||{})[r.id]===true)).sort((a,b)=>rank(b,input.cluster)-rank(a,input.cluster));
    const pending=records.filter(r=>outcomes[r.id]==='apply-online'&&!steps[r.id+':apply-online:submit-application']);
    const result=moves=>({moves:moves.slice(0,3),anchors,queue,deferred:records.filter(r=>!queue.includes(r)),pending});
    const departed=allAnchors.find(a=>a.type==='departure'&&a.done&&minutes(a.time)<=now);
    if(departed)return result([{kind:'work',title:'Route finished for today',reason:'Your departure is marked complete. Keep contacts and requested applications in Next Steps.'}]);
    function buffer(a,from,cluster){const r=byId(a.stop);return Math.max(0,Number(a.travelMinutes)||0)+(r?transition(from,r,travel,records,cluster).minutes:0)+(a.type==='interview'?15:0);}
    function anchorMove(a,from,at){const r=byId(a.stop),start=minutes(a.time),late=at>start;return{kind:'anchor',record:r,title:a.title||(r?r.name:a.type),time:a.time,anchor:a,reason:late?'This commitment has started or is overdue. Mark it done or change its time before adding another visit.' :(a.assumption?'The saved plan includes this ':'You set this ')+a.type+'. Allow '+buffer(a,from,input.cluster)+' minutes for travel and preparation; '+(a.duration||30)+' minutes are reserved.'};}
    const due=anchors.find(a=>minutes(a.time)-buffer(a,state.currentStop,input.cluster)<=now);
    if(due){return result([anchorMove(due,state.currentStop,now)]);}
    const moves=[],selected=new Set();let at=now,from=state.currentStop||'',cluster=input.cluster;
    for(let i=0;i<3;i++){
      const nextAnchor=anchors.find(a=>minutes(a.time)>=at);
      const choices=queue.filter(r=>!selected.has(String(r.id))).flatMap(r=>{
        const trip=transition(from,r,travel,records,cluster);
        return(r.windows||[]).filter(w=>w.kind==='walkin'||(state.confirmedVisits||{})[r.id]).map(w=>{
          const arrive=Math.max(at+trip.minutes,minutes(w.start)),end=arrive+(r.onSiteMinutes||10),waiting=arrive-at-trip.minutes;
          const beforeAnchor=!nextAnchor||end+buffer(nextAnchor,r.id,r.cluster)<=minutes(nextAnchor.time);
          return{r,w,trip,arrive,end,waiting,valid:Number.isFinite(arrive)&&arrive>=now&&end<=minutes(w.end)&&arrive-at<=75&&beforeAnchor,weight:rank(r,cluster)-(arrive-at)/3};
        }).filter(c=>c.valid);
      }).sort((a,b)=>b.weight-a.weight);
      const c=choices[0];
      if(!c)break;
      if(c.waiting>20){moves.push({kind:'work',title:'Prepare before the next visit',time:clock(at),end:clock(c.arrive-c.trip.minutes),record:c.r,reason:'The useful visit window has not started. Review this restaurant, eat or reset nearby, and leave enough time for the journey.'});if(moves.length===3)break;}
      selected.add(String(c.r.id));moves.push({kind:'visit',record:c.r,time:clock(c.arrive),end:clock(c.end),reason:c.w.why,trip:c.trip,wait:c.waiting});at=c.end;from=c.r.id;cluster=c.r.cluster;if(moves.length===3)break;
    }
    if(!moves.length){
      const nextAnchor=anchors[0],lead=pending[0]||applications[0];
      const until=nextAnchor?minutes(nextAnchor.time)-buffer(nextAnchor,from,cluster):Math.min(now+45,1439);
      moves.push({kind:'work',title:pending.length?'Complete the applications you were asked to submit':'Applications, preparation and a reset',time:clock(now),end:clock(Math.max(now,until)),record:lead,reason:now<720?'Most dinner rooms are closed. Use this block for applications, printing and preparation.':now>=1020?'Dinner service is building. Follow up online and honour agreed appointments.':'Use this gap for food, applications and Hearth / Claude work. Call a priority restaurant to request an exact return time.'});
      if(nextAnchor)moves.push(anchorMove(nextAnchor,from,now));
      else{const second=pending[1]||applications.find(r=>r!==lead);if(second)moves.push({kind:'work',title:'Prepare the next live application',record:second,reason:'Read the exact role requirements and use this restaurant’s tailored application note. Record submission only after you complete it.'});moves.push({kind:'work',title:'Protect the next conversation',reason:'Confirm a manager’s return time, save it as an appointment, and reopen this plan when your location or outcome changes.'});}
    }else{const nextAnchor=anchors.find(a=>minutes(a.time)>=at);if(nextAnchor&&moves.length<3)moves.push(anchorMove(nextAnchor,from,at));}
    return result(moves);
  }
  function link(file,params){const q=new URLSearchParams(params||{}).toString();return location.hostname==='html-preview.github.io'?'https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2F'+encodeURIComponent(file)+(q?'&'+q:''):file+(q?'?'+q:'');}
  function maps(r,origin){return'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(r.name+' '+r.address+(/Toronto/i.test(r.address)?'':' Toronto'))+(origin?'&origin='+encodeURIComponent(origin):'')+'&travelmode=walking';}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function badges(r){return'<div class="flow-badges"><strong class="tier '+(r.tier==='A-GAME'?'agame':'')+'">'+esc(r.tier)+'</strong><span>'+esc(r.hiring.status)+'</span><span>Manager access: '+esc(r.access.likelihood)+'</span><span>Door risk: '+esc(r.access.risk)+'</span></div>';}
  root.PassportFlow={keys,read,minutes,clock,torontoNow,rank,plan,remaining,transition,link,maps,badges};if(typeof module!=='undefined')module.exports=root.PassportFlow;
})(typeof window!=='undefined'?window:globalThis);
