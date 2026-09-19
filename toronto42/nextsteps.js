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
const DRAFT_KEY="toronto42-followup-drafts-v1";
let DRAFTS=JSON.parse(localStorage.getItem(DRAFT_KEY)||"{}");
const FOLLOWUP_KEY="toronto42-followup-times-v1";
let FOLLOWUPS=JSON.parse(localStorage.getItem(FOLLOWUP_KEY)||"{}");

const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const allStops=()=>D.concat(window.ADDITIONAL_PROSPECTS||[],X);
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
document.querySelector("#openHireability").href=preview("hireability.html");

function contactDefaults(stop){
  const intel=intelFor(stop.n);
  const saved=CONTACTS[String(stop.n)]||{};
  let email=('email' in saved)?saved.email:intel?.nextSteps?.contactEmail||intel?.application?.general||"";
  if(email && !email.includes("@")) email="";
  let person=('person' in saved)?saved.person:intel?.nextSteps?.contactName||intel?.manager?.name||"";
  let applyUrl=('applyUrl' in saved)?saved.applyUrl:intel?.nextSteps?.applyUrl||intel?.application?.url||"";
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
function followupTime(stop,status){
  const key=stop.n+':'+status;if(FOLLOWUPS[key])return FOLLOWUPS[key];
  const cadence=intelFor(stop.n)?.nextSteps?.cadence?.[status]||'';
  let days=({'chat':0,'no-manager':1,'maybe':5,'apply-online':3})[status]||0;
  if(/five business|5 business/i.test(cadence))days=5;
  if(/seven calendar|7 calendar/i.test(cadence))days=7;
  const d=/calendar/i.test(cadence)?new Date(Date.now()+days*86400000):nextBusinessDay(new Date(),days);
  d.setHours(status==='chat'?16:11,0,0,0);
  if(d<new Date())d.setTime(Date.now()+60*60000);
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
}
function calendarUrl(stop,status,value){
  const d=new Date(value||followupTime(stop,status));if(Number.isNaN(d.getTime()))return '';
  const end=new Date(d.getTime()+30*60000);
  const fmt=x=>x.getFullYear()+pad(x.getMonth()+1)+pad(x.getDate())+'T'+pad(x.getHours())+pad(x.getMinutes())+'00';
  const text='Follow up with '+stop.r;
  const cadence=intelFor(stop.n)?.nextSteps?.cadence?.[status]||'Follow the timing agreed with the team.';
  const details='Toronto Culinary Passport. Outcome: '+STATUS_LABELS[status]+'. '+cadence+' Review your notes and contact before acting. This reminder does not confirm a restaurant appointment.';
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(text)+'&dates='+fmt(d)+'/'+fmt(end)+'&details='+encodeURIComponent(details)+'&ctz=America%2FToronto';
}
function hasVisit(stop){try{return !!JSON.parse(localStorage.getItem(VISIT_KEY)||'{}')[stop.n];}catch(_){return false;}}
function applicationRecord(stop){return (window.FLOW_DATA?.restaurants||[]).find(r=>String(r.id)===String(stop.n))||{};}
function exactRole(stop){const hiring=applicationRecord(stop).hiring||{};return hiring.role||(hiring.roles||[]).join(' / ')||'[exact role]';}
function applicationSite(contact){return contact.applyLabel||'the application site';}
function submissionDate(stop,status){return STEP_STATE[stepKey(stop,status,'submission-date')]||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function draftFor(stop,status,contact){
  const intel=intelFor(stop.n), next=intel?.nextSteps||{}, submitted=!!STEP_STATE[stepKey(stop,status,"submit-application")];
  const key=stop.n+":"+status+":"+(submitted?"submitted":"before"), saved=DRAFTS[key];
  if(saved)return {...saved,key};
  const greeting="Hi "+(contact.person||stop.r+" Team")+",\n\n";
  const angle=intel?.application?.note||"My background at Capra’s includes serving, bar leadership and private-event work.";
  let body=next.gmailBody?.[status]||greeting+angle+"\n\nThank you,\nJonathan Beaulne";
  let subject=next.gmailSubject?.[status]||"Front-of-house introduction — "+stop.r;
  if(status==='apply-online'&&!hasVisit(stop)){
    const role=exactRole(stop),site=applicationSite(contact);
    const background='My Capra’s experience includes Bar Lead, Server, Private Event Coordinator and Private Event Server roles.';
    if(!submitted){
      subject='Application preparation — '+stop.r;
      body=greeting+'I am preparing an application for '+role+' through '+site+'.\n\n'+background+'\n\nCould you please confirm the exact role and preferred application link before I submit?\n\nThank you,\nJonathan Beaulne';
    }else{
      subject='Application submitted — '+stop.r;
      body=greeting+'I have submitted my application for '+role+' through '+site+' on '+submissionDate(stop,status)+'.\n\n'+background+'\n\nCould you please let me know whether any further information would be useful?\n\nThank you,\nJonathan Beaulne';
    }
  }
  return {subject,body,key};
}
function gmailDraftUrl(contact,draft){
  if(!contact.email)return "";
  return "https://mail.google.com/mail/?view=cm&fs=1&to="+encodeURIComponent(contact.email)+"&su="+encodeURIComponent(draft.subject)+"&body="+encodeURIComponent(draft.body);
}
function revisitScript(stop,status,contact){
  const submitted=!!STEP_STATE[stepKey(stop,status,'submit-application')];
  if(status==='apply-online'&&!hasVisit(stop))return submitted?'Hi, I submitted an online application for '+exactRole(stop)+' on '+submissionDate(stop,status)+'. Is there any further information that would be useful?':'Hi, I am preparing an online application for '+exactRole(stop)+' through '+applicationSite(contact)+'. Could you please confirm the exact role and preferred application link before I submit?';
  if(status==="apply-online"&&!submitted)return "Hi, I am preparing the online application. May I confirm the exact role and application link before I submit?";
  return intelFor(stop.n)?.nextSteps?.revisitScripts?.[status]||"Hi, I’m following up on my earlier visit. Is there a good time to speak briefly with whoever handles front-of-house hiring?";
}
function tasksFor(stop,status,contact){
  const base=[];
  if(status==="apply-online"){
    base.push({id:"open-application",title:"Open the application website",desc:contact.applyUrl?"Use the verified/researched application path below.":"No verified application URL is stored yet. Add the exact link the restaurant gave you under Contact & application details."});
    base.push({id:"submit-application",title:"Submit the online application",desc:"Use the tailored cover letter and make sure your resume reflects the role you're applying for."});
    base.push({id:"followup-email",title:"Send a short application follow-up",desc:"After submitting, use the reviewed draft to ask whether any further information would be useful."});
    base.push({id:"reminder",title:"Schedule a follow-up",desc:"Use the researched cadence below, or the date agreed with the manager."});
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
    base.push({id:"reminder",title:"Schedule the agreed check-in",desc:"Give them room, then make sure you actually reconnect."});
    base.push({id:"revisit",title:"Prepare the follow-up / revisit script",desc:"Have a short, confident line ready if you go back in person."});
    base.push({id:"prep",title:"Review likely interview questions",desc:"Treat a Maybe as a live lead and be ready if it turns into an interview quickly."});
  }
  return base;
}
function stepKey(stop,status,id){return String(stop.n)+":"+status+":"+id}
function saveStep(stop,status,id,checked){
  const k=stepKey(stop,status,id);
  if(checked){
    STEP_STATE[k]=1;
    if(id==='submit-application'&&!STEP_STATE[stepKey(stop,status,'submission-date')])STEP_STATE[stepKey(stop,status,'submission-date')]=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }else{
    delete STEP_STATE[k];
    if(id==='submit-application')delete STEP_STATE[stepKey(stop,status,'submission-date')];
  }
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
    const draft=draftFor(stop,status,contact);
    const gmail=gmailDraftUrl(contact,draft);
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
    card.innerHTML='<div class="lead-head"><div><div class="lead-num">Stop '+esc(stop.n)+'</div><div class="lead-name">'+esc(stop.r)+'</div><div class="lead-address">'+esc((window.FLOW_DATA?.restaurants||[]).find(r=>String(r.id)===String(stop.n))?.address||stop.a||"")+'</div></div><span class="status-pill status-'+esc(status)+'">'+esc(STATUS_LABELS[status])+'</span></div>'+
      '<div class="flow-note">'+esc(intel?.nextSteps?.cadence?.[status]||'Follow the timing agreed with the team.')+'</div>'+(status==='apply-online'&&!hasVisit(stop)?'<div class="flow-note">Online application · no visit recorded</div>':'')+'<div class="lead-body"><div class="tasks">'+taskHtml+'</div><div class="actions">'+
        (gmail?'<a class="action primary gmail" href="'+esc(gmail)+'" target="_blank" rel="noopener noreferrer">Open reviewed Gmail draft ↗</a>':'<span class="action gmail disabled">Add email to draft Gmail</span>')+
        applyButton+
        '<a class="action calendar" href="'+esc(cal)+'" target="_blank" rel="noopener noreferrer">Schedule Follow-Up ↗</a>'+
        '<button class="action script" data-script-toggle>Revisit / Follow-Up Script</button>'+
        (prep?'<a class="action" href="'+esc(prep)+'">Open Study Notes</a>':"")+
        (cover?'<a class="action" href="'+esc(cover)+'">Open Cover Letter</a>':"")+
        (contact.applyCaveat?'<div class="action-note">'+esc(contact.applyCaveat)+'</div>':"")+
      '</div></div>'+
      '<details class="lead-details"><summary>Follow-up timing</summary><p>'+esc(intel?.nextSteps?.cadence?.[status]||'Use the timing agreed with the team.')+'</p><label class="contact-field"><span>Date and time in Toronto · editable suggestion</span><input data-followup-time type="datetime-local" value="'+esc(followupTime(stop,status))+'"></label><p>Opening Calendar prepares an event. Save it there when you are ready.</p></details>'+
      '<details class="lead-details" open><summary>Review your draft</summary><p>Replace bracketed details and check the recipient before opening Gmail.</p><label class="contact-field"><span>Subject</span><input data-draft-subject value="'+esc(draft.subject)+'"></label><label class="contact-field"><span>Message</span><textarea data-draft-body rows="10">'+esc(draft.body)+'</textarea></label><button class="tiny" data-copy-draft>Copy message</button></details>'+
      '<div class="script-box" data-script-box>'+esc(script)+'<div class="script-tools"><button class="tiny" data-copy-script>Copy script</button></div></div>'+
      '<details class="lead-details"><summary>Contact & application details</summary><div class="contact-grid">'+
        '<label class="contact-field"><span>Contact / manager</span><input data-person value="'+esc(contact.person)+'" placeholder="Manager or contact name"></label>'+
        '<label class="contact-field"><span>Email</span><input data-email type="email" value="'+esc(contact.email)+'" placeholder="Public / provided work email"></label>'+
        '<label class="contact-field full"><span>Application URL</span><input data-apply-url value="'+esc(contact.applyUrl)+'" placeholder="Paste exact application link if they give you one"></label>'+
      '</div><button class="save-contact">Save details</button></details>';
    card.querySelectorAll("[data-step]").forEach(cb=>cb.onchange=()=>{saveStep(stop,status,cb.dataset.step,cb.checked);render()});
    card.querySelector("[data-script-toggle]").onclick=()=>card.querySelector("[data-script-box]").classList.toggle("show");
    card.querySelector("[data-copy-script]").onclick=async function(){try{await navigator.clipboard.writeText(script);this.textContent="Copied ✓"}catch(e){this.textContent="Select + copy"}};
    card.querySelector('[data-followup-time]').onchange=ev=>{if(!ev.target.value)return;FOLLOWUPS[stop.n+':'+status]=ev.target.value;localStorage.setItem(FOLLOWUP_KEY,JSON.stringify(FOLLOWUPS));card.querySelector('a.calendar').href=calendarUrl(stop,status,ev.target.value);};
    const updateDraft=()=>{const updated={subject:card.querySelector('[data-draft-subject]').value,body:card.querySelector('[data-draft-body]').value};DRAFTS[draft.key]=updated;localStorage.setItem(DRAFT_KEY,JSON.stringify(DRAFTS));const link=card.querySelector('a.gmail');if(link)link.href=gmailDraftUrl(contact,updated);};
    card.querySelector('[data-draft-subject]').oninput=updateDraft;card.querySelector('[data-draft-body]').oninput=updateDraft;
    card.querySelector('[data-copy-draft]').onclick=async function(){try{await navigator.clipboard.writeText(card.querySelector('[data-draft-body]').value);this.textContent='Copied ✓';}catch(_){this.textContent='Select and copy the message';}};
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

/* Shared workshop records are visible here without overwriting legacy visits. */
(function(){
 const A=window.PASSPORT_AUDIT,records=window.PassportFlow.read('toronto42-prep-visits-v1',{}).apps||{};
 const rows=Object.entries(records).filter(([,a])=>a.submitted||['reply','interview','offer','rejected','withdrawn'].includes(a.stage));
 const box=document.createElement('section');box.className='lead-card';box.style.padding='22px';
 box.innerHTML='<h2>Application workshop follow-through</h2><p>These are the same records as Prep & Visits. Updating them there keeps this list consistent. Visit-based tasks below remain separate.</p>'+(rows.length?rows.map(([id,a])=>{const r=window.FLOW_DATA.restaurants.find(x=>String(x.id)===id);if(!r)return '';const record={...a,assessmentRequired:id==='N21'};return '<article class="flow-note"><h3>'+esc(r.name)+' · '+esc(A.stageLabel(record))+'</h3><p>'+esc(A.nextAction(record))+'</p><p>Submitted: '+esc(a.submittedDate||'date not recorded')+' · Follow-up: '+esc(a.followUpDate||'not set')+'</p>'+(a.interviewAt?'<p>Interview: '+esc(a.interviewAt.replace('T',' '))+' Toronto</p>':'')+'<a href="'+esc(preview('day.html',{stop:id}))+'#workshop">Update application / response</a></article>';}).join(''):'<p>No submissions or employer responses recorded in the workshop yet.</p>');
 document.querySelector('#leadList').before(box);
})();
