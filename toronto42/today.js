/* Today: the application queue and the week's routes, phone-first. Shares the workshop's saved records. */
(function(){
'use strict';
const F=window.PassportFlow,A=window.PASSPORT_AUDIT,P=window.PASSPORT_PREP,L=window.PASSPORT_LETTERS,G=window.PLAN_GEO;
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const $=s=>document.querySelector(s);
const all=window.FLOW_DATA.restaurants,get=id=>all.find(r=>String(r.id)===String(id)),disc=id=>window.PASSPORT_DISCOVERIES.find(x=>x.id===id);
const ASSESS=['N21','C01'];
let state=F.read(P.key,{});state.apps=state.apps||{};state.batch=Array.isArray(state.batch)?state.batch:P.defaults.slice();state.sprees=state.sprees||{};state.blocks=state.blocks||{};
function save(){try{localStorage.setItem(P.key,JSON.stringify(state));}catch(_){}}
function app(id){const a=state.apps[id]||(state.apps[id]={checks:{}});if(ASSESS.includes(id))a.assessmentRequired=true;return a;}
const today=F.torontoNow().date;
document.querySelectorAll('#topnav a').forEach(a=>{const f=a.getAttribute('href');const [file,qs]=f.split('?');a.href=F.link(file,qs?Object.fromEntries(new URLSearchParams(qs)):undefined);});
$('#dateLine').textContent=new Date(today+'T12:00:00').toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).replace(',',' ·');

const rows=A.rows;
const events=rows.filter(r=>/^Interview/.test(r.wave)),tonight=rows.filter(r=>r.wave==='First wave'),sunday=rows.filter(r=>r.wave==='Second wave'),later=rows.filter(r=>!['First wave','Second wave'].includes(r.wave)&&!/^Interview/.test(r.wave));
function firstSentence(t){const m=String(t||'').match(/^[^.!?]*[.!?]/);return m?m[0]:String(t||'');}
function letterFor(id){const r=get(id),a=P.angles[id];return (L.drafts[id])||L.generic(r,a);}

function card(row,index){
 const id=row.id,r=get(id),d=disc(id),a=P.angles[id]||{},s=app(id);
 const apply=r.hiring.applicationUrl||r.hiring.careersUrl||d?.url||'';
 const done=!!s.submitted,assessPending=s.assessmentRequired&&s.submitted&&!s.assessmentDone;
 const extra=(d?.extra||[]).filter(([,u])=>u&&u!==apply);
 const tagUrg=row.urgency==='immediate'?'<span class="tag ok">Immediate start</span>':row.urgency==='later'?'<span class="tag warn">Later start</span>':'';
 return `<article class="card ${done?'done':''}" data-id="${e(id)}">
  <div class="kicker"><span class="num">${index}</span><span>${e(row.group)}</span>${tagUrg}${done?'<span class="tag ok">Submitted'+(s.submittedDate?' '+e(s.submittedDate.slice(5)):'')+'</span>':''}${assessPending?'<span class="tag warn">Assessment pending</span>':''}</div>
  <h3>${e(r.name)}</h3>
  <div class="role">${e(row.role)}${d?.pay?' · '+e(d.pay.replace(/ advertised| \(advertised\)/g,'')):''}</div>
  <p class="why">${e(row.why)}</p>
  <dl class="facts">${d?.transit?'<dt>Getting there</dt><dd>'+e(firstSentence(d.transit))+'</dd>':''}<dt>Watch for</dt><dd>${e(row.gate)}</dd></dl>
  <div class="actions">${apply?'<a class="btn primary" target="_blank" rel="noopener noreferrer" href="'+e(apply)+'">Open the posting ↗</a>':'<span class="btn ghost">No live link — see details</span>'}<button class="btn" type="button" data-letter="${e(id)}">Cover letter</button></div>
  <div class="letter" id="letter-${e(id)}" hidden>
   <p class="hint">Drafted from your résumé for this role. Fill or delete anything in [brackets]. Your edits save here and appear in the workshop.</p>
   <textarea data-letter-text="${e(id)}" spellcheck="true"></textarea>
   <div class="actions"><button class="btn small" type="button" data-copy="${e(id)}">Copy letter</button><button class="btn small ghost" type="button" data-reset="${e(id)}">Reset to draft</button><span class="status" data-status="${e(id)}"></span></div>
  </div>
  <label class="check"><input type="checkbox" data-submitted="${e(id)}" ${done?'checked':''}> I submitted this application</label>
  ${s.assessmentRequired?'<label class="check"><input type="checkbox" data-assess="'+e(id)+'" '+(s.assessmentDone?'checked':'')+'> AssessFirst questionnaire completed</label>':''}
  <details class="more"><summary>Details, requirements and what to say</summary>
   ${a.pitch?'<div class="lbl">Your angle</div><p>'+e(a.pitch)+'</p>':''}
   ${a.proof?'<div class="lbl">Proof story to have ready</div><p>'+e(a.proof)+'</p>':''}
   <div class="lbl">Requirements as posted</div><p>${e(r.hiring.requirements||'Reopen the posting.')}</p>
   ${a.portal?'<div class="lbl">Portal note</div><p>'+e(a.portal)+'</p>':''}
   <div class="lbl">Hiring evidence</div><p>${e(d?.job||r.hiring.caveat||r.hiring.status)}</p>
   ${d?.transit?'<div class="lbl">Transit</div><p>'+e(d.transit)+'</p>':''}
   ${extra.length?'<div class="lbl">Alternatives at this employer</div><div class="alts">'+extra.map(([l,u])=>'<a target="_blank" rel="noopener noreferrer" href="'+e(u)+'">'+e(l)+' ↗</a>').join('')+'</div>':''}
   <div class="actions"><a class="btn small" href="${e(F.link('day.html',{stop:id}))}">Open in workshop</a><a class="btn small ghost" href="${e(F.link('restaurant.html',{stop:id,view:'summary'}))}">Full brief</a></div>
  </details>
 </article>`;
}
function eventCard(row){
 const id=row.id,r=get(id),a=P.angles[id]||{},ev=(A.knownEvents||[]).find(x=>x.id===id)||{},s=app(id);
 const when=ev.at?new Date(ev.at).toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})+' · '+ev.at.slice(11):'';
 const spree=(P.sprees||[]).find(b=>b.anchor&&b.anchor.id===id);
 return `<article class="card" data-id="${e(id)}" style="border-color:var(--a);box-shadow:0 10px 28px #7a2f2f22">
  <div class="kicker"><span class="tag">Interview</span><span>${e(when)}</span></div>
  <h3>${e(r.name)}</h3>
  <div class="role">${e(ev.where||r.address)}</div>
  <p class="why">${e(row.why)}</p>
  <dl class="facts"><dt>Get there</dt><dd>${e((a.portal||'').split('Bring')[0])}</dd><dt>Bring</dt><dd>Two printed résumés, Smart Serve on your phone, references with permission.</dd><dt>Ask them</dt><dd>Which role and shifts they are filling · training and start date · how tips are pooled · when they decide · actual clock-out time.</dd></dl>
  <div class="actions">${spree?'<a class="btn primary" href="'+e(F.link('route.html',{day:spree.id}))+'">Tuesday route</a>':''}<a class="btn" href="${e(F.link('hireability.html'))}">Mock drill</a><button class="btn" type="button" data-letter="${e(id)}">Thank-you note</button></div>
  <div class="letter" id="letter-${e(id)}" hidden><p class="hint">Send the evening of the interview. Fill in the name and one specific thing from the conversation.</p><textarea data-letter-text="${e(id)}" spellcheck="true"></textarea><div class="actions"><button class="btn small" type="button" data-copy="${e(id)}">Copy</button><button class="btn small ghost" type="button" data-reset="${e(id)}">Reset to draft</button><span class="status" data-status="${e(id)}"></span></div></div>
  <details class="more"><summary>Prep: your angle, three stories, what to study</summary>
   <div class="lbl">Your angle</div><p>${e(a.pitch||'')}</p>
   <div class="lbl">Three stories</div><p>${e(a.proof||'')}</p>
   <div class="lbl">Study tonight</div><p>${e(a.study||'')}</p>
   <div class="lbl">Practice question</div><p>${e(a.question||'')}</p>
   <div class="lbl">Watch for</div><p>${e(row.gate)}</p>
   <div class="actions"><a class="btn small" href="${e(F.link('day.html',{stop:id}))}">Open in workshop</a><a class="btn small ghost" href="${e(F.link('restaurant.html',{stop:id,view:'summary'}))}">Full brief</a>${r.hiring.applicationUrl?'<a class="btn small ghost" target="_blank" rel="noopener noreferrer" href="'+e(r.hiring.applicationUrl)+'">Posting ↗</a>':''}</div>
  </details>
 </article>`;
}
function renderLists(){
 if(events.length){$('#eventBlock').hidden=false;$('#eventList').innerHTML='<div class="block-head"><div><h2>Interview</h2><p>Fixed point of the week. Everything else bends around it.</p></div></div>'+events.map(eventCard).join('');}
 $('#listTonight').innerHTML=tonight.map((r,i)=>card(r,i+1)).join('');
 $('#listSunday').innerHTML=sunday.map((r,i)=>card(r,tonight.length+i+1)).join('');
 const waves=[...new Set(later.map(r=>r.wave))];
 $('#listLater').innerHTML=waves.map(w=>'<h3 style="margin:14px 0 4px">'+e(w)+'</h3>'+later.filter(r=>r.wave===w).map(r=>card(r,tonight.length+sunday.length+later.indexOf(r)+1)).join('')).join('');
 bind();progress();
}
function bind(){
 document.querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>{const id=b.dataset.letter,box=document.getElementById('letter-'+id),ta=box.querySelector('textarea');box.hidden=!box.hidden;if(!box.hidden){if(!ta.value){const s=app(id);ta.value=s.letter||letterFor(id);}ta.focus();}});
 document.querySelectorAll('[data-letter-text]').forEach(ta=>ta.oninput=()=>{const id=ta.dataset.letterText,s=app(id);s.letter=ta.value;if(!state.batch.includes(id))state.batch.push(id);save();setStatus(id,'Saved');});
 document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const id=b.dataset.copy,ta=document.querySelector('[data-letter-text="'+id+'"]');if(!ta.value)ta.value=app(id).letter||letterFor(id);try{await navigator.clipboard.writeText(ta.value);setStatus(id,'Copied to clipboard');}catch(_){ta.select();document.execCommand&&document.execCommand('copy');setStatus(id,'Selected — press copy');}});
 document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{const id=b.dataset.reset;if(!confirm('Replace your edits with the original draft for this role?'))return;const ta=document.querySelector('[data-letter-text="'+id+'"]');ta.value=letterFor(id);app(id).letter=ta.value;save();setStatus(id,'Draft restored');});
 document.querySelectorAll('[data-submitted]').forEach(c=>c.onchange=()=>{const id=c.dataset.submitted,s=app(id);s.submitted=c.checked;if(c.checked){if(!s.submittedDate)s.submittedDate=today;if(!s.stage)s.stage='submitted';if(!state.batch.includes(id))state.batch.push(id);}save();renderLists();});
 document.querySelectorAll('[data-assess]').forEach(c=>c.onchange=()=>{const s=app(c.dataset.assess);s.assessmentDone=c.checked;save();renderLists();});
}
function setStatus(id,msg){const el=document.querySelector('[data-status="'+id+'"]');if(!el)return;el.textContent=msg;clearTimeout(el._t);el._t=setTimeout(()=>el.textContent='',2500);}
function progress(){
 const done=ids=>ids.filter(r=>app(r.id).submitted).length;
 const t=done(tonight),w=t+done(sunday),total=tonight.length+sunday.length;
 $('#tonightDone').textContent=t;$('#tonightTotal').textContent=tonight.length;$('#weekendDone').textContent=w;$('#weekendTotal').textContent=total;
 $('#progressFill').style.width=Math.round(w/total*100)+'%';
 const groups=new Set([...tonight,...sunday].filter(r=>app(r.id).submitted).map(r=>r.group));
 const iv=Object.values(state.apps).filter(a=>a.stage==='interview').length;
 $('#progressNote').textContent=(iv?iv+' interview'+(iv===1?'':'s')+' arranged. ':'')+(w?groups.size+' employer group'+(groups.size===1?'':'s')+' reached. ':'')+'A submission is a record you make here, not a portal reading. A confirmation email is not an offer.';
}
function routeCards(){
 const dayName=d=>new Date(d+'T12:00:00').toLocaleDateString('en-CA',{weekday:'short'});
 const dayNum=d=>new Date(d+'T12:00:00').getDate();
 $('#routeList').innerHTML=P.sprees.map(b=>{const s=state.sprees[b.id]||{date:b.date,start:b.start,omitted:(b.omitted||[]).slice()};const stops=b.stops.filter(x=>!(s.omitted||[]).includes(x.id));const optional=/optional|invited/i.test(b.preferred||'');
  return '<a class="card route-card '+(optional?'optional':'')+'" href="'+e(F.link('route.html',{day:b.id}))+'"><div class="day"><small>'+e(dayName(s.date))+'</small>'+dayNum(s.date)+'</div><div><h3>'+e(b.name)+'</h3><div class="meta">'+e(G.stations[b.station]?.short||b.station)+' · arrive '+e(s.start)+' · '+stops.length+' stop'+(stops.length===1?'':'s')+(stops.length?': '+stops.map(x=>get(x.id)?.name.replace(/ ·.*$/,'')).join(', '):'')+(optional?' · optional':'')+'</div></div><span class="arrow">›</span></a>';}).join('');
 $('#travelNote').textContent='Last train home from Union: 23:47 Mon–Thu · 00:47 Fri–Sat · 00:17 Sun. GO→TTC and MiWay transfers are free on one card (One Fare). Fares and exact trains: check the GO planner for the date you travel.';
}
function toolLinks(){
 $('#toolLinks').innerHTML=[['day.html','Workshop','Prep checklist, weekly board, visit drafts'],['nextsteps.html','Follow-ups','Replies, interviews, contacts'],['hireability.html','Hireability','Passport, evidence bank, mock drill'],['map.html','Route Portal','Map with this week’s routes'],['index.html','All venues','135 rooms, filters, quick briefs'],['restaurant.html?stop=N12&view=summary','Briefs','Per-venue notes and sources']].map(([f,t,d])=>{const [file,qs]=f.split('?');return '<a href="'+e(F.link(file,qs?Object.fromEntries(new URLSearchParams(qs)):undefined))+'">'+e(t)+'<small>'+e(d)+'</small></a>';}).join('');
}
renderLists();routeCards();toolLinks();
const focus=new URLSearchParams(location.search).get('stop');if(focus){const el=document.querySelector('[data-id="'+focus+'"]');if(el){const det=el.closest('details');if(det)det.open=true;el.scrollIntoView({block:'start'});}}
})();
