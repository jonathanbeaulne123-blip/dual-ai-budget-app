const OUTCOME_KEY="toronto42-outcomes-v1";
const VISIT_KEY="toronto42-culinary-passport-v1";
const CUSTOM_KEY="toronto42-custom-stops-v1";
const STEP_KEY="toronto42-nextsteps-v1";
const CONTACT_KEY="toronto42-followup-contacts-v1";
const ACTIONABLE=["chat","no-manager","maybe","apply-online"];
const STATUS_LABELS={
  "chat":"Sat down and chatted",
  "no-manager":"Didn't talk to manager",
  "maybe":"Maybe",
  "apply-online":"Need to apply online"
};
const T=JSON.parse(localStorage.getItem(OUTCOME_KEY)||"{}");
const X=JSON.parse(localStorage.getItem(CUSTOM_KEY)||"[]");
let STEP_STATE=JSON.parse(localStorage.getItem(STEP_KEY)||"{}");
let CONTACTS=JSON.parse(localStorage.getItem(CONTACT_KEY)||"{}");
let activeStatus="all";

const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const allStops=()=>D.concat(X);
const intelFor=id=>(window.RESTAURANT_INTEL||{})[String(id)]||null;

function preview(file,params={}){
  const qs=new URLSearchParams(params).toString();
  if(location.hostname==="html-preview.github.io"){
    const base="https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2F"+encodeURIComponent(file);
    return base+(qs?"&"+qs:"");
  }
  return file+(qs?"?"+qs:"");
}
document.querySelector("#backChecklist").href=preview("index.html");
document.querySelector("#emptyChecklist").href=preview("index.html");
document.querySelector("#openPortal").href=preview("map.html");

function contactDefaults(stop){
  const intel=intelFor(stop.n);
  const saved=CONTACTS[String(stop.n)]||{};
  let email=saved.email||intel?.nextSteps?.contactEmail||intel?.application?.general||"";
  if(email && !email.includes("@")) email="";
  let person=saved.person||intel?.nextSteps?.contactName||intel?.manager?.name||"";
  let applyUrl=saved.applyUrl||intel?.nextSteps?.applyUrl||intel?.application?.url||"";
  let applyLabel=intel?.application?.urlLabel||"Application website";
  let applyCaveat=intel?.application?.urlCaveat||"";
  return {email,person,applyUrl,applyLabel,applyCaveat};
}

