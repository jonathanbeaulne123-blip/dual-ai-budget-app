const params=new URLSearchParams(location.search);
const stopId=params.get("stop")||"1";
const initialView=params.get("view")||"summary";
const stop=D.concat((window.ADDITIONAL_PROSPECTS||[])).find(function(x){return String(x.n)===String(stopId)});
const data=(window.RESTAURANT_INTEL||{})[String(stopId)];
const flowRecord=(window.FLOW_DATA?.restaurants||[]).find(x=>String(x.id)===String(stopId));
const esc=function(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]})};

function preview(file,ps){
  ps=ps||{};
  const qs=new URLSearchParams(ps).toString();
  if(location.hostname==="html-preview.github.io"){
    const base="https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2F"+encodeURIComponent(file);
    return base+(qs?"&"+qs:"");
  }
  return file+(qs?"?"+qs:"");
}

document.querySelector("#backLink").href=preview("index.html");
const nextStepsTab=document.querySelector("#nextStepsTab");if(nextStepsTab)nextStepsTab.href=preview("nextsteps.html",{stop:stopId});
const hireabilityTab=document.querySelector("#hireabilityTab");if(hireabilityTab)hireabilityTab.href=preview("hireability.html",{stop:stopId});
document.querySelector("#restaurantName").textContent=stop?stop.r:(data?data.name:"Restaurant Prep");
document.querySelector("#restaurantMeta").textContent=stop?("#"+stop.n+" · "+stop.a+" · "+stop.p):"Restaurant intelligence";
if(flowRecord)document.querySelector("#restaurantMeta").textContent='#'+stopId+' · '+flowRecord.address+' · '+(flowRecord.price.estimate||'Price not verified');
const badge=document.querySelector("#statusBadge");
badge.textContent=data?data.status:"NOT RESEARCHED";
badge.classList.toggle("verified",!!data&&data.status==="VERIFIED");
const contentEl=document.querySelector("#intelContent");
const pending=document.querySelector("#pending");
const views=["summary","flashcards","coverletter","walkin","interview","sources"];

function panel(html){contentEl.innerHTML='<section class="panel">'+(data?.auditNote?'<div class="flow-banner"><strong>September 19 hiring correction</strong><p>'+esc(data.auditNote)+'</p><a href="'+esc(preview('day.html',{stop:stopId}))+'">Prepare this application</a></div>':'')+html+"</section>"}

function setView(view){
  if(views.indexOf(view)<0)view="summary";
  document.querySelectorAll("#intelNav button").forEach(function(b){b.classList.toggle("active",b.dataset.view===view)});
  if(!data){pending.hidden=false;contentEl.innerHTML="";return}
  pending.hidden=true;
  if(data.brief){renderQuickBrief(view);return;}
  if(view==="summary")renderSummary();
  if(view==="flashcards")renderFlashcards();
  if(view==="coverletter")renderLetter();
  if(view==="walkin")renderWalkin();
  if(view==="sources")renderSources();
  if(view==="interview")renderInterview();
}

function renderQuickBrief(view){
 const r=data.discovery,link=(label,url)=>'<a class="note-source" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(label)+' ↗</a>';
 const jobs=(r.status!=='closed'&&r.url?link(data.application.urlLabel,r.url):'')+r.extra.map(s=>link(s[0],s[1])).join('');
 const intro='Hi, I’m Jonathan. My background includes bar leadership, upscale Italian service and private-event coordination. '+(r.status==='active'?'I’m interested in the listed '+r.roles+' opportunity.':'I’d like to ask about suitable future front-of-house opportunities.')+' I would welcome a conversation about how my experience could support your team. Thank you, Jonathan Beaulne';
 let body='<div class="eyebrow">Quick brief · checked September 19</div><h2>'+esc(r.name)+'</h2>'+PassportFlow.badges(flowRecord);
 if(view==='sources'){panel(body+'<h3>Source links</h3>'+data.sources.map(s=>link(s[0],s[1])).join('')+'<p>Brief research only. Job status is a dated snapshot; recheck before applying.</p>');return;}
 if(view==='coverletter'){panel(body+'<h3>Short introduction draft</h3><p>Edit the role and examples to match your actual experience before using.</p><div class="letter">'+esc(intro)+'</div>'+jobs+'<p>'+esc(r.job)+'</p>');return;}
 if(view==='walkin'||view==='interview'){panel(body+'<h3>A simple conversation</h3><p>'+esc(data.walkIn.opening)+'</p><p>'+esc(r.why)+'</p><p>Bring one real example of bar leadership, service or event coordination. Ask about training, shift allocation, tip-out and actual clock-out time.</p><p>'+esc(r.requirements)+'</p><p>No manager appointment is confirmed. Keep any introduction brief and avoid busy service.</p>'+jobs);return;}
 panel(body+'<p>'+esc(r.why)+'</p><div class="must"><strong>'+esc(r.statusLabel)+'</strong><p>'+esc(r.job)+'</p>'+(r.roles?'<p><strong>Roles:</strong> '+esc(r.roles)+'</p>':'')+(r.pay?'<p><strong>Advertised pay:</strong> '+esc(r.pay)+'</p>':'')+'<p>'+esc(r.requirements)+'</p>'+jobs+'</div><h3>Getting there</h3><p>'+esc(r.transit)+'</p>'+link('Transit from Clarkson','https://www.google.com/maps/dir/?api=1&origin=Clarkson+GO+Station&destination='+encodeURIComponent(r.name+' '+r.address)+'&travelmode=transit')+'<p><strong>Saturday:</strong> '+esc(r.hours)+'</p><p>Hours are not a manager-access promise. Closing duties can run later than guest service.</p><h3>One useful question</h3><p>What would someone with bar-lead and private-event experience need to demonstrate to progress here?</p>'+link('Restaurant / employer',r.site));
}

