const K="toronto42-culinary-passport-v1",SK="toronto42-outcomes-v1",CK="toronto42-custom-stops-v1";
const S=JSON.parse(localStorage.getItem(K)||"{}"),T=JSON.parse(localStorage.getItem(SK)||"{}"),X=JSON.parse(localStorage.getItem(CK)||"[]");
const STATUSES=[
{id:"chat",label:"Sat down and chatted (no confirmation)"},
{id:"no-manager",label:"Didn't get to talk to the manager"},
{id:"interview",label:"Got an interview"},
{id:"maybe",label:"Maybe"},
{id:"apply-online",label:"Need to apply online"},
{id:"job",label:"Got the job"}
];
const STATUS_COLORS={"unvisited":"#77736c","visited":"#7a2f2f","chat":"#557c9d","no-manager":"#b47631","interview":"#725b92","maybe":"#9a7d20","apply-online":"#a84d46","job":"#32634a"};
const SEGMENT_RANGES=[[1,7],[8,16],[17,27],[28,35],[36,42]];
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const statusLabel=id=>(STATUSES.find(s=>s.id===id)||{}).label||"Visited — no outcome";
const mapSearch=x=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([x.r,x.a,"Toronto Ontario"].filter(Boolean).join(" "));
const coordMatches=[...R.join("").matchAll(/!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/g)].map(m=>({lng:+m[1],lat:+m[2]}));
const STOPS=D.map((x,i)=>({...x,lat:coordMatches[i]?.lat,lng:coordMatches[i]?.lng}));
let activeFilter="all",activeDistrict="all",activeStatus="all",map,routeLine,markers=[];

function previewUrl(file){
 if(location.hostname==="html-preview.github.io"){
   return "https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2F"+encodeURIComponent(file);
 }
 return file;
}
document.querySelector("#backChecklist").href=previewUrl("index.html");

