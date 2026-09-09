import { useAppearance, useAtmosphereVisibility } from "./ThemeProvider.tsx";
import { Feather, Heart, RowHouse, Sprig } from "./LivingArtwork.tsx";

/** Wide compositions leave the centre open for the existing ledger instruments. */
function SceneryPanel({ index }: { index: number }) {
  const { scene } = useAppearance();
  const ref = useAtmosphereVisibility();
  return <div ref={ref} className={`desktop-scenery-panel desktop-scenery-panel-${index}`}>
    <svg viewBox="0 0 1600 680" preserveAspectRatio="none" focusable="false">
      {scene.id === "showgirl" ? <>
        <path d="M-30 0Q210 170 58 340T80 710M1620-30Q1400 150 1538 350T1510 720" fill="none" stroke="#e96620" strokeWidth="42" opacity=".7"/>
        {Array.from({ length: 16 }, (_, i) => <g key={i} transform={`translate(${i % 2 ? 1480 : -34} ${i * 43 - 35}) rotate(${i % 2 ? -40 : 32}) scale(.9)`}><Feather /></g>)}
        <path d="M130 598Q800 712 1470 598" fill="none" stroke="#ca956a" strokeWidth="2"/>
        {Array.from({ length: 17 }, (_, i) => <g key={i} transform={`translate(${160 + i * 80} ${611 + 35 * Math.sin(i / 16 * Math.PI)})`}><circle r="12" fill="#f8d695" opacity=".35"/><circle r="6" fill="#fffcda" stroke="#d0a775" strokeWidth="2"/></g>)}
      </> : scene.id === "lover" ? <>
        <g className="living-clouds" opacity=".7"><path d="M-30 80Q35 0 112 67Q212-35 290 73Q374 41 422 137Q539 111 590 202Q188 146-30 244Z" fill="#f3c7e6"/><path d="M1040 430Q1080 327 1181 376Q1247 266 1353 350Q1460 286 1513 383Q1600 323 1650 411V640Q1350 501 1040 548Z" fill="#bdddf5"/><path d="M-40 484Q62 390 174 453Q287 389 394 494Q528 438 630 555Q283 529-40 660Z" fill="#d6c8ec"/></g>
        <path className="living-ribbon" d="M35 215Q198 292 58 358T92 574M1550 55Q1415 150 1558 242" fill="none" stroke="#fff8ed" strokeWidth="5" opacity=".85"/>
        <g transform="translate(24 276) scale(.8)"><Heart /></g><g transform="translate(1460 105) scale(.7)"><Heart /></g>
        {[[120,170],[1490,510],[75,592],[1390,71]].map(([x,y], i) => <path key={i} d={`M${x} ${(y ?? 0)-9}v18m-9-9h18`} stroke="#fffaf2" strokeWidth="3"/>)}
      </> : scene.id === "jellybean" ? <>
        <g className="living-clouds" fill="#fffdf0" opacity=".8"><path d="M0 95Q38 8 99 63Q155 0 220 75Q290 50 340 120H0Z"/><path d="M1220 198Q1280 108 1346 155Q1421 73 1500 151Q1560 122 1600 170V230Z"/></g>
        <path d="M0 555L165 476 395 635 1600 648V680H0Z" fill="#e6dac1" opacity=".6"/>
        <g transform="translate(-27 235)"><RowHouse width={92} height={282} colour="#294d60"/><RowHouse x={95} y={43} width={82} height={239}/></g>
        <g transform="translate(1455 339)"><RowHouse width={89} height={234} colour="#bb3e5d"/><RowHouse x={92} y={-46} width={80} height={280} colour="#49b5ad"/></g>
        <path d="M0 163Q106 216 207 170M1400 225Q1510 276 1600 239" fill="none" stroke="#56717a" strokeWidth="2"/>
        <g transform="translate(18 505) scale(.9)"><Sprig flowers/></g><g transform="translate(1450 524) scale(.9)"><Sprig flowers/></g>
      </> : scene.id === "quidi-vidi" ? <>
        <path d="M0 267L90 195 176 278 249 265 353 420 0 447ZM1270 478L1400 284 1480 315 1560 245 1600 280V560Z" fill="#799e7e" opacity=".35"/>
        <path d="M0 511Q220 429 384 516T809 557T1250 522T1600 545V680H0Z" fill="#a5d6cf" opacity=".48"/>
        <g className="living-water" stroke="#fffbea" strokeWidth="3" fill="none"><path d="M0 581q50-12 100 0t100 0M22 611q55-12 110 0t110 0M1340 598q55-12 110 0t110 0M1380 630q55-12 110 0t110 0"/></g>
        <g transform="translate(-8 360)"><RowHouse colour="#bb687e" width={92} height={153}/><RowHouse x={96} y={27} width={79} height={126}/></g>
        <g transform="translate(1470 387)"><RowHouse colour="#568f7d" width={100} height={148}/></g>
        <path d="M1410 557q50 30 106 0l-12 28h-79Z" fill="#fffbea" stroke="#6b9890" strokeWidth="2"/><path d="M1463 557v-65m0 8l33 51h-33" fill="#e5c58a" stroke="#a69c7c" strokeWidth="2"/>
        <g transform="translate(28 556) scale(.8)"><Sprig /></g>
      </> : null}
    </svg>
  </div>;
}
export function DesktopHomeScenery() {
  const { scene } = useAppearance();
  if (scene.theme === "classic") return null;
  return <div className="desktop-home-scenery">{[0,1,2].map(index => <SceneryPanel key={index} index={index}/>)}</div>;
}
