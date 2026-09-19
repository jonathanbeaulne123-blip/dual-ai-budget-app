const MAP_ERROR_FIXES={
RefererNotAllowedMapError:{title:"Website restriction mismatch",detail:()=>`Allow this website in the key's HTTP referrers: ${location.origin}/*`,url:"https://console.cloud.google.com/google/maps-apis/credentials"},
ApiNotActivatedMapError:{title:"Maps JavaScript API is not enabled",detail:()=>"Enable Maps JavaScript API in the same Google Cloud project as this key.",url:"https://console.cloud.google.com/google/maps-apis/apis/maps-backend.googleapis.com"},
ApiTargetBlockedMapError:{title:"The key's API restrictions block Maps",detail:()=>"Edit the key and allow Maps JavaScript API and Routes API.",url:"https://console.cloud.google.com/google/maps-apis/credentials"},
BillingNotEnabledMapError:{title:"Billing is not enabled for this project",detail:()=>"Attach your active billing account to the Google Cloud project that owns this API key.",url:"https://console.cloud.google.com/billing"},
ClientBillingNotEnabledMapError:{title:"Billing is not enabled for this project",detail:()=>"Attach your active billing account to the Google Cloud project that owns this API key.",url:"https://console.cloud.google.com/billing"},
InvalidKeyMapError:{title:"The Maps API key is invalid",detail:()=>"Check that google-config.js contains the current browser API key.",url:"https://console.cloud.google.com/google/maps-apis/credentials"},
ExpiredKeyMapError:{title:"The Maps API key is not recognized yet",detail:()=>"If you just created the key, wait a few minutes. Otherwise create a new browser key.",url:"https://console.cloud.google.com/google/maps-apis/credentials"},
ProjectDeniedMapError:{title:"Google denied this project",detail:()=>"Open the Google Maps Platform project and check its status, billing, and API access.",url:"https://console.cloud.google.com/google/maps-apis/overview"}
};
let capturedMapError="";
function renderMapDiagnostic(code,message=""){
 const fix=MAP_ERROR_FIXES[code];
 const title=fix?fix.title:"Google Maps authentication failed";
 const detail=fix?fix.detail():(message||"Open Chrome DevTools Console for Google's full Maps error.");
 const url=fix?.url||"https://console.cloud.google.com/google/maps-apis/overview";
 const el=document.querySelector("#map");
 if(!el)return;
 el.innerHTML=`<div class="map-error"><strong>${esc(title)}</strong><span><b>Error:</b> ${esc(code||"Unknown")}</span><span>${esc(detail)}</span><span><b>Current site:</b> ${esc(location.origin)}</span><a class="cloud-fix-link" href="${url}" target="_blank" rel="noopener noreferrer">Open the exact Google Cloud setting ↗</a></div>`;
}
const originalConsoleError=console.error.bind(console);
console.error=(...args)=>{
 try{
   const text=args.map(a=>typeof a==="string"?a:(a?.message||String(a))).join(" ");
   const m=text.match(/Google Maps JavaScript API error:\s*([A-Za-z0-9_]+)/);
   if(m){capturedMapError=m[1];setTimeout(()=>renderMapDiagnostic(capturedMapError,text),0)}
 }catch(_){}
 originalConsoleError(...args);
};
window.addEventListener("error",e=>{
 const text=[e.message,e.error?.message].filter(Boolean).join(" ");
 const m=text.match(/(RefererNotAllowedMapError|ApiNotActivatedMapError|ApiTargetBlockedMapError|BillingNotEnabledMapError|ClientBillingNotEnabledMapError|InvalidKeyMapError|ExpiredKeyMapError|ProjectDeniedMapError)/);
 if(m){capturedMapError=m[1];renderMapDiagnostic(capturedMapError,text)}
});

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
const STATUS_COLORS={unvisited:"#77736c",visited:"#7a2f2f",chat:"#557c9d","no-manager":"#b47631",interview:"#725b92",maybe:"#9a7d20","apply-online":"#a84d46",job:"#32634a"};
const SEGMENT_RANGES=[[1,7],[8,16],[17,27],[28,35],[36,42]],SEGMENT_COLORS=["#7a2f2f","#8a5c2b","#496b72","#725b92","#32634a"];
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const statusLabel=id=>(STATUSES.find(s=>s.id===id)||{}).label||"Visited — no outcome";
const mapSearch=x=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([x.r,x.a,"Toronto Ontario"].filter(Boolean).join(" "));
const coordMatches=[...R.join("").matchAll(/!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/g)].map(m=>({lng:+m[1],lat:+m[2]}));
const STOPS=D.map((x,i)=>{const f=window.FLOW_DATA?.restaurants.find(r=>String(r.id)===String(x.n));return {...x,a:f?.address||x.a,lat:f?.coordinates?.lat||coordMatches[i]?.lat,lng:f?.coordinates?.lng||coordMatches[i]?.lng};});
let activeFilter="all",activeDistrict="all",activeStatus="all",map,infoWindow,AdvancedMarkerElement,RouteClass,markers=[],routePolylines=[],connectorPolylines=[];
let routeTotals={distanceMeters:0,durationMillis:0,loaded:0,failed:0};

