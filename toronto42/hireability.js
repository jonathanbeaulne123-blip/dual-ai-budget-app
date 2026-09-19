const PASS_KEY="toronto42-hireability-passport-v1";
const STORY_KEY="toronto42-hireability-stories-v1";
const DRILL_KEY="toronto42-hireability-drill-v1";
const REF_KEY="toronto42-hireability-referrals-v1";
const CONV_KEY="toronto42-hireability-conversions-v1";
const VISIT_KEY="toronto42-culinary-passport-v1";
const OUTCOME_KEY="toronto42-outcomes-v1";
const CUSTOM_KEY="toronto42-custom-stops-v1";

let passport=JSON.parse(localStorage.getItem(PASS_KEY)||"{}");
let stories=JSON.parse(localStorage.getItem(STORY_KEY)||"{}");
let drills=JSON.parse(localStorage.getItem(DRILL_KEY)||"{}");
let referrals=JSON.parse(localStorage.getItem(REF_KEY)||"[]");
let conversions=JSON.parse(localStorage.getItem(CONV_KEY)||"{}");
const visits=JSON.parse(localStorage.getItem(VISIT_KEY)||"{}");
const outcomes=JSON.parse(localStorage.getItem(OUTCOME_KEY)||"{}");
const custom=JSON.parse(localStorage.getItem(CUSTOM_KEY)||"[]");

const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const researchedStops=()=>D.concat(window.ADDITIONAL_PROSPECTS||[]);
const allStops=()=>researchedStops().concat(custom);
function preview(file,params={}){
  const qs=new URLSearchParams(params).toString();
  if(location.hostname==="html-preview.github.io"){
    const base="https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2F"+encodeURIComponent(file);
    return base+(qs?"&"+qs:"");
  }
  return file+(qs?"?"+qs:"");
}
document.querySelector("#backChecklist").href=preview("index.html");
document.querySelector("#routePortal").href=preview("map.html");
document.querySelector("#nextSteps").href=preview("nextsteps.html");

document.querySelectorAll(".mode-tab").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".mode-tab").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll(".mode-panel").forEach(x=>x.classList.toggle("active",x.dataset.panelView===btn.dataset.panel));
});

function savePassport(){
  localStorage.setItem(PASS_KEY,JSON.stringify(passport));
  updateReadiness();
}
document.querySelectorAll("[data-passport]").forEach(el=>{
  el.value=passport[el.dataset.passport]||"";
  el.oninput=()=>{passport[el.dataset.passport]=el.value;savePassport()};
});
document.querySelectorAll("[data-passport-check]").forEach(el=>{
  el.checked=!!passport[el.dataset.passportCheck];
  el.onchange=()=>{passport[el.dataset.passportCheck]=el.checked;savePassport()};
});
document.querySelectorAll("[data-role]").forEach(el=>{
  passport.roles=passport.roles||{};
  el.checked=!!passport.roles[el.dataset.role];
  el.onchange=()=>{passport.roles[el.dataset.role]=el.checked;savePassport()};
});

const STORY_DEFS=[
  ["guest-recovery","Difficult guest recovery","A guest was unhappy or something went wrong. Show how you listened, fixed what you could, communicated with the team, and protected the relationship."],
  ["rush","High-pressure rush / multitasking","A genuinely busy service where you prioritized, communicated, stayed accurate, and kept guests feeling looked after."],
  ["bar-leadership","Bar leadership","A moment you led the bar: standards, prep, coaching, service recovery, organization, or keeping the team moving."],
  ["private-event","Private-event problem solving","A private event changed unexpectedly. Show coordination, communication, adaptation, and execution."],
  ["product","Product / wine / upsell","A real example where product knowledge helped a guest choose well, improved the experience, or increased the check naturally."],
  ["mistake","Mistake you owned and fixed","A real mistake. Explain what you did immediately, what you learned, and what changed afterward."]
];
function renderStories(){
  const bank=document.querySelector("#storyBank");
  bank.innerHTML=STORY_DEFS.map(([id,title,prompt])=>{
    const val=stories[id]||"";
    return '<article class="story-card"><div class="story-status">'+(val.trim().length>80?"Ready":"Needs work")+'</div><h3>'+esc(title)+'</h3><div class="story-prompt">'+esc(prompt)+'</div><textarea data-story="'+esc(id)+'" placeholder="Situation → Action → Result. Use concrete real details.">'+esc(val)+'</textarea></article>';
  }).join("");
  bank.querySelectorAll("[data-story]").forEach(el=>el.oninput=()=>{stories[el.dataset.story]=el.value;localStorage.setItem(STORY_KEY,JSON.stringify(stories));updateReadiness()});
}
renderStories();