function stopState(x){
 const visited=!!S[x.n],status=T[x.n]||"";
 return {visited,status,key:visited?(status||"visited"):"unvisited"};
}
function markerIcon(x){
 const st=stopState(x);
 return L.divIcon({className:"",html:`<div class="stop-marker ${esc(st.key)}">${x.n}</div>`,iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-13]});
}
function popupHtml(x){
 const st=stopState(x),label=st.visited?statusLabel(st.status):"Not visited yet";
 return `<div class="popup-num">Stop ${x.n}</div><div class="popup-name">${esc(x.r)}</div><div class="popup-address">${esc(x.a)}</div><span class="popup-status">${esc(label)}</span><br><a class="popup-link" href="${esc(mapSearch(x))}" target="_blank" rel="noopener noreferrer">Open this stop in Google Maps ↗</a>`;
}
function initMap(){
 map=L.map("map",{zoomControl:true,preferCanvas:true});
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
 routeLine=L.polyline(STOPS.map(x=>[x.lat,x.lng]),{color:"#7a2f2f",weight:4,opacity:.55,dashArray:"7 7"}).addTo(map);
 markers=STOPS.map(x=>{
   const m=L.marker([x.lat,x.lng],{icon:markerIcon(x),title:`${x.n}. ${x.r}`}).bindPopup(popupHtml(x));
   m.stop=x;m.addTo(map);return m;
 });
 fitFullRoute();
}
function fitFullRoute(){
 const b=L.latLngBounds(STOPS.map(x=>[x.lat,x.lng]));map.fitBounds(b,{padding:[32,32]});
}
function filterMatch(x){
 const st=stopState(x);
 const visitOK=activeFilter==="all"||(activeFilter==="remaining"&&!st.visited)||(activeFilter==="visited"&&st.visited);
 const districtOK=activeDistrict==="all"||String(x.u)===activeDistrict;
 const statusOK=activeStatus==="all"||(activeStatus==="none"&&st.visited&&!st.status)||(activeStatus==="unvisited"&&!st.visited)||(st.status===activeStatus);
 return visitOK&&districtOK&&statusOK;
}
function applyFilters(){
 const visible=[];
 markers.forEach(m=>{const ok=filterMatch(m.stop);if(ok){if(!map.hasLayer(m))m.addTo(map);visible.push([m.stop.lat,m.stop.lng])}else if(map.hasLayer(m))map.removeLayer(m)});
 if(visible.length===1)map.setView(visible[0],16);
 else if(visible.length>1)map.fitBounds(L.latLngBounds(visible),{padding:[36,36]});
}
function buildFilters(){
 document.querySelectorAll(".filter-chip").forEach(b=>b.onclick=()=>{
   document.querySelectorAll(".filter-chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeFilter=b.dataset.filter;applyFilters();
 });
 const ds=document.querySelector("#districtFilter");
 B.forEach((b,i)=>ds.insertAdjacentHTML("beforeend",`<option value="${i}">District ${i+1}</option>`));
 ds.onchange=()=>{activeDistrict=ds.value;applyFilters()};
 const ss=document.querySelector("#statusFilter");
 ss.insertAdjacentHTML("beforeend",'<option value="unvisited">Not visited</option><option value="none">Visited — no outcome</option>');
 STATUSES.forEach(s=>ss.insertAdjacentHTML("beforeend",`<option value="${s.id}">${esc(s.label)}</option>`));
 ss.onchange=()=>{activeStatus=ss.value;applyFilters()};
 document.querySelector("#fitRoute").onclick=()=>{activeFilter="all";activeDistrict="all";activeStatus="all";document.querySelectorAll(".filter-chip").forEach((x,i)=>x.classList.toggle("active",i===0));ds.value="all";ss.value="all";markers.forEach(m=>{if(!map.hasLayer(m))m.addTo(map)});fitFullRoute()};
}
function buildProgress(){
 const visited=STOPS.filter(x=>S[x.n]).length,pct=Math.round(visited/STOPS.length*100);
 document.querySelector("#visitedCount").textContent=visited;document.querySelector("#totalCount").textContent=" / "+STOPS.length;document.querySelector("#headlinePct").textContent=pct+"% visited";document.querySelector("#headlineFill").style.width=pct+"%";
 const stats=[
   {key:"unvisited",label:"Not visited",count:STOPS.length-visited},
   {key:"visited",label:"Visited — no outcome",count:STOPS.filter(x=>S[x.n]&&!T[x.n]).length},
   ...STATUSES.map(s=>({key:s.id,label:s.label,count:STOPS.filter(x=>T[x.n]===s.id).length}))
 ];
 document.querySelector("#outcomeStats").innerHTML=stats.map(s=>`<div class="stat-row"><span class="stat-dot" style="background:${STATUS_COLORS[s.key]}"></span><span class="stat-label">${esc(s.label)}</span><span class="stat-count">${s.count}</span></div>`).join("");
 document.querySelector("#mapLegend").innerHTML=stats.filter(s=>s.key==="unvisited"||s.count>0).map(s=>`<span class="legend-item"><span class="legend-dot" style="background:${STATUS_COLORS[s.key]}"></span>${esc(s.label)}</span>`).join("");
}
function buildSegments(){
 const el=document.querySelector("#routeSegments");
 el.innerHTML=R.map((url,i)=>{
   const [start,end]=SEGMENT_RANGES[i],count=end-start+1,visited=STOPS.filter(x=>x.n>=start&&x.n<=end&&S[x.n]).length;
   return `<a class="segment-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span><span class="segment-name">District ${i+1} · Stops ${start}–${end}</span><span class="segment-meta">${visited}/${count} visited · live Google route</span></span><span class="segment-arrow">↗</span></a>`;
 }).join("");
}
function buildNext(){
 const x=STOPS.find(x=>!S[x.n]),el=document.querySelector("#nextStop");
 if(!x){el.innerHTML='<div class="empty-state">All 42 original itinerary stops are marked visited.</div>';return}
 el.innerHTML=`<div class="next-card"><div class="next-num">Stop ${x.n}</div><div class="next-name">${esc(x.r)}</div><div class="next-address">${esc(x.a)}</div><a class="popup-link" href="${esc(mapSearch(x))}" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a></div>`;
}
function buildDistricts(){
 const el=document.querySelector("#districtCards");
 el.innerHTML=B.map((b,i)=>{
   const [start,end]=SEGMENT_RANGES[i],arr=STOPS.filter(x=>x.n>=start&&x.n<=end),v=arr.filter(x=>S[x.n]).length,p=Math.round(v/arr.length*100),title=b.replace(/^Block \d+:\s*/,"");
   return `<article class="district-card" data-district="${i}"><div class="district-number">District ${i+1}</div><div class="district-title">${esc(title)}</div><div class="district-bar"><span style="width:${p}%"></span></div><div class="district-meta"><span>${v}/${arr.length} visited</span><span>${p}%</span></div></article>`;
 }).join("");
 el.querySelectorAll(".district-card").forEach(c=>c.onclick=()=>{activeDistrict=c.dataset.district;document.querySelector("#districtFilter").value=activeDistrict;applyFilters();document.querySelector("#map").scrollIntoView({behavior:"smooth",block:"center"})});
}
function buildUnexpected(){
 const panel=document.querySelector("#unexpectedPanel"),list=document.querySelector("#unexpectedList");
 if(!X.length){panel.hidden=true;return}
 panel.hidden=false;list.innerHTML=X.map(x=>{
   const st=!!S[x.n]?(T[x.n]?statusLabel(T[x.n]):"Visited — no outcome"):"Not visited";
   return `<div class="unexpected-item"><strong>${esc(x.r)}</strong><span>${esc(x.a||"No address")} · ${esc(st)}</span><a href="${esc(mapSearch(x))}" target="_blank" rel="noopener noreferrer">Locate in Google Maps ↗</a></div>`;
 }).join("");
}
if(coordMatches.length!==42){
 document.querySelector("#map").innerHTML='<div class="empty-state" style="padding:24px">Could not read all 42 Google route coordinates.</div>';
}else{
 buildFilters();buildProgress();buildSegments();buildNext();buildDistricts();buildUnexpected();initMap();
}
window.addEventListener("storage",()=>location.reload());