const params=new URLSearchParams(location.search);
const stopId=params.get("stop")||"1";
const initialView=params.get("view")||"summary";
const stop=D.find(function(x){return String(x.n)===String(stopId)});
const data=(window.RESTAURANT_INTEL||{})[String(stopId)];
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
document.querySelector("#restaurantName").textContent=stop?stop.r:(data?data.name:"Restaurant Prep");
document.querySelector("#restaurantMeta").textContent=stop?("#"+stop.n+" · "+stop.a+" · "+stop.p):"Restaurant intelligence";
const badge=document.querySelector("#statusBadge");
badge.textContent=data?data.status:"NOT RESEARCHED";
badge.classList.toggle("verified",!!data&&data.status==="VERIFIED");
const contentEl=document.querySelector("#intelContent");
const pending=document.querySelector("#pending");
const views=["summary","flashcards","coverletter","walkin","sources"];

function panel(html){contentEl.innerHTML='<section class="panel">'+html+"</section>"}

function setView(view){
  if(views.indexOf(view)<0)view="summary";
  document.querySelectorAll("#intelNav button").forEach(function(b){b.classList.toggle("active",b.dataset.view===view)});
  if(!data){pending.hidden=false;contentEl.innerHTML="";return}
  pending.hidden=true;
  if(view==="summary")renderSummary();
  if(view==="flashcards")renderFlashcards();
  if(view==="coverletter")renderLetter();
  if(view==="walkin")renderWalkin();
  if(view==="sources")renderSources();
}

function renderSummary(){
  let must="";
  data.mustKnow.forEach(function(x,i){must+='<div class="must"><strong>★ MUST KNOW '+(i+1)+'</strong><br>'+esc(x)+"</div>"});
  let html='<div class="eyebrow">60-second briefing</div><h2>'+esc(data.name)+'</h2><p>'+esc(data.summary)+"</p>";
  if(data.timing)html+='<div class="must"><strong>Timing:</strong> '+esc(data.timing)+"</div>";
  html+='<div class="must-list">'+must+"</div>";
  html+='</section><div class="grid" style="margin-top:12px">';
  html+='<section class="card"><div class="mini">Management</div><h3>'+esc(data.manager.name)+'</h3><p><strong>'+esc(data.manager.confidence)+'</strong> · '+esc(data.manager.role)+'</p><p>'+esc(data.manager.history)+'</p><p><strong>Contact:</strong> '+esc(data.manager.contact)+'</p><p><strong>Hook:</strong> '+esc(data.manager.hook)+'</p><p>'+esc(data.manager.caveat)+"</p></section>";
  html+='<section class="card"><div class="mini">Chef</div><h3>'+esc(data.chef.name)+'</h3><p><strong>'+esc(data.chef.confidence)+'</strong> · '+esc(data.chef.role)+'</p><p>'+esc(data.chef.history)+'</p><p><strong>Hook:</strong> '+esc(data.chef.hook)+'</p><p>'+esc(data.chef.caveat)+"</p></section>";
  html+='</div><section class="panel" style="margin-top:12px"><div class="eyebrow">Hiring angle</div><h2>How Jonathan fits</h2><p>'+esc(data.hiringAngle)+"</p></section>";
  contentEl.innerHTML='<section class="panel">'+html;
}

function renderFlashcards(){
  const cats=["All"].concat(Array.from(new Set(data.flashcards.map(function(x){return x.category}))));
  let chips="";
  cats.forEach(function(c,i){
    chips+='<button class="chip '+(i===0?"active":"")+'" data-cat="'+esc(c)+'">'+esc(c)+"</button>";
  });

  let bullets="";
  data.flashcards.forEach(function(f,i){
    const detailId="flash-detail-"+i;
    bullets+='<li class="flash-bullet '+(f.must?"must-bullet":"")+'" data-cat="'+esc(f.category)+'">';
    bullets+='<div class="bullet-row">';
    bullets+='<div class="bullet-copy"><span class="bullet-dot">•</span><div><div class="bullet-category">'+esc(f.category)+'</div><div class="bullet-title">'+(f.must?'<span class="star">★</span>':"")+esc(f.q)+'</div></div></div>';
    bullets+='<button class="info-toggle" type="button" aria-label="Show answer for '+esc(f.q)+'" aria-expanded="false" aria-controls="'+detailId+'">i</button>';
    bullets+='</div>';
    bullets+='<div class="bullet-detail" id="'+detailId+'"><div class="detail-label">Answer</div><div>'+esc(f.a)+'</div></div>';
    bullets+='</li>';
  });

  panel('<div class="eyebrow">Rapid study</div><h2>Flash Cards</h2><p>Choose a category, then tap the small <strong>i</strong> beside any bullet to expand the answer. ★ marks the highest-value facts.</p><div class="flash-toolbar">'+chips+'</div><ul class="flash-bullets">'+bullets+"</ul>");

  contentEl.querySelectorAll(".info-toggle").forEach(function(btn){
    btn.onclick=function(){
      const li=btn.closest(".flash-bullet");
      const open=li.classList.toggle("open");
      btn.setAttribute("aria-expanded",open?"true":"false");
      btn.setAttribute("aria-label",(open?"Hide":"Show")+" answer for "+li.querySelector(".bullet-title").textContent.replace("★","").trim());
    };
  });

  contentEl.querySelectorAll(".chip").forEach(function(ch){
    ch.onclick=function(){
      contentEl.querySelectorAll(".chip").forEach(function(x){x.classList.remove("active")});
      ch.classList.add("active");
      const cat=ch.dataset.cat;
      contentEl.querySelectorAll(".flash-bullet").forEach(function(x){
        x.style.display=(cat==="All"||x.dataset.cat===cat)?"":"none";
      });
    };
  });
}

function renderLetter(){
  let app="";
  if(data.application){
    app='<div class="card" style="margin-top:12px"><div class="mini">Application mode</div><p><strong>General:</strong> '+esc(data.application.general)+'</p><p><strong>Events:</strong> '+esc(data.application.events)+'</p><p><strong>Phone:</strong> '+esc(data.application.phone)+'</p><p><strong>Short note:</strong> '+esc(data.application.note)+"</p></div>";
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

function renderSources(){
  let sources="";
  data.sources.forEach(function(s){sources+='<a class="source-link" target="_blank" rel="noopener noreferrer" href="'+esc(s[1])+'">'+esc(s[0])+" ↗</a>"});
  panel('<div class="eyebrow">Verification</div><h2>Sources</h2><p>Re-verify current manager, current chef title, hours, menu and hiring status on the day of use.</p><div class="source-list">'+sources+"</div>");
}

document.querySelectorAll("#intelNav button").forEach(function(b){b.onclick=function(){setView(b.dataset.view)}});
setView(initialView);