const drillSelect=document.querySelector("#drillRestaurant");
const params=new URLSearchParams(location.search);
const initialStop=params.get("stop");
drillSelect.innerHTML='<option value="">Choose a restaurant</option>'+researchedStops().map(x=>'<option value="'+x.n+'">'+x.n+'. '+esc(x.r)+'</option>').join("");
if(initialStop&&researchedStops().some(x=>String(x.n)===String(initialStop)))drillSelect.value=initialStop;
const DRILL_Q=[
  ["intro","Your 20-second introduction"],
  ["whyHere","Why this restaurant specifically?"],
  ["whyYou","Why are you useful to this operation?"],
  ["proof","Which proof story are you going to use if asked?"],
  ["product","What food / wine / cocktail detail can you discuss naturally?"],
  ["availability","State your availability and earliest start date cleanly."]
];
function renderDrill(){
  const id=drillSelect.value;
  const links=document.querySelector("#drillLinks"),ctx=document.querySelector("#drillContext"),qs=document.querySelector("#drillQuestions");
  if(!id){links.innerHTML="";ctx.innerHTML='<p>Choose a restaurant to build the A-GAME pre-door check.</p>';qs.innerHTML="";return}
  const stop=researchedStops().find(x=>String(x.n)===String(id)),intel=(window.RESTAURANT_INTEL||{})[String(id)],flowRecord=(window.FLOW_DATA?.restaurants||[]).find(r=>String(r.id)===String(id));
  const originalStop=D.some(x=>String(x.n)===String(id));
  const mapHref=originalStop?preview("map.html",{focusStop:id}):(flowRecord&&window.PassportFlow?window.PassportFlow.maps(flowRecord):"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([stop.r,stop.a,"Toronto Ontario"].filter(Boolean).join(" ")));
  const mapTarget=originalStop?"":' target="_blank" rel="noopener noreferrer"';
  links.innerHTML='<a class="mini-link" href="'+esc(preview("restaurant.html",{stop:id,view:"flashcards"}))+'">Study Notes</a><a class="mini-link" href="'+esc(preview("restaurant.html",{stop:id,view:"coverletter"}))+'">Cover Letter</a><a class="mini-link" href="'+esc(mapHref)+'"'+mapTarget+'>Map</a>';
  ctx.innerHTML='<div class="context-title">A-GAME context</div><h3>'+esc(stop.r)+'</h3>'+
    '<p><strong>Restaurant identity:</strong> '+esc(intel?.summary||stop.d||"Research not completed yet.")+'</p>'+
    '<p><strong>Your current researched fit:</strong> '+esc(intel?.hiringAngle||"Not researched yet — rely on your verified experience, not guesses.")+'</p>'+
    '<p><strong>Ask for:</strong> '+esc(intel?.walkIn?.askFor||"Ask who handles front-of-house hiring.")+'</p>';
  drills[id]=drills[id]||{};
  qs.innerHTML=DRILL_Q.map(([key,title])=>'<label class="drill-question"><strong>'+esc(title)+'</strong><textarea data-drill="'+esc(key)+'" placeholder="Write / rehearse your answer...">'+esc(drills[id][key]||"")+'</textarea></label>').join("");
  qs.querySelectorAll("[data-drill]").forEach(el=>el.oninput=()=>{drills[id][el.dataset.drill]=el.value;localStorage.setItem(DRILL_KEY,JSON.stringify(drills))});
}
drillSelect.onchange=renderDrill;renderDrill();

function newReferral(){
  referrals.push({id:"r-"+Date.now(),fromName:"",fromRestaurant:"",toRestaurant:"",toPerson:"",contact:"",note:"",status:"not-contacted"});
  localStorage.setItem(REF_KEY,JSON.stringify(referrals));renderReferrals();
}
document.querySelector("#addReferral").onclick=newReferral;
function renderReferrals(){
  const list=document.querySelector("#referralList");
  if(!referrals.length){list.innerHTML='<div class="context-card"><p>No warm introductions captured yet.</p></div>';return}
  list.innerHTML=referrals.map(r=>'<article class="referral-card" data-ref="'+esc(r.id)+'"><div class="referral-fields">'+
    '<label class="field"><span>Referred by</span><input data-k="fromName" value="'+esc(r.fromName)+'" placeholder="Person name"></label>'+
    '<label class="field"><span>From restaurant</span><input data-k="fromRestaurant" value="'+esc(r.fromRestaurant)+'"></label>'+
    '<label class="field"><span>Introduced / referred to restaurant</span><input data-k="toRestaurant" value="'+esc(r.toRestaurant)+'"></label>'+
    '<label class="field"><span>Person to ask for</span><input data-k="toPerson" value="'+esc(r.toPerson)+'"></label>'+
    '<label class="field wide"><span>Professional contact / application path</span><input data-k="contact" value="'+esc(r.contact)+'"></label>'+
    '<label class="field wide"><span>Exact wording / context</span><textarea data-k="note" rows="3">'+esc(r.note)+'</textarea></label>'+
    '<label class="field"><span>Status</span><select data-k="status"><option value="not-contacted" '+(r.status==="not-contacted"?"selected":"")+'>Not contacted</option><option value="contacted" '+(r.status==="contacted"?"selected":"")+'>Contacted</option><option value="replied" '+(r.status==="replied"?"selected":"")+'>Replied</option><option value="meeting" '+(r.status==="meeting"?"selected":"")+'>Meeting / interview</option></select></label>'+
    '</div><div class="referral-actions"><button class="mini-link" data-copy>Copy intro</button><button class="mini-link danger" data-delete>Delete</button></div></article>').join("");
  list.querySelectorAll("[data-ref]").forEach(card=>{
    const r=referrals.find(x=>x.id===card.dataset.ref);
    card.querySelectorAll("[data-k]").forEach(el=>el.oninput=()=>{r[el.dataset.k]=el.value;localStorage.setItem(REF_KEY,JSON.stringify(referrals))});
    card.querySelector("[data-delete]").onclick=()=>{referrals=referrals.filter(x=>x.id!==r.id);localStorage.setItem(REF_KEY,JSON.stringify(referrals));renderReferrals()};
    card.querySelector("[data-copy]").onclick=async function(){
      const intro=(r.fromName?("Hi, "+r.fromName+" at "+(r.fromRestaurant||"another restaurant")+" suggested I introduce myself"+(r.toPerson?" to "+r.toPerson:"")+ ". "):"")+(r.note||"");
      try{await navigator.clipboard.writeText(intro);this.textContent="Copied ✓"}catch(e){this.textContent="Select manually"}
    };
  });
}
renderReferrals();

const CONV_FIELDS=[
  ["manager","Manager reached"],
  ["resume","Resume accepted"],
  ["role","Active role confirmed"],
  ["application","Application requested"],
  ["interview","Interview"],
  ["referral","Referral obtained"],
  ["followup","Follow-up sent"],
  ["reply","Reply received"]
];
function renderConversion(){
  const rows=document.querySelector("#conversionRows");
  const tracked=allStops().filter(x=>visits[x.n]||outcomes[x.n]||conversions[String(x.n)]);
  rows.innerHTML=tracked.map(stop=>{
    const c=conversions[String(stop.n)]||{};
    return '<tr data-stop="'+esc(stop.n)+'"><td>'+esc(stop.r)+'</td>'+CONV_FIELDS.map(([k])=>'<td><input type="checkbox" data-c="'+k+'" '+(c[k]?"checked":"")+'></td>').join("")+'</tr>';
  }).join("");
  rows.querySelectorAll("[data-stop]").forEach(row=>{
    row.querySelectorAll("[data-c]").forEach(cb=>cb.onchange=()=>{
      const id=String(row.dataset.stop);conversions[id]=conversions[id]||{};conversions[id][cb.dataset.c]=cb.checked;
      localStorage.setItem(CONV_KEY,JSON.stringify(conversions));renderMetrics();
    });
  });
  renderMetrics();
}
function renderMetrics(){
  const all=Object.values(conversions);
  const n=k=>all.filter(x=>x&&x[k]).length;
  const manager=n("manager"),interviews=Math.max(n("interview"),Object.values(outcomes).filter(x=>x==="interview"||x==="job").length);
  const rate=(manager&&interviews<=manager)?Math.round(interviews/manager*100):null;
  document.querySelector("#conversionMetrics").innerHTML=[
    [manager,"manager conversations"],
    [n("resume"),"resumes accepted"],
    [interviews,"interviews"],
    [rate===null?"—":rate+"%","manager → interview"]
  ].map(x=>'<article class="metric-card"><span>'+x[0]+'</span><small>'+x[1]+'</small></article>').join("");
}
renderConversion();

function updateReadiness(){
  const baseChecks=[
    passport.smartServe==="current",
    !!passport.startDate,
    !!String(passport.availability||"").trim(),
    !!passport.workEligibility,
    !!passport.resumeReady,
    !!passport.resumeCopies,
    !!passport.smartServeProof,
    Object.values(passport.roles||{}).some(Boolean),
    !!passport.ref1Name&&!!passport.ref1Permission,
    !!passport.ref2Name&&!!passport.ref2Permission
  ];
  const storyChecks=STORY_DEFS.map(([id])=>String(stories[id]||"").trim().length>80);
  const all=baseChecks.concat(storyChecks),done=all.filter(Boolean).length,pct=Math.round(done/all.length*100);
  document.querySelector("#readinessScore").textContent=pct;
  document.querySelector("#readinessFill").style.width=pct+"%";
  document.querySelector("#readinessLabel").textContent=pct>=85?"Strong candidate-side readiness. Keep answers natural.":pct>=60?"Good base. Fill the remaining proof gaps before A-GAME stops.":"Build the basics before spending energy on more restaurant trivia.";
}
updateReadiness();
window.addEventListener("storage",()=>location.reload());