function previewUrl(file){return location.hostname==="html-preview.github.io"?"https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2F"+encodeURIComponent(file):file}
function nextStepsUrl(stop){const qs=stop?new URLSearchParams({stop:String(stop)}).toString():"";if(location.hostname==="html-preview.github.io")return "https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2Fnextsteps.html"+(qs?"&"+qs:"");return "nextsteps.html"+(qs?"?"+qs:"")}
function intelUrl(stop,view){
 const qs=new URLSearchParams({stop:String(stop),view:view}).toString();
 if(location.hostname==="html-preview.github.io")return "https://html-preview.github.io/?url=https%3A%2F%2Fgithub.com%2Fjonathanbeaulne123-blip%2Fdual-ai-budget-app%2Fblob%2Ftoronto-42-host%2Ftoronto42%2Frestaurant.html&"+qs;
 return "restaurant.html?"+qs;
}
document.querySelector("#backChecklist").href=previewUrl("index.html");const dayPlanMap=document.querySelector("#dayPlanMap");if(dayPlanMap)dayPlanMap.href=previewUrl("day.html");const nextStepsMap=document.querySelector("#nextStepsMap");if(nextStepsMap)nextStepsMap.href=nextStepsUrl();const nextStepsMapCount=document.querySelector("#nextStepsMapCount");if(nextStepsMapCount)nextStepsMapCount.textContent=Object.values(T).filter(x=>["chat","no-manager","maybe","apply-online"].includes(x)).length;const hireabilityMap=document.querySelector("#hireabilityMap");if(hireabilityMap)hireabilityMap.href=previewUrl("hireability.html");

