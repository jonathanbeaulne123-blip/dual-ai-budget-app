const K="toronto42-culinary-passport-v1",SK="toronto42-outcomes-v1";
let S=JSON.parse(localStorage.getItem(K)||"{}"),T=JSON.parse(localStorage.getItem(SK)||"{}"),F="all",OF="all",ACTIVE=null;
const STATUSES=[
{id:"chat",label:"Sat down and chatted (no confirmation)"},
{id:"no-manager",label:"Didn't get to talk to the manager"},
{id:"interview",label:"Got an interview"},
{id:"maybe",label:"Maybe"},
{id:"job",label:"Got the job"}
];
const C=document.querySelector("#content"),Q=document.querySelector("#q"),E=document.querySelector("#empty"),
esc=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])),
statusLabel=id=>(STATUSES.find(s=>s.id===id)||{}).label||"No outcome yet";
function save(){localStorage.setItem(K,JSON.stringify(S));localStorage.setItem(SK,JSON.stringify(T))}
function buildOutcomeFilter(){
 const sel=document.createElement("select");sel.id="outcomeFilter";sel.setAttribute("aria-label","Filter by visit outcome");
 sel.innerHTML='<option value="all">Outcome: All</option>'+STATUSES.map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join("")+'<option value="none">No outcome yet</option>';
 sel.onchange=()=>{OF=sel.value;filter()};document.querySelector("#reset").before(sel)
}
function buildModal(){
 const d=document.createElement("div");d.id="outcomeModal";d.className="modal";d.setAttribute("aria-hidden","true");
 d.innerHTML=`<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><button class="modal-x" type="button" aria-label="Close">×</button><div class="modal-kicker">Visit outcome</div><h2 id="modalTitle">How did it go?</h2><p id="modalRestaurant" class="modal-rest"></p><div class="status-options">${STATUSES.map(s=>`<button type="button" class="status-option" data-status="${s.id}">${esc(s.label)}</button>`).join("")}</div><div class="modal-foot"><button id="clearOutcome" type="button">Clear outcome</button><button id="cancelOutcome" type="button">Cancel</button></div></div>`;
 document.body.append(d);
 d.querySelectorAll(".status-option").forEach(b=>b.onclick=()=>chooseStatus(b.dataset.status));
 d.querySelector(".modal-x").onclick=cancelModal;d.querySelector("#cancelOutcome").onclick=cancelModal;d.querySelector("#clearOutcome").onclick=clearStatus;
 d.onclick=e=>{if(e.target===d)cancelModal()};
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&d.classList.contains("show"))cancelModal()})
}
function openModal(x,isNew=false,checkbox=null){
 ACTIVE={x,isNew,checkbox};document.querySelector("#modalRestaurant").textContent=x.r;
 const d=document.querySelector("#outcomeModal");d.classList.add("show");d.setAttribute("aria-hidden","false");
 document.querySelector("#clearOutcome").style.display=isNew?"none":"";
 setTimeout(()=>d.querySelector(".status-option").focus(),0)
}
function closeModal(){const d=document.querySelector("#outcomeModal");d.classList.remove("show");d.setAttribute("aria-hidden","true");ACTIVE=null}
function cancelModal(){if(ACTIVE&&ACTIVE.isNew&&ACTIVE.checkbox)ACTIVE.checkbox.checked=false;closeModal()}
function chooseStatus(id){if(!ACTIVE)return;S[ACTIVE.x.n]=1;T[ACTIVE.x.n]=id;save();closeModal();render()}
function clearStatus(){if(!ACTIVE)return;delete T[ACTIVE.x.n];save();closeModal();render()}
function render(){
 C.innerHTML="";
 B.forEach((b,i)=>{
  const a=D.filter(x=>x.b===b),sec=document.createElement("section"),n=a.filter(x=>S[x.n]).length;
  sec.innerHTML=`<div class="bh"><div><div class="bk">District ${i+1} · ${a.length} stops</div><h2>${esc(b.replace(/^Block \d+:\s*/,""))}</h2></div><div class="ba"><span class="bc" id="bc${i}">${n} / ${a.length} visited</span><a class="route" href="${esc(R[a[0].u])}" target="_blank" rel="noopener noreferrer">↗ Google Maps</a></div></div><div class="list"></div>`;
  const l=sec.querySelector(".list");
  a.forEach(x=>{
   const e=document.createElement("article"),visited=!!S[x.n],outcome=T[x.n]||"";
   e.className=visited?"done":"";e.dataset.n=x.n;e.dataset.s=[x.r,x.a,x.p,x.d,x.s,x.b].join(" ").toLowerCase();
   const badge=visited?`<button type="button" class="status-badge ${outcome?"has-status":"pending"}" data-edit-status>${esc(statusLabel(outcome))} <span>▾</span></button>`:"";
   e.innerHTML=`<div class="no">${x.n}</div><div><div class="tr"><h3>${esc(x.r)}</h3><span class="price">${esc(x.p)}</span>${badge}</div><div class="addr">${esc(x.a)}</div><p class="desc">${esc(x.d)}</p><div class="next"><b>Next stop:</b> ${esc(x.s)}</div><a class="route mobile" href="${esc(R[x.u])}" target="_blank" rel="noopener noreferrer">↗ Google Maps</a></div><div class="cw"><label for="c${x.n}">Visited</label><input id="c${x.n}" type="checkbox" ${visited?"checked":""}></div>`;
   const cb=e.querySelector("input");
   cb.onchange=()=>{
    if(cb.checked){openModal(x,true,cb)}
    else{delete S[x.n];delete T[x.n];save();render()}
   };
   const edit=e.querySelector("[data-edit-status]");if(edit)edit.onclick=()=>openModal(x,false);
   l.append(e)
  });C.append(sec)
 });prog();filter()
}
function prog(){
 const n=D.filter(x=>S[x.n]).length,p=Math.round(n/D.length*100);
 document.querySelector("#done").textContent=n;document.querySelector("#pct").textContent=p+"% complete";document.querySelector("#fill").style.width=p+"%";
 B.forEach((b,i)=>{const a=D.filter(x=>x.b===b),n=a.filter(x=>S[x.n]).length,z=document.querySelector("#bc"+i);if(z)z.textContent=n+" / "+a.length+" visited"})
}
function filter(){
 const q=Q.value.trim().toLowerCase();let v=0;
 document.querySelectorAll("article").forEach(e=>{
  const n=e.dataset.n,d=!!S[n],base=F==="all"||(F==="done"&&d)||(F==="open"&&!d),
  outcome=OF==="all"||(OF==="none"&&d&&!T[n])||(T[n]===OF),
  ok=(!q||e.dataset.s.includes(q))&&base&&outcome;
  e.classList.toggle("hide",!ok);if(ok)v++
 });
 document.querySelectorAll("section").forEach(s=>s.style.display=s.querySelector("article:not(.hide)")?"":"none");E.style.display=v?"none":"block"
}
Q.oninput=filter;
document.querySelectorAll(".f").forEach(b=>b.onclick=()=>{document.querySelectorAll(".f").forEach(x=>x.classList.remove("on"));b.classList.add("on");F=b.dataset.f;filter()});
document.querySelector("#reset").onclick=()=>{if(confirm("Clear all 42 visited checkmarks and outcomes?")){S={};T={};localStorage.removeItem(K);localStorage.removeItem(SK);render()}};
buildOutcomeFilter();buildModal();render();