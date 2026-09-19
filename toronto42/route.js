/* One outing per page, phone-first. Reads the same visit drafts and outcomes the workshop and checklist use. */
(function(){
'use strict';
const F=window.PassportFlow,A=window.PASSPORT_AUDIT,P=window.PASSPORT_PREP,G=window.PLAN_GEO,T=window.PASSPORT_TRAVEL;
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const $=s=>document.querySelector(s);
const all=window.FLOW_DATA.restaurants,get=id=>all.find(r=>String(r.id)===String(id)),disc=id=>window.PASSPORT_DISCOVERIES.find(x=>x.id===id),intel=id=>(window.RESTAURANT_INTEL||{})[id];
const VK='toronto42-culinary-passport-v1',OK='toronto42-outcomes-v1';
const STATUSES=[['chat','Chatted'],['no-manager','No manager'],['interview','Interview!'],['maybe','Maybe'],['apply-online','Apply online'],['job','Got the job']];
let state=F.read(P.key,{});state.sprees=state.sprees||{};state.apps=state.apps||{};
let S=F.read(VK,{}),O=F.read(OK,{});
function save(){try{localStorage.setItem(P.key,JSON.stringify(state));}catch(_){}}
function saveVisits(){try{localStorage.setItem(VK,JSON.stringify(S));localStorage.setItem(OK,JSON.stringify(O));}catch(_){}}
document.querySelectorAll('#topnav a').forEach(a=>{const f=a.getAttribute('href');a.href=F.link(f);});
const sprees=P.sprees.slice().sort((a,b)=>((state.sprees[a.id]||a).date).localeCompare((state.sprees[b.id]||b).date));
const want=new URLSearchParams(location.search).get('day');
const b=sprees.find(x=>x.id===want)||sprees[0];
const s=state.sprees[b.id]||(state.sprees[b.id]={date:b.date,start:b.start,omitted:(b.omitted||[]).slice()});
const plan=window.PassportPrep.schedule(b,s.date,s.start,s.omitted||[]);
const dayLabel=new Date(s.date+'T12:00:00').toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'});
const st=G.stations[b.station]||{},rail=G.rail[b.station];
const mapsDir=(o,d,mode)=>'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(o)+'&destination='+encodeURIComponent(d)+'&travelmode='+mode;
const addr=id=>{const r=get(id);return r?r.name+', '+r.address:'';};
function min(t){const[h,m]=t.split(':').map(Number);return h*60+m;}
function clock(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function trainSuggestion(){
 if(!rail)return '';
 const first=plan.stops.find(x=>x.arrival);if(!first&&!b.anchor)return '';
 const needArrive=b.anchor?min(b.anchor.arriveBy)-8-30:min(first.arrival)-(b.id==='union-core'?8:b.id==='port-credit'?8:b.id==='oakville'?15:8);
 const deps=rail.dir==='east'?[8,38]:[23,53];
 let best=null;for(let h=6;h<=23;h++)for(const m of deps){const dep=h*60+m,arr=dep+rail.minutes;if(arr<=needArrive)best=[dep,arr];}
 if(!best)return '';
 return '<div class="big">Leave Clarkson '+clock(best[0])+' → '+e(st.short||b.station)+' '+clock(best[1])+'</div><p class="note" style="margin:4px 0 0">'+(b.anchor?'Thirty minutes of buffer before an interview; the next train would still make it, with none. ':'')+'Off-peak trains run every 30 minutes ('+(rail.dir==='east'?':08 and :38':':23 and :53')+' from Clarkson, '+rail.minutes+' min). Weekday afternoon expresses may skip smaller stations. Confirm the exact departure in the GO planner for '+e(s.date)+'.</p>';
}
function render(){
 $('#dayTabs').innerHTML=sprees.map(x=>{const sx=state.sprees[x.id]||x;const d=new Date(sx.date+'T12:00:00');return '<a class="btn small '+(x.id===b.id?'primary':'')+'" href="'+e(F.link('route.html',{day:x.id}))+'">'+d.toLocaleDateString('en-CA',{weekday:'short'})+' '+d.getDate()+' · '+e(x.name.replace(/ ·.*$/,''))+'</a>';}).join('');
 $('#routeEyebrow').textContent=dayLabel+' · '+(st.short||b.station);
 $('#routeTitle').textContent=b.name;
 $('#routeWhy').textContent=b.why;
 const included=plan.stops.filter(x=>x.arrival);
 $('#trainBox').innerHTML=(plan.error?'<div class="big">'+e(plan.error)+'</div>':trainSuggestion()||'<div class="big">Arrive '+e(s.start)+' at the first stop</div>')+'<p class="note" style="margin:6px 0 0">'+e(b.entry)+'</p>';
 const wp=included.map(x=>addr(x.id));
 const origin=b.anchor?b.anchor.address:b.station;
 const whole=wp.length?'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(origin)+'&destination='+encodeURIComponent(wp[wp.length-1])+(wp.length>1?'&waypoints='+encodeURIComponent(wp.slice(0,-1).join('|')):'')+'&travelmode=walking':'';
 $('#routeActions').innerHTML=(whole?'<a class="btn primary" target="_blank" rel="noopener noreferrer" href="'+e(whole)+'">Whole route in Google Maps ↗</a>':'')+'<a class="btn" target="_blank" rel="noopener noreferrer" href="'+e(mapsDir('Clarkson GO, Mississauga',b.station,'transit'))+'">Trains out ↗</a><a class="btn" target="_blank" rel="noopener noreferrer" href="'+e(mapsDir(b.station,'Clarkson GO, Mississauga','transit'))+'">Trains home ↗</a><a class="btn ghost" href="'+e(F.link('map.html',{planRoute:b.id}))+'">See it on the map</a>';
 let prev=b.anchor?b.anchor.address:b.station,n=0;
 const anchorHtml=b.anchor?(()=>{const r=get(b.anchor.id),a=P.angles[b.anchor.id]||{};return '<li class="stop anchor"><div class="dot">★</div><div class="card" style="border-color:var(--a)"><div class="kicker"><span class="tag">'+e(b.anchor.label)+'</span><span class="tag ok">Arrive by '+e(b.anchor.arriveBy)+'</span></div><div class="time">'+e(b.anchor.time)+'</div><h3>'+e(r?r.name:b.anchor.id)+'</h3><div class="role">'+e(b.anchor.address)+'</div><p class="why">'+e(b.anchor.note)+'</p>'+(a.portal?'<div class="say"><strong>Plan:</strong> '+e(a.portal)+'</div>':'')+(a.question?'<p class="note"><strong>Practice question:</strong> '+e(a.question)+'</p>':'')+'<div class="actions"><a class="btn small" target="_blank" rel="noopener noreferrer" href="'+e(mapsDir(b.station,b.anchor.address,'walking'))+'">Walk from '+e(st.short||'station')+' ↗</a><a class="btn small ghost" href="'+e(F.link('today.html',{stop:b.anchor.id}))+'">Interview prep</a><a class="btn small ghost" href="'+e(F.link('hireability.html'))+'">Mock drill</a></div></div></li>';})():'';
 $('#timeline').innerHTML=anchorHtml+plan.stops.map(x=>{const r=get(x.id),d=disc(x.id),i=intel(x.id),skip=!!x.excluded,here=addr(x.id);if(!skip)n++;
  const vis=!!S[x.id],out=O[x.id]||'';
  const walkBtn=skip?'':'<a class="btn small" target="_blank" rel="noopener noreferrer" href="'+e(mapsDir(prev,here,'walking'))+'">Walk here ↗</a>';
  const apply=r.hiring.applicationUrl||r.hiring.careersUrl||'';
  const html='<li class="stop '+(skip?'skip':'')+'"><div class="dot">'+(skip?'–':n)+'</div><div class="card">'
   +'<div class="time">'+(skip?'Not in this draft':e(x.arrival)+'–'+e(x.end))+'</div><h3>'+e(r.name)+'</h3><div class="role">'+e(r.address)+'</div>'
   +(skip?'<p class="note">'+e(x.excluded)+'</p>':'')
   +'<p class="why">'+e(x.note)+'</p>'
   +(!skip?'<div class="say"><strong>Say:</strong> '+e(i?.walkIn?.opening||'Hi, I’m Jonathan. I’ve led bars and worked upscale service and private events. Is there a good person or time to ask about front-of-house openings?')+'<br><strong>Ask for:</strong> '+e(i?.walkIn?.askFor||'whoever handles front-of-house hiring')+'</div>':'')
   +'<dl class="facts"><dt>Hours</dt><dd>'+e(x.hours)+'</dd>'+(d?.roles?'<dt>Role</dt><dd>'+e(d.roles)+(d.pay?' · '+e(d.pay):'')+'</dd>':'')+'</dl>'
   +'<div class="actions">'+walkBtn+(apply?'<a class="btn small ghost" target="_blank" rel="noopener noreferrer" href="'+e(apply)+'">Posting ↗</a>':'')+'<a class="btn small ghost" href="'+e(F.link('restaurant.html',{stop:x.id,view:'summary'}))+'">Brief</a><a class="btn small ghost" target="_blank" rel="noopener noreferrer" href="'+e(x.url)+'">Hours source ↗</a></div>'
   +(!skip?'<div class="outcomes" data-outcome="'+e(x.id)+'">'+STATUSES.map(([k,l])=>'<button type="button" data-k="'+k+'" class="'+(out===k?'on':'')+'">'+e(l)+'</button>').join('')+(vis?'<button type="button" data-k="" class="ghost">Clear</button>':'')+'</div>':'')
   +'</div></li>';
  if(!skip)prev=here;return html;}).join('');
 $('#returnBox').innerHTML='<h3>Getting home</h3><p class="why">'+e(T?.returnNote||'')+'</p><div class="actions"><a class="btn small" target="_blank" rel="noopener noreferrer" href="https://www.gotransit.com/en/plan-your-trip">GO planner ↗</a><a class="btn small ghost" target="_blank" rel="noopener noreferrer" href="https://www.ttc.ca/service-advisories">TTC notices ↗</a></div><p class="note">Budget ≤ C$30 per direction including any optional Uber. Fares shown anywhere in this app are estimates until you tap.</p>';
 $('#routeNotes').value=s.notes||'';
 const i=sprees.indexOf(b);$('#pager').innerHTML=(i>0?'<a class="btn" href="'+e(F.link('route.html',{day:sprees[i-1].id}))+'">‹ '+e(sprees[i-1].name.replace(/ ·.*$/,''))+'</a>':'<span></span>')+(i<sprees.length-1?'<a class="btn" href="'+e(F.link('route.html',{day:sprees[i+1].id}))+'">'+e(sprees[i+1].name.replace(/ ·.*$/,''))+' ›</a>':'<a class="btn" href="'+e(F.link('today.html'))+'">Back to Today</a>');
 document.querySelectorAll('[data-outcome]').forEach(box=>box.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{const id=box.dataset.outcome,k=btn.dataset.k;if(k){S[id]=1;O[id]=k;}else{delete S[id];delete O[id];}saveVisits();render();}));
 $('#routeNotes').oninput=()=>{s.notes=$('#routeNotes').value;save();$('#notesStatus').textContent='Saved';clearTimeout(render._t);render._t=setTimeout(()=>$('#notesStatus').textContent='',2000);};
}
render();
})();