function state(x){const visited=!!S[x.n],status=T[x.n]||"";return{visited,status,key:visited?(status||"visited"):"unvisited"}}
function markerEl(x){const st=state(x),el=document.createElement("div");el.className="stop-marker "+st.key;el.textContent=x.n;el.title=x.n+". "+x.r;return el}
function popup(x){const st=state(x),label=st.visited?statusLabel(st.status):"Not visited yet",actionable=["chat","no-manager","maybe","apply-online"].includes(st.status),next=actionable?`<a class="popup-link popup-next" href="${esc(nextStepsUrl(x.n))}">Next Steps</a>`:"";const f=window.FLOW_DATA?.restaurants.find(r=>String(r.id)===String(x.n));return `${f?PassportFlow.badges(f):""}<div class="popup-num">Stop ${x.n}</div><div class="popup-name">${esc(x.r)}</div><div class="popup-address">${esc(x.a)}</div><span class="popup-status">${esc(label)}</span><div class="popup-actions"><a class="popup-link" href="${esc(intelUrl(x.n,"flashcards"))}">Study Notes</a><a class="popup-link" href="${esc(intelUrl(x.n,"coverletter"))}">Cover Letter</a>${next}</div>`}
function bounds(stops){const b=new google.maps.LatLngBounds();stops.forEach(x=>b.extend({lat:x.lat,lng:x.lng}));return b}
function fitFull(){map.fitBounds(bounds(STOPS),48)}
function match(x){const st=state(x);return(activeFilter==="all"||activeFilter==="remaining"&&!st.visited||activeFilter==="visited"&&st.visited)&&(activeDistrict==="all"||String(x.u)===activeDistrict)&&(activeStatus==="all"||activeStatus==="unvisited"&&!st.visited||activeStatus==="none"&&st.visited&&!st.status||st.status===activeStatus)}
function applyFilters(){
 if(!map)return;const v=[];
 markers.forEach(m=>{const ok=match(m.stop);m.map=ok?map:null;if(ok)v.push(m.stop)});
 routePolylines.forEach((arr,i)=>arr.forEach(p=>p.setVisible(activeDistrict==="all"||String(i)===activeDistrict)));
 connectorPolylines.forEach(p=>p.setVisible(activeDistrict==="all"));
 if(v.length===1){map.setCenter({lat:v[0].lat,lng:v[0].lng});map.setZoom(16)}else if(v.length>1)map.fitBounds(bounds(v),56)
}
function buildFilters(){
 document.querySelectorAll(".filter-chip").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter-chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeFilter=b.dataset.filter;applyFilters()});
 const ds=document.querySelector("#districtFilter");B.forEach((_,i)=>ds.insertAdjacentHTML("beforeend",`<option value="${i}">District ${i+1}</option>`));ds.onchange=()=>{activeDistrict=ds.value;applyFilters()};
 const ss=document.querySelector("#statusFilter");ss.insertAdjacentHTML("beforeend",'<option value="unvisited">Not visited</option><option value="none">Visited — no outcome</option>');STATUSES.forEach(s=>ss.insertAdjacentHTML("beforeend",`<option value="${s.id}">${esc(s.label)}</option>`));ss.onchange=()=>{activeStatus=ss.value;applyFilters()};
 document.querySelector("#fitRoute").onclick=()=>{clearPlan();activeFilter=activeDistrict=activeStatus="all";document.querySelectorAll(".filter-chip").forEach((x,i)=>x.classList.toggle("active",i===0));ds.value=ss.value="all";markers.forEach(m=>m.map=map);routePolylines.flat().forEach(p=>p.setVisible(true));connectorPolylines.forEach(p=>p.setVisible(true));fitFull()}
}
function buildProgress(){
 const visited=STOPS.filter(x=>S[x.n]).length,pct=Math.round(visited/STOPS.length*100);
 document.querySelector("#visitedCount").textContent=visited;document.querySelector("#totalCount").textContent=" / "+STOPS.length;document.querySelector("#headlinePct").textContent=pct+"% visited";document.querySelector("#headlineFill").style.width=pct+"%";
 const stats=[{key:"unvisited",label:"Not visited",count:STOPS.length-visited},{key:"visited",label:"Visited — no outcome",count:STOPS.filter(x=>S[x.n]&&!T[x.n]).length},...STATUSES.map(s=>({key:s.id,label:s.label,count:STOPS.filter(x=>T[x.n]===s.id).length}))];
 document.querySelector("#outcomeStats").innerHTML=stats.map(s=>`<div class="stat-row"><span class="stat-dot" style="background:${STATUS_COLORS[s.key]}"></span><span class="stat-label">${esc(s.label)}</span><span class="stat-count">${s.count}</span></div>`).join("");
 document.querySelector("#mapLegend").innerHTML=stats.filter(s=>s.key==="unvisited"||s.count>0).map(s=>`<span class="legend-item"><span class="legend-dot" style="background:${STATUS_COLORS[s.key]}"></span>${esc(s.label)}</span>`).join("")
}
function buildSegments(){
 document.querySelector("#routeSegments").innerHTML=R.map((url,i)=>{const[a,b]=SEGMENT_RANGES[i],arr=STOPS.filter(x=>x.n>=a&&x.n<=b),v=arr.filter(x=>S[x.n]).length;return `<a class="segment-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span><span class="segment-name">District ${i+1} · Stops ${a}–${b}</span><span class="segment-meta" id="segmeta-${i}">${v}/${arr.length} visited · Google route loading…</span></span><span class="segment-arrow">↗</span></a>`}).join("")
}
function buildNext(){
 const el=document.querySelector("#nextStop"),F=window.PassportFlow, data=window.FLOW_DATA;
 if(!F||!data)return;
 el.innerHTML='<div class="next-card"><strong>Prepare first. Visit by neighbourhood.</strong><p>September 19 is for tailored applications, study and interview practice. Later outings are planned by date, opening hours and walking distance from Clarkson rail connections.</p></div><a class="popup-link" href="'+esc(F.link('day.html'))+'">Open Prep & Visits</a><p>The map keeps the original 42 pins and the additional-prospect list. It is a location reference; use the new planner to coordinate a visit block.</p>';
}
function buildDistricts(){
 const el=document.querySelector("#districtCards");
 el.innerHTML=B.map((b,i)=>{const[a,z]=SEGMENT_RANGES[i],arr=STOPS.filter(x=>x.n>=a&&x.n<=z),v=arr.filter(x=>S[x.n]).length,p=Math.round(v/arr.length*100);return `<article class="district-card" data-district="${i}"><div class="district-number">District ${i+1}</div><div class="district-title">${esc(b.replace(/^Block \d+:\s*/,""))}</div><div class="district-bar"><span style="width:${p}%"></span></div><div class="district-meta"><span>${v}/${arr.length} visited</span><span>${p}%</span></div></article>`}).join("");
 el.querySelectorAll(".district-card").forEach(c=>c.onclick=()=>{activeDistrict=c.dataset.district;document.querySelector("#districtFilter").value=activeDistrict;applyFilters();document.querySelector("#map").scrollIntoView({behavior:"smooth",block:"center"})})
}
function buildUnexpected(){
 const panel=document.querySelector("#unexpectedPanel"),list=document.querySelector("#unexpectedList"),extras=(window.ADDITIONAL_PROSPECTS||[]).concat(X);if(!extras.length)return;panel.hidden=false;
 list.innerHTML=extras.map(x=>{const st=S[x.n]?(T[x.n]?statusLabel(T[x.n]):"Visited — no outcome"):"Not visited";return `<div class="unexpected-item"><strong>${esc(x.r)}</strong><span>${esc(x.a||"No address")} · ${esc(st)}</span><a href="${esc(mapSearch(x))}" target="_blank">Locate in Google Maps ↗</a></div>`}).join("")
}
function fmtDist(m){return m>=1000?(m/1000).toFixed(1)+" km":Math.round(m)+" m"}
function fmtDur(ms){const n=Math.round(ms/60000),h=Math.floor(n/60),m=n%60;return h?`${h}h ${m}m`:`${m} min`}
async function drawRoutes(){
 const joins=[];
 for(let i=0;i<SEGMENT_RANGES.length;i++){
  const[a,b]=SEGMENT_RANGES[i],seg=STOPS.filter(x=>x.n>=a&&x.n<=b);
  try{
   const {routes}=await RouteClass.computeRoutes({origin:{lat:seg[0].lat,lng:seg[0].lng},destination:{lat:seg.at(-1).lat,lng:seg.at(-1).lng},intermediates:seg.slice(1,-1).map(x=>({location:{lat:x.lat,lng:x.lng}})),travelMode:"WALKING",polylineQuality:"HIGH_QUALITY",fields:["path","distanceMeters","durationMillis"]});
   if(!routes?.length)throw Error("No route returned");
   const r=routes[0],polys=r.createPolylines({polylineOptions:{strokeColor:SEGMENT_COLORS[i],strokeOpacity:.9,strokeWeight:5,zIndex:20+i}});
   polys.forEach(p=>p.setMap(map));routePolylines[i]=polys;routeTotals.loaded++;routeTotals.distanceMeters+=r.distanceMeters||0;routeTotals.durationMillis+=r.durationMillis||0;
   document.querySelector(`#segmeta-${i}`).textContent=`${seg.filter(x=>S[x.n]).length}/${seg.length} visited · ${fmtDist(r.distanceMeters||0)} · ${fmtDur(r.durationMillis||0)}`
  }catch(e){console.error(e);routeTotals.failed++;const el=document.querySelector(`#segmeta-${i}`);el.textContent=el.textContent.replace("Google route loading…","Google route unavailable")}
  if(i<SEGMENT_RANGES.length-1)joins.push([seg.at(-1),STOPS.find(x=>x.n===SEGMENT_RANGES[i+1][0])])
 }
 connectorPolylines=joins.map(pair=>new google.maps.Polyline({map,path:pair.map(x=>({lat:x.lat,lng:x.lng})),strokeColor:"#8d8982",strokeOpacity:.35,strokeWeight:3,zIndex:8}));
 const s=document.createElement("div");s.className="google-route-summary";s.innerHTML=`<strong>Google route geometry</strong><span>${routeTotals.loaded}/5 districts loaded${routeTotals.loaded?` · ${fmtDist(routeTotals.distanceMeters)} · ${fmtDur(routeTotals.durationMillis)}`:""}${routeTotals.failed?` · ${routeTotals.failed} unavailable`:""}</span>`;document.querySelector(".overview-card").append(s)
}


