import { useState, type CSSProperties } from "react";
import { useAppearance, useAtmosphereVisibility } from "./ThemeProvider.tsx";
import { Crystal, Heart, Sprig } from "./LivingArtwork.tsx";
import { DesktopHomeScenery } from "./DesktopHomeScenery.tsx";
import type { SceneRoute } from "./scenes.ts";

export const REFINED_PAGES: readonly SceneRoute[] = ["home"];
export const ERA_LIGHTS: Record<string,string> = {
  lover:"#ef83c2",showgirl:"#ff792d",fearless:"#efc55a",debut:"#65caa3",red:"#e05562",
  midnights:"#739be6",reputation:"#cedbd0",poets:"#dfd5c6","1989":"#8ac9f1",
  "speak-now":"#bd8eec",evermore:"#dd9c62",folklore:"#c7cfbc",
};
export function EraBracelet({ allThemes = false }: { allThemes?: boolean }) {
  const {scene}=useAppearance();
  if(scene.theme!=="taylor" && !allThemes) return null;
  return <span className="era-light" role="img" aria-label={scene.title+(scene.theme==="taylor"?" concert light-up bracelet":" illustrated light-up bracelet")} style={{"--era-light":ERA_LIGHTS[scene.id]??"var(--theme-accent)"} as CSSProperties}>
    <svg viewBox="0 0 150 80" aria-hidden="true" focusable="false"><ellipse cx="75" cy="43" rx="58" ry="23" fill="none" stroke="#d8ded9" strokeWidth="12"/><path d="M24 34Q75 0 126 34" fill="none" stroke="#fffaf1" strokeWidth="12"/><rect className="era-light-module" x="52" y="9" width="46" height="35" rx="10"/><path d="M60 16H90M60 21H90" stroke="#fff" opacity=".65" strokeWidth="2"/><circle cx="39" cy="58" r="2" fill="#8c9993"/></svg>
  </span>;
}
function MarginMotif({index}:{index:number}) {
  const {scene}=useAppearance();
  const ref=useAtmosphereVisibility();
  return <div ref={ref} className={"world-margin world-margin-"+index}><svg viewBox="0 0 150 200" focusable="false">
    {scene.theme==="taylor"?(scene.id==="showgirl"?<Crystal/>:<Heart/>):<Sprig flowers={scene.theme==="newfoundland"}/>}
  </svg></div>;
}
export function PageWorld({page}:{page:SceneRoute}) {
  const ref=useAtmosphereVisibility();
  if(!REFINED_PAGES.includes(page)) return null;
  return <aside ref={ref} className="page-world-art" aria-hidden="true" data-world-page={page}>
    {[0,1,2,3].map(i=><MarginMotif key={i} index={i}/>)}
    <DesktopHomeScenery/><div className="world-light-wash"/><div className="world-paper-grain"/>
  </aside>;
}
export function WorldCharm({page}:{page:SceneRoute}) {
  const {scene,paused}=useAppearance();
  const [moving,setMoving]=useState(false);
  const ref=useAtmosphereVisibility();
  if(!REFINED_PAGES.includes(page)) return null;
  const kind=scene.theme==="taylor"?(scene.id==="showgirl"?"crystal":"heart"):scene.id==="jellybean"?"knocker":"leaf";
  const labels={crystal:"Catch the light",heart:"Swing the heart charm",knocker:"Tap the little door knocker",leaf:"Give the leaf a little bounce"};
  return <section ref={ref} className="world-charm-row" aria-label="Little details">
    <span className="world-thread" aria-hidden="true"/>
    <button type="button" className="world-charm" aria-label={labels[kind]} data-moving={!paused&&moving||undefined} onClick={()=>{if(!paused)setMoving(v=>!v);}} onAnimationEnd={()=>setMoving(false)}>
      <svg viewBox="0 0 100 120" aria-hidden="true" focusable="false">
        {kind==="crystal"?<Crystal/>:kind==="heart"?<Heart/>:kind==="knocker"?<><rect x="20" y="6" width="60" height="100" rx="2" fill="#edc744" stroke="#fff9e4" strokeWidth="7"/><circle cx="50" cy="47" r="6" fill="#665135"/><ellipse cx="50" cy="65" rx="15" ry="19" fill="none" stroke="#957132" strokeWidth="6"/></>:<g transform="scale(.66) translate(20 0)"><Sprig/></g>}
      </svg>
    </button>
    <span className="world-thread" aria-hidden="true"/>
  </section>;
}
