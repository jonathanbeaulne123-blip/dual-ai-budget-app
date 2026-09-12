import { WrappedFriendshipBracelets } from "./SceneArtwork.tsx";
import { useState, type CSSProperties } from "react";
import { useAppearance, useAtmosphereVisibility } from "./ThemeProvider.tsx";
import { Crystal, Heart, Sprig } from "./LivingArtwork.tsx";
import { DesktopHomeScenery } from "./DesktopHomeScenery.tsx";
import { CalendarOrnament, CalendarScenery } from "./CalendarArtwork.tsx";
import { PlanOrnament, PlanScenery } from "./PlanArtwork.tsx";
import { BooksOrnament, BooksScenery } from "./BooksArtwork.tsx";
import { MoreOrnament, MoreScenery } from "./MoreArtwork.tsx";
import type { SceneRoute } from "./scenes.ts";

export const REFINED_PAGES: readonly SceneRoute[] = ["home", "calendar", "plan", "more", "ledger"];
export const ERA_LIGHTS: Record<string,string> = {
  lover:"#ef83c2",showgirl:"#ff792d",fearless:"#efc55a",debut:"#62c6cf",red:"#e05562",
  midnights:"#739be6",reputation:"#cedbd0",poets:"#dfd5c6","1989":"#8ac9f1",
  "speak-now":"#bd8eec",evermore:"#dd9c62",folklore:"#c7cfbc",
};
export function EraBracelet() {
  const {scene}=useAppearance();
  if(scene.theme!=="taylor") return null;
  return <span className="era-light" role="img" aria-label={`${scene.title} concert light-up bracelet`} style={{"--era-light":ERA_LIGHTS[scene.id]??"var(--theme-accent)"} as CSSProperties}>
    <svg viewBox="0 0 150 80" aria-hidden="true" focusable="false"><ellipse cx="75" cy="43" rx="58" ry="23" fill="none" stroke="#d8ded9" strokeWidth="12"/><path d="M24 34Q75 0 126 34" fill="none" stroke="#fffaf1" strokeWidth="12"/><rect className="era-light-module" x="52" y="9" width="46" height="35" rx="10"/><path d="M60 16H90M60 21H90" stroke="#fff" opacity=".65" strokeWidth="2"/><circle cx="39" cy="58" r="2" fill="#8c9993"/></svg>
  </span>;
}
function MarginMotif({index,page}:{index:number;page:SceneRoute}) {
  const {scene}=useAppearance();
  const ref=useAtmosphereVisibility();
  return <div ref={ref} className={"world-margin world-margin-"+index}><svg viewBox="0 0 150 200" focusable="false">
    {page==="ledger"?<BooksOrnament scene={scene}/>:page==="more"?<MoreOrnament scene={scene}/>:page==="plan"?<PlanOrnament scene={scene}/>:page==="calendar"?<CalendarOrnament scene={scene}/>:scene.theme==="taylor"?(scene.id==="showgirl"?<Crystal/>:<Heart/>):<Sprig flowers={scene.theme==="newfoundland"}/>}
  </svg></div>;
}
export function PageWorld({page}:{page:SceneRoute}) {
  const {scene}=useAppearance();
  const ref=useAtmosphereVisibility();
  if(!REFINED_PAGES.includes(page)) return null;
  return <aside ref={ref} className="page-world-art" aria-hidden="true" data-world-page={page}>
    <div className="background-keepsake" aria-hidden="true"><WrappedFriendshipBracelets page={page} scene={scene}/><EraBracelet/></div>
    {[0,1,2,3].map(i=><MarginMotif key={i} index={i} page={page}/>)}
    {page==="ledger"?<BooksScenery/>:page==="more"?<MoreScenery/>:page==="home"?<DesktopHomeScenery/>:page==="plan"?<PlanScenery/>:<CalendarScenery/>}<div className="world-light-wash"/><div className="world-paper-grain"/>
  </aside>;
}
export function WorldCharm({page}:{page:SceneRoute}) {
  const {scene,paused}=useAppearance();
  const [moving,setMoving]=useState(false);
  const ref=useAtmosphereVisibility();
  if(!REFINED_PAGES.includes(page)) return null;
  const kind=page==="ledger"?"books":page==="more"?"more":page==="plan"?"plan":page==="calendar"?"calendar":scene.theme==="taylor"?(scene.id==="showgirl"?"crystal":"heart"):scene.id==="jellybean"?"knocker":"leaf";
  const labels={books:"Give the Books charm a little sway",more:"Give the keepsake charm a little sway",plan:"Give the planning charm a little sway",calendar:"Give the calendar charm a little sway",crystal:"Catch the light",heart:"Swing the heart charm",knocker:"Tap the little door knocker",leaf:"Give the leaf a little bounce"};
  return <section ref={ref} className="world-charm-row" aria-label="Little details">
    <span className="world-thread" aria-hidden="true"/>
    <button type="button" className="world-charm" aria-label={labels[kind]} data-moving={!paused&&moving||undefined} onClick={()=>{if(!paused)setMoving(v=>!v);}} onAnimationEnd={()=>setMoving(false)}>
      <svg viewBox="0 0 100 120" aria-hidden="true" focusable="false">
        {kind==="books"?<g transform="scale(.64)"><BooksOrnament scene={scene}/></g>:kind==="more"?<g transform="scale(.64)"><MoreOrnament scene={scene}/></g>:kind==="plan"?<g transform="scale(.64)"><PlanOrnament scene={scene}/></g>:kind==="calendar"?<g transform="scale(.64)"><CalendarOrnament scene={scene}/></g>:kind==="crystal"?<Crystal/>:kind==="heart"?<Heart/>:kind==="knocker"?<><rect x="20" y="6" width="60" height="100" rx="2" fill="#edc744" stroke="#fff9e4" strokeWidth="7"/><circle cx="50" cy="47" r="6" fill="#665135"/><ellipse cx="50" cy="65" rx="15" ry="19" fill="none" stroke="#957132" strokeWidth="6"/></>:<g transform="scale(.66) translate(20 0)"><Sprig/></g>}
      </svg>
    </button>
    <span className="world-thread" aria-hidden="true"/>
  </section>;
}