/* This week's outings (from prep-data + claude-plan) on the same map. */
let planMarkers=[],planPolys=[],planActive=null;
function planSprees(){const P=window.PASSPORT_PREP;if(!P||!window.PLAN_GEO)return[];const st=window.PassportFlow.read(P.key,{});const sv=(st&&st.sprees)||{};return P.sprees.map(b=>{const s=sv[b.id]||{date:b.date,start:b.start,omitted:(b.omitted||[]).slice()};return{b,s,stops:b.stops.filter(x=>!(s.omitted||[]).includes(x.id)&&window.PLAN_GEO.stops[x.id]).map(x=>({...x,...window.PLAN_GEO.stops[x.id],r:window.FLOW_DATA.restaurants.find(r=>String(r.id)===x.id)}))};}).sort((a,b)=>a.s.date.localeCompare(b.s.date));}
function buildPlanRoutes(){
 const el=document.querySelector("#planRoutes");if(!el)return;const days=planSprees();if(!days.length){el.innerHTML='<span class="segment-meta">No outings loaded.</span>';return;}
 el.innerHTML=days.map(({b,s,stops})=>{const d=new Date(s.date+"T12:00:00").toLocaleDateString("en-CA",{weekday:"short",month:"short",day:"numeric"});return `<button type="button" class="segment-link plan-day" data-plan="${esc(b.id)}"><span><span class="segment-name">${esc(d)} · ${esc(b.name)}</span><span class="segment-meta" id="planmeta-${esc(b.id)}">${stops.length} stop${stops.length===1?"":"s"} from ${esc(window.PLAN_GEO.stations[b.station]?.short||b.station)} · arrive ${esc(s.start)}</span></span><span class="segment-arrow">›</span></button>`;}).join("")+`<a class="popup-link" href="${esc(window.PassportFlow.link("route.html"))}">Open the phone route pages</a>`;
 el.querySelectorAll("[data-plan]").forEach(btn=>btn.onclick=()=>showPlan(btn.dataset.plan));
}
function clearPlan(){planMarkers.forEach(m=>m.map=null);planMarkers=[];planPolys.forEach(p=>p.setMap(null));planPolys=[];planActive=null;document.querySelectorAll(".plan-day").forEach(b=>b.classList.remove("active"));}
async function showPlan(id){
 if(!map)return;const day=planSprees().find(d=>d.b.id===id);if(!day)return;clearPlan();planActive=id;document.querySelector(`[data-plan="${id}"]`)?.classList.add("active");
 markers.forEach(m=>m.map=null);routePolylines.flat().forEach(p=>p.setVisible(false));connectorPolylines.forEach(p=>p.setVisible(false));
 const st=window.PLAN_GEO.stations[day.b.station],an=day.b.anchor&&window.PLAN_GEO.stops[day.b.anchor.id]?[{...window.PLAN_GEO.stops[day.b.anchor.id],label:"★",title:day.b.anchor.label,r:window.FLOW_DATA.restaurants.find(r=>String(r.id)===day.b.anchor.id)}]:[],pts=[{lat:st.lat,lng:st.lng,label:"GO",title:day.b.station,station:true},...an,...day.stops.map((x,i)=>({...x,label:String(i+1),title:x.r?x.r.name:x.id}))];
 pts.forEach(p=>{const m=new AdvancedMarkerElement({map,position:{lat:p.lat,lng:p.lng},title:p.title,gmpClickable:true});const d=document.createElement("div");d.className="stop-marker "+(p.station?"visited":"unvisited")+" plan-marker";d.textContent=p.label;m.append(d);m.addEventListener("gmp-click",()=>{const r=p.r;infoWindow.setContent(r?`${window.PassportFlow.badges(r)}<div class="popup-name">${esc(r.name)}</div><div class="popup-address">${esc(r.address)}</div><a class="popup-link" href="${esc(window.PassportFlow.link("route.html",{day:id}))}">Open this route</a>`:`<div class="popup-name">${esc(p.title)}</div>`);infoWindow.open({map,anchor:m});});planMarkers.push(m);});
 const bb=new google.maps.LatLngBounds();pts.forEach(p=>bb.extend({lat:p.lat,lng:p.lng}));map.fitBounds(bb,64);
 const meta=document.querySelector(`#planmeta-${id}`);
 if(pts.length<2){if(meta)meta.textContent="Online-first: no walking legs today.";return;}
 try{
  const {routes}=await RouteClass.computeRoutes({origin:{lat:pts[0].lat,lng:pts[0].lng},destination:{lat:pts.at(-1).lat,lng:pts.at(-1).lng},intermediates:pts.slice(1,-1).map(x=>({location:{lat:x.lat,lng:x.lng}})),travelMode:"WALKING",polylineQuality:"HIGH_QUALITY",fields:["path","distanceMeters","durationMillis"]});
  if(!routes?.length)throw Error("No route");const r=routes[0];const polys=r.createPolylines({polylineOptions:{strokeColor:"#7a2f2f",strokeOpacity:.95,strokeWeight:5,zIndex:40}});polys.forEach(p=>p.setMap(map));planPolys=polys;
  if(meta)meta.textContent=`${day.stops.length} stop${day.stops.length===1?"":"s"} · Google walking ${fmtDist(r.distanceMeters||0)} · ${fmtDur(r.durationMillis||0)} (station → last stop)`;
 }catch(e){console.error(e);if(meta)meta.textContent="Google walking route unavailable — use the phone route page links.";}
}