function nextBusinessDay(date,days){
  const d=new Date(date);
  let left=days;
  while(left>0){
    d.setDate(d.getDate()+1);
    const day=d.getDay();
    if(day!==0&&day!==6) left--;
  }
  return d;
}
function pad(n){return String(n).padStart(2,"0")}
function calendarUrl(stop,status){
  const offsets={"chat":1,"no-manager":1,"maybe":2,"apply-online":3};
  const d=nextBusinessDay(new Date(),offsets[status]||1);
  d.setHours(status==="no-manager"?14:10,0,0,0);
  const end=new Date(d.getTime()+30*60000);
  const fmt=x=>x.getFullYear()+pad(x.getMonth()+1)+pad(x.getDate())+"T"+pad(x.getHours())+pad(x.getMinutes())+"00";
  const text=status==="no-manager"?"Revisit / contact "+stop.r:"Follow up with "+stop.r;
  const details="Toronto Culinary Passport follow-up. Outcome: "+STATUS_LABELS[status]+". Review next steps, contact notes and restaurant prep before following up.";
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(text)+"&dates="+fmt(d)+"/"+fmt(end)+"&details="+encodeURIComponent(details)+"&ctz=America%2FToronto";
}
function gmailDraftUrl(stop,status,contact){
  if(!contact.email)return "";
  const intel=intelFor(stop.n);
  const who=contact.person?(/\bTeam\b/i.test(contact.person)?contact.person:contact.person.split(" ")[0]):(stop.r+" Team");
  const greeting="Hi "+who+",";
  const subjects={
    chat:"Thank you — "+stop.r,
    "no-manager":"Front-of-house introduction — "+stop.r,
    maybe:"Following up — "+stop.r,
    "apply-online":"Application follow-up — "+stop.r
  };
  const angle=intel?.hiringAngle||"My background includes serving, bar leadership, and private-event experience.";
  const bodies={
    chat:[greeting,"","Thank you for taking the time to speak with me when I stopped by. I enjoyed learning a little more about "+stop.r+" and wanted to follow up while our conversation was still fresh.","",angle,"","I'd be very interested in continuing the conversation if there may be a fit with your front-of-house team.","","Thank you again,","Jonathan"],
    "no-manager":[greeting,"","I stopped by "+stop.r+" today hoping to introduce myself regarding front-of-house opportunities, but I wasn't able to catch the manager at a good time.","",angle,"","I wanted to send a quick introduction and would be happy to come back at a better time or forward my resume directly.","","Thank you,","Jonathan"],
    maybe:[greeting,"","Thank you again for speaking with me about a possible opportunity at "+stop.r+". I wanted to follow up and reiterate my interest.","",angle,"","Please let me know if there is any other information I can provide or a good time to reconnect.","","Thank you,","Jonathan"],
    "apply-online":[greeting,"","I stopped by "+stop.r+" and was directed to apply online for a front-of-house opportunity. I wanted to follow up directly as well and express my interest in joining the team.","",angle,"","I'm completing the online application and would be happy to provide anything else that would be useful.","","Thank you,","Jonathan"]
  };
  return "https://mail.google.com/mail/?view=cm&fs=1&to="+encodeURIComponent(contact.email)+"&su="+encodeURIComponent(subjects[status])+"&body="+encodeURIComponent(bodies[status].join("\n"));
}
function revisitScript(stop,status,contact){
  const name=contact.person?contact.person.split(" ")[0]:"the manager";
  if(status==="chat") return "Hi, I stopped by recently and had a chance to speak with "+name+". I wanted to follow up on our conversation about front-of-house opportunities and see whether there might be a good next step from here.";
  if(status==="no-manager") return "Hi, I stopped by recently hoping to introduce myself about front-of-house work but missed the manager. Is "+name+" or whoever handles FOH hiring available for a quick introduction today?";
  if(status==="maybe") return "Hi, I spoke with the team recently about a possible opportunity and was told there may be a fit. I wanted to follow up in person and see whether there has been any movement or whether there is anything else I can provide.";
  return "Hi, I stopped by and was directed to apply online. I've followed that instruction and wanted to briefly introduce myself / follow up so the team can put a face to the application.";
}
function tasksFor(stop,status,contact){
  const base=[];
  if(status==="apply-online"){
    base.push({id:"open-application",title:"Open the application website",desc:contact.applyUrl?"Use the verified/researched application path below.":"No verified application URL is stored yet. Add the exact link the restaurant gave you under Contact & application details."});
    base.push({id:"submit-application",title:"Submit the online application",desc:"Use the tailored cover letter and make sure your resume reflects the role you're applying for."});
    base.push({id:"followup-email",title:"Send a short application follow-up",desc:"Open the prewritten Gmail draft after submitting so the team can connect your application with your in-person visit."});
    base.push({id:"reminder",title:"Schedule a follow-up",desc:"Set a reminder for three business days after the application."});
    base.push({id:"prep",title:"Keep interview prep ready",desc:"Review Study Notes before any call-back or interview."});
  } else if(status==="no-manager"){
    base.push({id:"intro-email",title:"Send an introduction email",desc:"Let the restaurant know you stopped in and ask for the best time/person to reconnect with."});
    base.push({id:"revisit",title:"Plan a manager revisit",desc:"Use the revisit script and return outside the busiest service period."});
    base.push({id:"reminder",title:"Schedule the revisit / follow-up",desc:"Put the next contact attempt on your calendar so it doesn't disappear into the route."});
    base.push({id:"prep",title:"Refresh the restaurant Study Notes",desc:"Know the manager, chef, food and beverage hooks before the second attempt."});
  } else if(status==="chat"){
    base.push({id:"thankyou",title:"Send a thank-you email",desc:"Follow up while the conversation is still fresh and connect your name to the in-person meeting."});
    base.push({id:"reminder",title:"Schedule the next follow-up",desc:"Set a next-business-day reminder unless the manager gave you a specific timeline."});
    base.push({id:"notes",title:"Record who you spoke with",desc:"Save the person's name/email below so future follow-ups are personal rather than generic."});
    base.push({id:"prep",title:"Prepare for the next conversation",desc:"Review Study Notes and the tailored cover letter before a callback, second visit, or interview."});
  } else if(status==="maybe"){
    base.push({id:"followup-email",title:"Send a concise follow-up email",desc:"Reiterate interest without overdoing it; reference the conversation and the strongest fit."});
    base.push({id:"reminder",title:"Schedule a two-business-day check-in",desc:"Give them room, then make sure you actually reconnect."});
    base.push({id:"revisit",title:"Prepare the follow-up / revisit script",desc:"Have a short, confident line ready if you go back in person."});
    base.push({id:"prep",title:"Review likely interview questions",desc:"Treat a Maybe as a live lead and be ready if it turns into an interview quickly."});
  }
  return base;
}
function stepKey(stop,status,id){return String(stop.n)+":"+status+":"+id}
function saveStep(stop,status,id,checked){
  const k=stepKey(stop,status,id);
  if(checked)STEP_STATE[k]=1;else delete STEP_STATE[k];
  localStorage.setItem(STEP_KEY,JSON.stringify(STEP_STATE));
  updateProgress();
}
function saveContact(stop,card){
  const person=card.querySelector("[data-person]").value.trim();
  const email=card.querySelector("[data-email]").value.trim();
  const applyUrl=card.querySelector("[data-apply-url]").value.trim();
  CONTACTS[String(stop.n)]={person,email,applyUrl};
  localStorage.setItem(CONTACT_KEY,JSON.stringify(CONTACTS));
  render();
  setTimeout(()=>document.querySelector('[data-lead="'+stop.n+'"]')?.scrollIntoView({block:"center"}),20);
}