function renderSummary(){
  let must="";
  data.mustKnow.forEach(function(x,i){must+='<div class="must"><strong>★ MUST KNOW '+(i+1)+'</strong><br>'+esc(x)+"</div>"});
  let html='<div class="eyebrow">60-second briefing</div><h2>'+esc(data.name)+'</h2><p>'+esc(data.summary)+"</p>";
  if(flowRecord)html+='<div class="flow-banner">'+PassportFlow.badges(flowRecord)+'<p>'+esc(flowRecord.reason)+'</p><p><strong>Original Saturday access note:</strong> '+esc(flowRecord.access.best)+'</p><p><strong>Menu / fit evidence:</strong> '+esc(flowRecord.price.status)+' · '+esc(flowRecord.price.basis)+'</p><a href="'+esc(preview('day.html'))+'">Open the current application and visit plan</a></div>';
  if(data.researchGaps?.length)html+='<details class="flow-research-gap"><summary>Known research limits</summary><ul>'+data.researchGaps.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>';
  if(data.timing)html+='<div class="must"><strong>Timing:</strong> '+esc(data.timing)+"</div>";
  html+='<div class="must-list">'+must+"</div>";
  html+='</section><div class="grid" style="margin-top:12px">';
  html+='<section class="card"><div class="mini">Management</div><h3>'+esc(data.manager.name)+'</h3><p><strong>'+esc(data.manager.confidence)+'</strong> · '+esc(data.manager.role)+'</p><p>'+esc(data.manager.history)+'</p><p><strong>Contact:</strong> '+esc(data.manager.contact)+'</p><p><strong>Hook:</strong> '+esc(data.manager.hook)+'</p><p>'+esc(data.manager.caveat)+"</p></section>";
  html+='<section class="card"><div class="mini">Chef</div><h3>'+esc(data.chef.name)+'</h3><p><strong>'+esc(data.chef.confidence)+'</strong> · '+esc(data.chef.role)+'</p><p>'+esc(data.chef.history)+'</p><p><strong>Hook:</strong> '+esc(data.chef.hook)+'</p><p>'+esc(data.chef.caveat)+"</p></section>";
  html+='</div><section class="panel" style="margin-top:12px"><div class="eyebrow">Hiring angle</div><h2>How Jonathan fits</h2><p>'+esc(data.hiringAngle)+"</p></section>";
  contentEl.innerHTML='<section class="panel">'+html;
}

function renderFlashcards(){
  const notes=data.studyNotes||{};
  const cats=["All"].concat(Object.keys(notes));
  let chips="";
  cats.forEach(function(cat,i){
    chips+='<button class="chip '+(i===0?"active":"")+'" data-cat="'+esc(cat)+'">'+esc(cat)+"</button>";
  });

  let items="";
  let index=0;
  Object.keys(notes).forEach(function(cat){
    notes[cat].forEach(function(item){
      const detailId="note-detail-"+index++;
      items+='<li class="intel-bullet '+(item.must?"must-note":"")+'" data-cat="'+esc(cat)+'">';
      items+='<div class="intel-bullet-main">';
      items+='<div class="intel-bullet-copy">';
      items+='<div class="intel-bullet-category">'+esc(cat)+'</div>';
      items+='<div class="intel-bullet-title">'+(item.must?'<span class="star">★</span>':"")+esc(item.title)+'</div>';
      items+='<div class="intel-bullet-summary">'+esc(item.summary||"")+'</div>';
      items+='</div>';
      const hasDetail=!!(item.detail||item.text)&&!!item.sources?.length;
      if(hasDetail)items+='<button class="intel-info" type="button" aria-expanded="false" aria-controls="'+detailId+'" aria-label="More information about '+esc(item.title)+'">i</button>';
      items+='</div>';
      if(hasDetail)items+='<div class="intel-detail" id="'+detailId+'"><div class="detail-label">Useful detail</div>'+formatDetail(item.detail||item.text||"")+(item.question?'<p class="note-question"><strong>Research question:</strong> '+esc(item.question)+'</p>':'')+(item.freshness?'<p class="flow-note"><strong>Freshness:</strong> '+esc(item.freshness)+'</p>':'')+formatNoteSources(item.sources||[])+'</div>';
      items+='</li>';
    });
  });

  panel('<div class="eyebrow">Restaurant research</div><h2>Study Notes</h2><p>Each bullet gives you the memory-friendly summary first. Tap the small <strong>i</strong> for the full briefing, including the deeper context that may help in a conversation, interview, or on the floor.</p><div class="flash-toolbar">'+chips+'</div><ul class="intel-bullet-list">'+items+"</ul>");

  contentEl.querySelectorAll(".intel-info").forEach(function(btn){
    btn.onclick=function(){
      const li=btn.closest(".intel-bullet");
      const open=li.classList.toggle("open");
      btn.setAttribute("aria-expanded",open?"true":"false");
    };
  });

  contentEl.querySelectorAll(".chip").forEach(function(ch){
    ch.onclick=function(){
      contentEl.querySelectorAll(".chip").forEach(function(x){x.classList.remove("active")});
      ch.classList.add("active");
      const cat=ch.dataset.cat;
      contentEl.querySelectorAll(".intel-bullet").forEach(function(x){
        x.style.display=(cat==="All"||x.dataset.cat===cat)?"":"none";
      });
    };
  });
}

