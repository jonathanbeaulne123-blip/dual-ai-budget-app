const DAY_KEY="toronto42-day-plan-2026-09-19",PACK_KEY="toronto42-pack-plan-2026-09-19",VISIT_KEY="toronto42-culinary-passport-v1",OUTCOME_KEY="toronto42-outcomes-v1",CUSTOM_KEY="toronto42-custom-stops-v1";
const PACK_ITEMS=[
{id:"wallet",group:"Must-have",label:"Wallet + money / cards"},
{id:"id",group:"Must-have",label:"Government photo ID"},
{id:"phone",group:"Tech",label:"Phone"},
{id:"phone-charger",group:"Tech",label:"Phone charger + cable"},
{id:"laptop",group:"Tech",label:"Laptop"},
{id:"laptop-charger",group:"Tech",label:"Laptop charger"},
{id:"power-bank",group:"Tech",label:"Power bank / backup battery"},
{id:"earbuds",group:"Tech",label:"Earbuds / headphones"},
{id:"resumes",group:"Job kit",label:"Printed resume copies"},
{id:"cover-letters",group:"Job kit",label:"Priority restaurant cover letters printed at Staples"},
{id:"resume-digital",group:"Job kit",label:"Resume + cover letters saved on phone/laptop"},
{id:"smart-serve",group:"Job kit",label:"Smart Serve proof accessible on phone"},
{id:"folder",group:"Job kit",label:"Slim folder / portfolio to keep papers clean"},
{id:"pens",group:"Job kit",label:"2 pens + small notebook"},
{id:"staples-files",group:"Print",label:"Staples print files ready before leaving"},
{id:"usb",group:"Print",label:"USB drive as print backup (optional but useful)"},
{id:"cologne",group:"Presentation",label:"Cologne — light use only"},
{id:"gum",group:"Presentation",label:"Gum / mints"},
{id:"hair-gel",group:"Presentation",label:"Hair gel / comb"},
{id:"deodorant",group:"Presentation",label:"Deodorant"},
{id:"lint-roller",group:"Presentation",label:"Lint roller / stain pen"},
{id:"backup-shirt",group:"Presentation",label:"Backup clean shirt if practical"},
{id:"water",group:"Field essentials",label:"Water bottle"},
{id:"snack",group:"Field essentials",label:"Quick snack / protein bar"},
{id:"presto",group:"Field essentials",label:"PRESTO / transit payment ready"},
{id:"umbrella",group:"Field essentials",label:"Weather layer / compact umbrella if needed"},
{id:"sanitizer",group:"Field essentials",label:"Hand sanitizer / tissues"}
];
const BLOCKS=[
{id:"gpt-init",start:"05:10",end:"05:20",type:"chatgpt",label:"ChatGPT · Prompt 0",title:"Initialize the ChatGPT master",desc:"Fresh reset. Paste Prompt 0, confirm the Project Lead role, chat-vs-subagent hierarchy, design mandates and competitive goal. No building yet."},
{id:"gpt-catchup",start:"05:20",end:"06:35",type:"chatgpt",label:"ChatGPT · Part 1",title:"Feed + current-app catch-up",desc:"Use subagents to read every context/prototype area and review the current app source. Build the evidence base before choosing a direction."},
{id:"gpt-synth",start:"06:35",end:"07:15",type:"chatgpt",label:"ChatGPT · Synthesis",title:"Review, bold direction, Books concept, integration plan",desc:"Produce the comprehensive review, identify what is brilliant/broken/missing, define the bold creative direction, Books integration concept and full integration plan."},
{id:"ready",start:"07:15",end:"07:45",type:"reset",label:"Reset",title:"Breakfast, shower, Pack & Print check",desc:"Use the Pack & Print checklist. Confirm ID, money, laptop/phone + chargers, resume kit, Smart Serve proof, grooming kit, water and transit."},
{id:"jobprep",start:"07:45",end:"08:20",type:"prep",label:"Job Prep",title:"Build the reusable restaurant prep system",desc:"Base cover-letter shell, flash-card template, 30–60 second pitch and Capra’s role talking points. Restaurant-specific prep should be 5–10 minutes after this."},
{id:"staples",start:"08:20",end:"08:50",type:"prep",label:"Staples",title:"Print priority application packet",desc:"After Astra finalizes the A-GAME / STRONG shortlist, print tailored cover letters plus extra resume copies. Keep digital backups on phone/laptop.",action:"staples"},
{id:"travel",start:"08:50",end:"09:35",type:"field",label:"Route",title:"Travel into Toronto + route review",desc:"Use the Route Portal to choose the first viable cluster. Quality conversations are the goal; do not chase pins for their own sake.",action:"portal"},
{id:"gpt-prompts",start:"09:20",end:"10:00",type:"chatgpt",label:"ChatGPT · Handoff",title:"Master review + exact implementation prompts",desc:"Tighten the morning direction and write the exact prompts for the first heavy implementation chats. Only spawn independent builds that can genuinely run in parallel."},
{id:"microprep",start:"10:00",end:"10:15",type:"prep",label:"Restaurant Prep",title:"First-cluster micro-pack",desc:"Research the immediate targets and prepare the first cover letter / flash cards before walking into the first serious restaurant.",action:"district0"},
{id:"wave1",start:"10:15",end:"10:50",type:"field",label:"Restaurant Wave 1A",title:"First manager-access window",desc:"Hit the first few strong targets. Log every outcome immediately. Keep 10:50–11:00 clear so Claude can start exactly on its reset.",action:"district0"},
{id:"claude-stage",start:"10:50",end:"11:00",type:"reset",label:"Claude Reset",title:"Stage the Claude master",desc:"Open the Claude master chat, have Prompt 0 ready, and be in position to start as soon as the 11:00 AM reset lands."},
{id:"claude-init",start:"11:00",end:"11:15",type:"claude",label:"Claude · Prompt 0",title:"Initialize the fresh Claude master",desc:"Use the fresh Claude window for the same Project Lead initialization and competitive mandate. Do not start Part 1 until the initialization gate is cleared."},
{id:"claude-catchup",start:"11:15",end:"12:30",type:"claude",label:"Claude · Part 1",title:"Independent feed + current-app catch-up",desc:"Run the same catch-up independently: prototypes/context, current app review, and evidence gathering. Lunch-rush hours become productive model time."},
{id:"claude-synth",start:"12:30",end:"13:30",type:"claude",label:"Claude · Synthesis",title:"Independent bold direction + Books + integration plan",desc:"Claude produces its comprehensive review, bold creative direction, Books concept, full plan and recommended implementation chats without being anchored to ChatGPT’s answer."},
{id:"compare",start:"13:30",end:"14:00",type:"compare",label:"Dual-Model Compare",title:"Compare directions + launch first implementation chats",desc:"Pick the strongest ideas from each master. Assign 1–2 independent heavy prototype builds and write/paste the exact implementation prompts. If a creative fork is unresolved, schedule a decision round instead."},
{id:"wave2",start:"14:00",end:"16:30",type:"field",label:"Restaurant Wave 2",title:"Main restaurant push",desc:"Move through one or two dense districts. Add strong unexpected restaurants immediately. Real conversations matter more than total attempts.",action:"portal"},
{id:"impl-review",start:"16:30",end:"17:15",type:"compare",label:"Prototype Review",title:"Review first implementation output / run decision round if needed",desc:"Review whatever the first heavy builds produced. If a fork remains, use three distinct mini-prototypes; otherwise write the next implementation prompt or validation task."},
{id:"evening",start:"17:15",end:"19:30",type:"field",label:"Selective Field",title:"Selective evening restaurant wave",desc:"Only revisit places that make sense now: requested returns, strong nearby opportunities or application follow-ups. Do not wait around during slammed service.",action:"portal"},
{id:"dinner-review",start:"19:30",end:"20:30",type:"compare",label:"Dinner + Review",title:"Restaurant progress + prototype comparison",desc:"Eat and review both workstreams. If both competing prototypes exist, identify the specific stronger ideas that should survive into the final concept. Also review interviews, maybes and apply-online follow-ups.",action:"portal"},
{id:"impl-eval",start:"20:30",end:"21:45",type:"compare",label:"Implementation / Eval",title:"Continue build or run competitive evaluation",desc:"If both prototypes are ready, run the competitive evaluation and truly merge the stronger ideas. If not, use this as the main evening implementation/validation block. Do not force real-code integration prematurely."},
{id:"follow",start:"21:45",end:"22:15",type:"follow",label:"Follow-up",title:"Online applications + follow-ups",desc:"Handle every Need to apply online result while the conversations are fresh. Tailor each application from what happened in person.",action:"checklist"},
{id:"close",start:"22:15",end:"22:35",type:"follow",label:"Close",title:"Close the loop + set the next UX gate",desc:"One clean end-of-day state: restaurant outcomes, interviews, follow-ups, unexpected stops, model/prototype status, unresolved decision forks, and the exact first task for the next session."}
];