function render(){
  const list=document.querySelector("#leadList");
  const empty=document.querySelector("#emptyState");
  const focus=new URLSearchParams(location.search).get("stop");
  const leads=allStops().filter(s=>ACTIONABLE.includes(T[s.n])&&(activeStatus==="all"||T[s.n]===activeStatus));
  list.innerHTML="";
  empty.hidden=leads.length>0;
  leads.forEach(stop=>{
    const status=T[stop.n],contact=contactDefaults(stop),tasks=tasksFor(stop,status,contact),intel=intelFor(stop.n);
    const card=document.createElement("article");
    card.className="lead-card"+(String(focus)===String(stop.n)?" highlight":"");
    card.dataset.lead=stop.n;
    const gmail=gmailDraftUrl(stop,status,contact);
    const cal=calendarUrl(stop,status);
    const prep=stop.custom?"":preview("restaurant.html",{stop:stop.n,view:"flashcards"});
    const cover=stop.custom?"":preview("restaurant.html",{stop:stop.n,view:"coverletter"});
    const script=revisitScript(stop,status,contact);
    let taskHtml=tasks.map(t=>{
      const k=stepKey(stop,status,t.id),checked=!!STEP_STATE[k];
      return '<label class="task '+(checked?"done":"")+'"><input type="checkbox" data-step="'+esc(t.id)+'" '+(checked?"checked":"")+'><span><div class="task-title">'+esc(t.title)+'</div><div class="task-desc">'+esc(t.desc)+'</div></span></label>';
    }).join("");
    let applyButton="";
    if(status==="apply-online"){
      applyButton=contact.applyUrl?'<a class="action apply" href="'+esc(contact.applyUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(contact.applyLabel||"Open Application")+' ↗</a>':'<span class="action apply disabled">Application link needed</span>';
    }
    card.innerHTML='<div class="lead-head"><div><div class="lead-num">Stop '+esc(stop.n)+'</div><div class="lead-name">'+esc(stop.r)+'</div><div class="lead-address">'+esc(stop.a||"")+'</div></div><span class="status-pill status-'+esc(status)+'">'+esc(STATUS_LABELS[status])+'</span></div>'+
      '<div class="lead-body"><div class="tasks">'+taskHtml+'</div><div class="actions">'+
        (gmail?'<a class="action primary gmail" href="'+esc(gmail)+'" target="_blank" rel="noopener noreferrer">Draft Gmail ↗</a>':'<span class="action gmail disabled">Add email to draft Gmail</span>')+
        applyButton+
        '<a class="action calendar" href="'+esc(cal)+'" target="_blank" rel="noopener noreferrer">Schedule Follow-Up ↗</a>'+
        '<button class="action script" data-script-toggle>Revisit / Follow-Up Script</button>'+
        (prep?'<a class="action" href="'+esc(prep)+'">Open Study Notes</a>':"")+
        (cover?'<a class="action" href="'+esc(cover)+'">Open Cover Letter</a>':"")+
        (contact.applyCaveat?'<div class="action-note">'+esc(contact.applyCaveat)+'</div>':"")+
      '</div></div>'+
      '<div class="script-box" data-script-box>'+esc(script)+'<div class="script-tools"><button class="tiny" data-copy-script>Copy script</button></div></div>'+
      '<details class="lead-details"><summary>Contact & application details</summary><div class="contact-grid">'+
        '<label class="contact-field"><span>Contact / manager</span><input data-person value="'+esc(contact.person)+'" placeholder="Manager or contact name"></label>'+
        '<label class="contact-field"><span>Email</span><input data-email type="email" value="'+esc(contact.email)+'" placeholder="Public / provided work email"></label>'+
        '<label class="contact-field full"><span>Application URL</span><input data-apply-url value="'+esc(contact.applyUrl)+'" placeholder="Paste exact application link if they give you one"></label>'+
      '</div><button class="save-contact">Save details</button></details>';
    card.querySelectorAll("[data-step]").forEach(cb=>cb.onchange=()=>{saveStep(stop,status,cb.dataset.step,cb.checked);cb.closest(".task").classList.toggle("done",cb.checked)});
    card.querySelector("[data-script-toggle]").onclick=()=>card.querySelector("[data-script-box]").classList.toggle("show");
    card.querySelector("[data-copy-script]").onclick=async function(){try{await navigator.clipboard.writeText(script);this.textContent="Copied ✓"}catch(e){this.textContent="Select + copy"}};
    card.querySelector(".save-contact").onclick=()=>saveContact(stop,card);
    list.append(card);
  });
  updateProgress();
}
function updateProgress(){
  const all=allStops().filter(s=>ACTIONABLE.includes(T[s.n]));
  let total=0,done=0;
  all.forEach(stop=>{
    const status=T[stop.n],contact=contactDefaults(stop);
    tasksFor(stop,status,contact).forEach(t=>{total++;if(STEP_STATE[stepKey(stop,status,t.id)])done++});
  });
  document.querySelector("#leadCount").textContent=all.length;
  document.querySelector("#taskDone").textContent=done+" / "+total+" actions";
  const pct=total?Math.round(done/total*100):0;
  document.querySelector("#taskPct").textContent=pct+"%";
  document.querySelector("#taskFill").style.width=pct+"%";
}
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeStatus=b.dataset.status;render()});
render();
window.addEventListener("storage",()=>location.reload());
