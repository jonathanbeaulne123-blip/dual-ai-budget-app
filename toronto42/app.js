const K="toronto42-culinary-passport-v1",SK="toronto42-outcomes-v1",CK="toronto42-custom-stops-v1";
let S=JSON.parse(localStorage.getItem(K)||"{}"),T=JSON.parse(localStorage.getItem(SK)||"{}"),X=JSON.parse(localStorage.getItem(CK)||"[]"),F="all",OF="all",ACTIVE=null;
const STATUSES=[
{id:"chat",label:"Sat down and chatted (no confirmation)"},
{id:"no-manager",label:"Didn't get to talk to the manager"},
{id:"interview",label:"Got an interview"},
{id:"maybe",label:"Maybe"},
{id:"apply-online",label:"Need to apply online"},
{id:"job",label:"Got the job"}
];
const C=document.querySelector("#content"),Q=document.querySelector("#q"),E=document.querySelector("#empty"),
esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])),
statusLabel=id=>(STATUSES.find(s=>s.id===id)||{}).label||"No outcome yet",
allStops=()=>D.concat(X),
mapSearch=x=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([x.r,x.a].filter(Boolean).join(" ")),
portalUrl=params=>{
 const qs=new URLSearchParams(params||{}).toString();
 if(location.hostname==="html-preview.github.io"){
   const base="https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2Fmap.html";
   return base+(qs?"&"+qs:"");
 }
 return "map.html"+(qs?"?"+qs:"");
};
function save(){localStorage.setItem(K,JSON.stringify(S));localStorage.setItem(SK,JSON.stringify(T));localStorage.setItem(CK,JSON.stringify(X))}
function buildOutcomeFilter(){
 const sel=document.createElement("select");sel.id="outcomeFilter";sel.setAttribute("aria-label","Filter by visit outcome");
 sel.innerHTML='<option value="all">Outcome: All</option>'+STATUSES.map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join("")+'<option value="none">No outcome yet</option>';
 sel.onchange=()=>{OF=sel.value;filter()};document.querySelector("#reset").before(sel)
}
function buildOutcomeModal(){
 const d=document.createElement("div");d.id="outcomeModal";d.className="modal";d.setAttribute("aria-hidden","true");
 d.innerHTML=`<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><button class="modal-x" type="button" aria-label="Close">×</button><div class="modal-kicker">Visit outcome</div><h2 id="modalTitle">How did it go?</h2><p id="modalRestaurant" class="modal-rest"></p><div class="status-options">${STATUSES.map(s=>`<button type="button" class="status-option" data-status="${s.id}">${esc(s.label)}</button>`).join("")}</div><div class="modal-foot"><button id="clearOutcome" type="button">Clear outcome</button><button id="cancelOutcome" type="button">Cancel</button></div></div>`;
 document.body.append(d);
 d.querySelectorAll(".status-option").forEach(b=>b.onclick=()=>chooseStatus(b.dataset.status));
 d.querySelector(".modal-x").onclick=cancelOutcomeModal;d.querySelector("#cancelOutcome").onclick=cancelOutcomeModal;d.querySelector("#clearOutcome").onclick=clearStatus;
 d.onclick=e=>{if(e.target===d)cancelOutcomeModal()}
}
function buildAddModal(){
 const d=document.createElement("div");d.id="addModal";d.className="modal";d.setAttribute("aria-hidden","true");
 d.innerHTML=`<form class="modal-card add-card" id="addForm"><button class="modal-x" type="button" aria-label="Close">×</button><div class="modal-kicker">Unexpected stop</div><h2>Add a restaurant</h2><p class="modal-rest">Add somewhere you found while you were out. You can mark it visited and choose an outcome afterward.</p><label class="field"><span>Restaurant name *</span><input id="newName" required maxlength="100" autocomplete="organization" placeholder="Restaurant name"></label><label class="field"><span>Address</span><input id="newAddress" maxlength="160" autocomplete="street-address" placeholder="Street address"></label><label class="field"><span>Notes</span><textarea id="newNotes" maxlength="400" rows="4" placeholder="Why you stopped, who you spoke with, anything worth remembering…"></textarea></label><div class="modal-foot"><button type="button" id="cancelAdd">Cancel</button><button type="submit" class="primary">Add stop</button></div></form>`;
 document.body.append(d);
 d.querySelector(".modal-x").onclick=closeAddModal;d.querySelector("#cancelAdd").onclick=closeAddModal;d.querySelector("#addForm").onsubmit=addCustomStop;
 d.onclick=e=>{if(e.target===d)closeAddModal()}
}
function openAddModal(){
 const d=document.querySelector("#addModal");d.classList.add("show");d.setAttribute("aria-hidden","false");
 document.querySelector("#addForm").reset();setTimeout(()=>document.querySelector("#newName").focus(),0)
}
function closeAddModal(){const d=document.querySelector("#addModal");d.classList.remove("show");d.setAttribute("aria-hidden","true")}
function addCustomStop(e){
 e.preventDefault();const name=document.querySelector("#newName").value.trim();if(!name)return;
 const address=document.querySelector("#newAddress").value.trim(),notes=document.querySelector("#newNotes").value.trim();
 const id="x-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
 X.push({b:"Unexpected Stops",n:id,r:name,a:address,p:"Unexpected stop",d:notes||"Unexpected stop added during the route.",s:"Added on the fly.",custom:true,added:Date.now()});
 save();closeAddModal();render();setTimeout(()=>document.querySelector('[data-n="'+id+'"]')?.scrollIntoView({behavior:"smooth",block:"center"}),50)
}
function openOutcomeModal(x,isNew=false,checkbox=null){
 ACTIVE={x,isNew,checkbox};document.querySelector("#modalRestaurant").textContent=x.r;
 const d=document.querySelector("#outcomeModal");d.classList.add("show");d.setAttribute("aria-hidden","false");
 document.querySelector("#clearOutcome").style.display=isNew?"none":"";
 setTimeout(()=>d.querySelector(".status-option").focus(),0)
}
function closeOutcomeModal(){const d=document.querySelector("#outcomeModal");d.classList.remove("show");d.setAttribute("aria-hidden","true");ACTIVE=null}
function cancelOutcomeModal(){if(ACTIVE&&ACTIVE.isNew&&ACTIVE.checkbox)ACTIVE.checkbox.checked=false;closeOutcomeModal()}
function chooseStatus(id){if(!ACTIVE)return;S[ACTIVE.x.n]=1;T[ACTIVE.x.n]=id;save();closeOutcomeModal();render()}
function clearStatus(){if(!ACTIVE)return;delete T[ACTIVE.x.n];save();closeOutcomeModal();render()}
function removeCustom(x){
 if(!confirm("Remove "+x.r+" from unexpected stops?"))return;
 X=X.filter(y=>y.n!==x.n);delete S[x.n];delete T[x.n];save();render()
}
function renderCard(x,l){
 const e=document.createElement("article"),visited=!!S[x.n],outcome=T[x.n]||"",map=x.custom?portalUrl({}):portalUrl({focusStop:x.n});
 e.className=visited?"done":"";e.dataset.n=x.n;e.dataset.s=[x.r,x.a,x.p,x.d,x.s,x.b].join(" ").toLowerCase();
 const badge=visited?`<button type="button" class="status-badge ${outcome?"has-status":"pending"}" data-edit-status>${esc(statusLabel(outcome))} <span>▾</span></button>`:"";
 const remove=x.custom?'<button type="button" class="remove-stop" data-remove>Remove</button>':"";
 const num=x.custom?"＋":x.n;
 e.innerHTML=`<div class="no">${num}</div><div><div class="tr"><h3>${esc(x.r)}</h3><span class="price">${esc(x.p)}</span>${badge}</div><div class="addr">${esc(x.a||"Address not added")}</div><p class="desc">${esc(x.d)}</p><div class="next"><b>${x.custom?"Type":"Next stop"}:</b> ${esc(x.custom?"Unexpected stop":x.s)}</div><div class="card-actions"><a class="route mobile-link-always" href="${esc(map)}">↗ Route Portal</a>${remove}</div></div><div class="cw"><label for="c${x.n}">Visited</label><input id="c${x.n}" type="checkbox" ${visited?"checked":""}></div>`;
 const cb=e.querySelector("input[type=checkbox]");
 cb.onchange=()=>{if(cb.checked){openOutcomeModal(x,true,cb)}else{delete S[x.n];delete T[x.n];save();render()}};
 const edit=e.querySelector("[data-edit-status]");if(edit)edit.onclick=()=>openOutcomeModal(x,false);
 const rem=e.querySelector("[data-remove]");if(rem)rem.onclick=()=>removeCustom(x);
 l.append(e)
}
function render(){
 C.innerHTML="";
 B.forEach((b,i)=>{
  const a=D.filter(x=>x.b===b),sec=document.createElement("section"),n=a.filter(x=>S[x.n]).length;
  sec.innerHTML=`<div class="bh"><div><div class="bk">District ${i+1} · ${a.length} stops</div><h2>${esc(b.replace(/^Block \d+:\s*/,""))}</h2></div><div class="ba"><span class="bc" id="bc${i}">${n} / ${a.length} visited</span><a class="route" href="${esc(portalUrl({focusDistrict:i}))}">↗ Route Portal</a></div></div><div class="list"></div>`;
  const l=sec.querySelector(".list");a.forEach(x=>renderCard(x,l));C.append(sec)
 });
 if(X.length){
  const sec=document.createElement("section"),n=X.filter(x=>S[x.n]).length;
  sec.className="custom-section";sec.innerHTML=`<div class="bh"><div><div class="bk">Added on the fly · ${X.length} stop${X.length===1?"":"s"}</div><h2>Unexpected Stops</h2></div><div class="ba"><span class="bc">${n} / ${X.length} visited</span></div></div><div class="list"></div>`;
  const l=sec.querySelector(".list");X.forEach(x=>renderCard(x,l));C.append(sec)
 }
 prog();filter()
}
function prog(){
 const A=allStops(),n=A.filter(x=>S[x.n]).length,p=A.length?Math.round(n/A.length*100):0;
 document.querySelector("#done").textContent=n;document.querySelector("#total").textContent=" / "+A.length;document.querySelector("#pct").textContent=p+"% complete";document.querySelector("#fill").style.width=p+"%";
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
document.querySelector("#addUnexpected").onclick=openAddModal;
document.querySelector("#reset").onclick=()=>{if(confirm("Clear visited checkmarks and outcomes? Unexpected stops will stay on the list.")){S={};T={};localStorage.removeItem(K);localStorage.removeItem(SK);render()}};
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(document.querySelector("#outcomeModal")?.classList.contains("show"))cancelOutcomeModal();if(document.querySelector("#addModal")?.classList.contains("show"))closeAddModal()}});

const routePortal=document.querySelector("#routePortal");if(routePortal)routePortal.href=portalUrl({});
buildOutcomeFilter();buildOutcomeModal();buildAddModal();render();