function formatDetail(text){
  return String(text||"").split(/\n\n+/).filter(Boolean).map(function(p){
    return '<p>'+esc(p)+'</p>';
  }).join("");
}

function formatNoteSources(sources){
  if(!sources||!sources.length)return "";
  let links="";
  sources.forEach(function(s){
    links+='<a class="note-source" target="_blank" rel="noopener noreferrer" href="'+esc(s[1])+'">'+esc(s[0])+' ↗</a>';
  });
  return '<div class="note-research"><div class="detail-label">Research for this note</div><div class="note-source-list">'+links+'</div></div>';
}

function renderLetter(){
  let app="";
  if(data.application){
    app='<div class="card" style="margin-top:12px"><div class="mini">Application mode</div><p><strong>General:</strong> '+esc(data.application.general)+'</p><p><strong>Events:</strong> '+esc(data.application.events)+'</p><p><strong>Phone:</strong> '+esc(data.application.phone)+'</p><p>'+(data.application.url?'<a href="'+esc(data.application.url)+'" target="_blank" rel="noopener noreferrer">'+esc(data.application.urlLabel||'Application route')+'</a>':'')+'</p><p>'+esc(data.application.urlCaveat)+'</p><p><strong>Short note:</strong> '+esc(data.application.note)+"</p></div>";
  }
  panel('<div class="eyebrow">Tailored application</div><h2>Cover Letter</h2><button id="copyLetter" class="copy-btn">Copy cover letter</button><div class="letter">'+esc(data.coverLetter)+"</div>"+app);
  document.querySelector("#copyLetter").onclick=async function(){
    try{await navigator.clipboard.writeText(data.coverLetter);this.textContent="Copied ✓"}catch(e){this.textContent="Select + copy below"}
  };
}

function renderWalkin(){
  let mentions="";
  data.walkIn.mentions.forEach(function(x){mentions+="<li>"+esc(x)+"</li>"});
  panel('<div class="eyebrow">Walk-in strategy</div><h2>What to do at the door</h2><div class="card"><div class="mini">Ask for</div><h3>'+esc(data.walkIn.askFor)+'</h3></div><div class="card" style="margin-top:10px"><div class="mini">Opening line</div><p>'+esc(data.walkIn.opening)+'</p></div><div class="card" style="margin-top:10px"><div class="mini">Three intelligent mentions</div><ol class="mentions">'+mentions+'</ol></div><div class="grid" style="margin-top:10px"><div class="card"><div class="mini">Do not say</div><p>'+esc(data.walkIn.avoid)+'</p></div><div class="card"><div class="mini">If manager unavailable</div><p>'+esc(data.walkIn.fallback)+"</p></div></div>");
}

function renderInterview(){
 const prep=data.interview||{};
 panel('<div class="eyebrow">Interview preparation</div><h2>Practise for this room</h2><p>Use a real example from your experience. These are answer frameworks, not claims about events that happened.</p>'+(prep.questions||[]).map(q=>'<details class="flow-section"><summary>'+esc(q.question)+'</summary><p><strong>What they may be testing:</strong> '+esc(q.testing)+'</p><p>'+esc(q.framework)+'</p></details>').join('')+'<h3>Review before the conversation</h3><p>'+esc(prep.review||'Review the Food, Bar & Wine, Hospitality and Interview Study Notes.')+'</p><h3>Questions to ask them</h3><ul>'+(prep.askThem||[]).map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul>');
}

function renderSources(){
  let sources="";
  data.sources.forEach(function(s){sources+='<a class="source-link" target="_blank" rel="noopener noreferrer" href="'+esc(s[1])+'">'+esc(s[0])+" ↗</a>"});
  panel('<div class="eyebrow">Verification</div><h2>Sources</h2><p>Re-verify current manager, current chef title, hours, menu and hiring status on the day of use.</p><div class="source-list">'+sources+"</div>");
}

document.querySelectorAll("#intelNav button").forEach(function(b){b.onclick=function(){setView(b.dataset.view)}});
setView(initialView);