function preview(file,params={}){const qs=new URLSearchParams(params).toString();if(location.hostname==="html-preview.github.io"){const base="https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2F"+encodeURIComponent(file);return base+(qs?"&"+qs:"")}return file+(qs?"?"+qs:"")}
document.querySelector("#backChecklist").href=preview("index.html");document.querySelector("#launchChecklist").href=preview("index.html");document.querySelector("#openPortal").href=preview("map.html");document.querySelector("#launchPortal").href=preview("map.html");

let packState=JSON.parse(localStorage.getItem(PACK_KEY)||"{}");
function renderPack(){
  const el=document.querySelector("#packList");if(!el)return;
  const groups=[...new Set(PACK_ITEMS.map(x=>x.group))];
  el.innerHTML=groups.map(group=>'<div class="pack-group"><div class="pack-group-title">'+group+'</div>'+PACK_ITEMS.filter(x=>x.group===group).map(item=>'<label class="pack-item '+(packState[item.id]?"done":"")+'"><input type="checkbox" data-pack="'+item.id+'" '+(packState[item.id]?"checked":"")+'><span>'+item.label+'</span></label>').join("")+'</div>').join("");
  el.querySelectorAll("[data-pack]").forEach(cb=>cb.onchange=()=>{packState[cb.dataset.pack]=cb.checked;localStorage.setItem(PACK_KEY,JSON.stringify(packState));renderPack()});
  const done=PACK_ITEMS.filter(x=>packState[x.id]).length;
  document.querySelector("#packDone").textContent=done;
  document.querySelector("#packTotal").textContent=PACK_ITEMS.length;
}
let state=JSON.parse(localStorage.getItem(DAY_KEY)||"{}");
const timeline=document.querySelector("#timeline");
function duration(a,b){const [ah,am]=a.split(":").map(Number),[bh,bm]=b.split(":").map(Number);const n=bh*60+bm-(ah*60+am);return n>=60?Math.floor(n/60)+"h "+(n%60? n%60+"m":"") : n+"m"}
function actions(block){if(!block.action)return"";if(block.action==="portal")return `<a class="mini-link" href="${preview("map.html")}">Open Route Portal ↗</a>`;if(block.action==="district0")return `<a class="mini-link" href="${preview("map.html",{focusDistrict:0})}">Open District 1 ↗</a>`;if(block.action==="staples")return `<a class="mini-link" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=Staples">Find Staples ↗</a>`;return `<a class="mini-link" href="${preview("index.html")}">Open checklist ↗</a>`}
function render(){timeline.innerHTML=BLOCKS.map(b=>`<article class="block ${state[b.id]?"done":""}" data-id="${b.id}" data-start="${b.start}" data-end="${b.end}"><div><span class="time">${b.start}–${b.end}</span><span class="duration">${duration(b.start,b.end)}</span></div><div><span class="type ${b.type}">${b.label}</span><span class="now-badge">Now</span><h3>${b.title}</h3><p>${b.desc}</p><div class="block-actions">${actions(b)}</div></div><input class="check" type="checkbox" aria-label="Mark ${b.title} complete" ${state[b.id]?"checked":""}></article>`).join("");timeline.querySelectorAll(".check").forEach(ch=>ch.onchange=()=>{const id=ch.closest(".block").dataset.id;if(ch.checked)state[id]=1;else delete state[id];localStorage.setItem(DAY_KEY,JSON.stringify(state));render();updateProgress()});highlightNow()}
function updateProgress(){const n=BLOCKS.filter(b=>state[b.id]).length,p=Math.round(n/BLOCKS.length*100);document.querySelector("#doneBlocks").textContent=n;const total=document.querySelector("#totalBlocks");if(total)total.textContent=" / "+BLOCKS.length;document.querySelector("#dayPct").textContent=p+"% done";document.querySelector("#dayFill").style.width=p+"%"}
function highlightNow(){document.querySelectorAll(".block").forEach(x=>x.classList.remove("current"));const now=new Date();if(now.getFullYear()!==2026||now.getMonth()!==8||now.getDate()!==19){document.querySelector("#nowLabel").textContent=now<new Date(2026,8,19,5,10)?"Tomorrow starts at 5:10 AM":"Saturday plan";return}const min=now.getHours()*60+now.getMinutes();const active=BLOCKS.find(b=>{const[aH,aM]=b.start.split(":").map(Number),[eH,eM]=b.end.split(":").map(Number);return min>=aH*60+aM&&min<eH*60+eM});if(active){document.querySelector('.block[data-id="'+active.id+'"]')?.classList.add("current");document.querySelector("#nowLabel").textContent="Current block: "+active.title}else document.querySelector("#nowLabel").textContent=min<310?"Day starts at 5:10 AM":"Scheduled blocks finished"}
function updateSnapshot(){const S=JSON.parse(localStorage.getItem(VISIT_KEY)||"{}"),T=JSON.parse(localStorage.getItem(OUTCOME_KEY)||"{}"),X=JSON.parse(localStorage.getItem(CUSTOM_KEY)||"[]");document.querySelector("#visitedMetric").textContent=Object.keys(S).filter(k=>/^\d+$/.test(k)&&S[k]).length;document.querySelector("#interviewMetric").textContent=Object.values(T).filter(x=>x==="interview").length;document.querySelector("#applyMetric").textContent=Object.values(T).filter(x=>x==="apply-online").length;document.querySelector("#customMetric").textContent=X.length}
document.querySelector("#resetDay").onclick=()=>{if(confirm("Clear all Tomorrow Plan checkmarks?")){state={};localStorage.removeItem(DAY_KEY);render();updateProgress()}};
renderPack();render();updateProgress();updateSnapshot();setInterval(highlightNow,60000);window.addEventListener("storage",()=>{updateSnapshot();renderPack()});