function applyInitialFocus(){
 const params=new URLSearchParams(location.search);
 const stop=params.get("focusStop"),district=params.get("focusDistrict");
 if(stop){
   const x=STOPS.find(s=>String(s.n)===String(stop));
   const m=markers.find(m=>String(m.stop.n)===String(stop));
   if(x&&m){
     map.setCenter({lat:x.lat,lng:x.lng});map.setZoom(16);
     infoWindow.setContent(popup(x));infoWindow.open({map,anchor:m});
     return;
   }
 }
 if(district!==null&&district!==""){
   activeDistrict=String(district);
   const sel=document.querySelector("#districtFilter");if(sel)sel.value=activeDistrict;
   applyFilters();
 }
}

function showError(msg){document.querySelector("#map").innerHTML=`<div class="map-error"><strong>Google Maps couldn't load.</strong><span>${esc(msg)}</span><span>Check the browser key's website restriction and that Maps JavaScript API + Routes API are enabled.</span></div>`}
window.gm_authFailure=()=>setTimeout(()=>{if(capturedMapError)renderMapDiagnostic(capturedMapError);else renderMapDiagnostic("AuthenticationError","Google rejected this key. If no specific code appears, verify the website restriction, Maps JavaScript API, Routes API, and billing for the key's project.")},250);
window.initGooglePortal=async()=>{
 try{
  if(coordMatches.length!==42)throw Error("Could not read all 42 route coordinates.");
  const [{Map},{AdvancedMarkerElement:AME},{Route}]=await Promise.all([google.maps.importLibrary("maps"),google.maps.importLibrary("marker"),google.maps.importLibrary("routes")]);
  AdvancedMarkerElement=AME;RouteClass=Route;document.querySelector("#map").innerHTML="";
  map=new Map(document.querySelector("#map"),{center:{lat:43.657,lng:-79.407},zoom:13,mapId:"DEMO_MAP_ID",mapTypeControl:false,streetViewControl:false,fullscreenControl:true,gestureHandling:"greedy"});
  infoWindow=new google.maps.InfoWindow();
  markers=STOPS.map(x=>{const m=new AdvancedMarkerElement({map,position:{lat:x.lat,lng:x.lng},title:`${x.n}. ${x.r}`,gmpClickable:true});m.append(markerEl(x));m.stop=x;m.addEventListener("gmp-click",()=>{infoWindow.setContent(popup(x));infoWindow.open({map,anchor:m})});return m});
  fitFull();await drawRoutes();applyInitialFocus();const pr=new URLSearchParams(location.search).get('planRoute');if(pr)showPlan(pr)
 }catch(e){console.error(e);showError(e?.message||"Unknown Google Maps error")}
};
function loadGoogle(){
 const key=window.TORONTO42_GOOGLE_MAPS_API_KEY;if(!key){showError("google-config.js does not contain the expected browser key variable.");return}
 const s=document.createElement("script");s.async=true;s.defer=true;s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&v=weekly&loading=async&callback=initGooglePortal";s.onerror=()=>showError("The Google Maps JavaScript API script could not be loaded.");document.head.append(s)
}
buildFilters();buildProgress();buildSegments();buildPlanRoutes();buildNext();buildDistricts();buildUnexpected();const todayMap=document.querySelector('#todayMap');if(todayMap)todayMap.href=previewUrl('today.html');loadGoogle();window.addEventListener("storage",()=>location.reload());