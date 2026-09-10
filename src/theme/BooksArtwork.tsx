import { useId } from 'react';
import type { ThemeScene } from './scenes.ts';
import { useAppearance, useAtmosphereVisibility } from './ThemeProvider.tsx';

/** One setting per world. Asset prompts and references live beside the page handoff. */
export function booksSceneAsset(scene: ThemeScene) {
  return scene.theme === 'classic' ? 'classic' : scene.id;
}
function SceneImage({ scene }: { scene: ThemeScene }) {
  const name = `${booksSceneAsset(scene)}-cartoon`;
  return <img src={`/art/books/${name}.webp`} srcSet={`/art/books/${name}-phone.webp 768w, /art/books/${name}.webp 1536w`} sizes="100vw" alt="" width="1536" height="1024" decoding="async" />;
}

/** The small interactive keepsake is an embossed seal, not a second scene illustration. */
export function BooksOrnament({ scene }: { scene: ThemeScene }) {
  const id = useId().replaceAll(':', '');
  const dark = scene.id === 'reputation';
  const colour = dark ? '#967237' : scene.id === 'harbour' ? '#477a80' : scene.id === 'merchant' ? '#8b613e' : scene.id === 'poets' ? '#766557' : '#728061';
  return <g>
    <defs><radialGradient id={id}><stop stopColor={dark ? '#e4c17b' : '#e4d7b5'}/><stop offset=".68" stopColor={colour}/><stop offset="1" stopColor={dark ? '#604627' : '#555344'}/></radialGradient></defs>
    <path d="M44 13L56 18 70 15 80 25 95 28 97 44 106 55 101 70 103 86 89 93 81 107 65 105 52 111 39 101 24 99 20 84 9 72 14 57 11 41 25 33 31 19Z" fill={`url(#${id})`} stroke="#514634" strokeWidth="1.5"/>
    <circle cx="57" cy="62" r="34" fill="none" stroke="#f1e4c3" strokeOpacity=".65" strokeWidth="1.4"/><circle cx="57" cy="62" r="29" fill="none" stroke="#433e32" strokeOpacity=".5"/>
    {scene.id === 'harbour' ? <g fill="none" stroke="#efe8d1" strokeWidth="2"><path d="M57 39V81M42 70Q57 93 72 70M40 68l2 9 8-4m24-5-2 9-8-4M45 51H69"/><circle cx="57" cy="38" r="4"/></g> : scene.id === 'merchant' ? <g stroke="#efe8d1" fill="none" strokeWidth="2"><path d="M42 41V58q6 8 12 0V41M48 41V82M71 41q-13 16 0 24V82"/></g> : <g stroke="#eee3c9" fill="none" strokeWidth="2"><path d="M37 42q10-4 20 3 10-7 20-3V79q-10-4-20 3-10-7-20-3ZM57 46V78M42 53h9m-9 8h9m12-8h9m-9 8h9"/></g>}
  </g>;
}

function AtmospherePanel({ index }: { index: number }) {
  const { scene } = useAppearance();
  const ref = useAtmosphereVisibility();
  return <div ref={ref} className={`books-scenery-panel books-atmosphere-${index}`} style={{ top: `${24 + index * 27}%` }}>
    {scene.id === 'harbour' ? <svg viewBox="0 0 1600 280" focusable="false"><g className="books-water" fill="none" stroke="#eff6ef" strokeWidth="2" opacity=".3"><path d="M0 65q50-8 100 0t100 0M20 87q52-6 105 0M0 132q80-8 158 0M1400 73q75-8 150 0M1450 98q75-6 150 0M1425 145q90-8 180 0"/></g></svg> : <>
      <div className="books-lamplight books-lamplight-left"/><div className="books-lamplight books-lamplight-right"/>
      {scene.id !== 'reputation' && <svg viewBox="0 0 1600 280" focusable="false"><g className="books-steam" fill="none" stroke="#fff9eb" strokeWidth="2" opacity=".28"><path d="M1490 215c-18-28 18-48 1-75s9-38 0-61M1510 205c16-22-12-39 0-61"/></g></svg>}
    </>}
  </div>;
}
export function BooksScenery() {
  const { scene } = useAppearance();
  return <div className="books-scenery">
    <div className="books-scene-viewport"><SceneImage scene={scene}/><div className="books-scene-shade"/></div>
    {[0, 1, 2].map(index => <AtmospherePanel key={index} index={index}/>)}
  </div>;
}
export function BooksHeadingArtwork({ scene }: { scene: ThemeScene }) {
  return <><div className="books-heading-art" aria-hidden="true"><SceneImage scene={scene}/></div>{scene.id === 'merchant' && <div className="books-dinner-detail" aria-hidden="true"><SceneImage scene={scene}/></div>}</>;
}
export function BooksDivider() {
  const { scene } = useAppearance();
  const ref = useAtmosphereVisibility();
  return <div ref={ref} className="books-divider" aria-hidden="true"><span/><svg viewBox="0 0 115 120" focusable="false"><BooksOrnament scene={scene}/></svg><span/></div>;
}
