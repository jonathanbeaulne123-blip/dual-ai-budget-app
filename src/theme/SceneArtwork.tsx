import { useEffect, useId, useRef, useState } from "react";
import { BooksHeadingArtwork } from "./BooksArtwork.tsx";
import { MoreHeadingArtwork } from "./MoreArtwork.tsx";
import { PlanHeadingArtwork } from "./PlanArtwork.tsx";
import { CalendarHeadingArtwork } from "./CalendarArtwork.tsx";
import { HomeArtwork } from "./LivingArtwork.tsx";
import { EraBracelet } from "./PageWorld.tsx";
import { MEMORABILIA } from "./memorabilia.ts";
import type { SceneRoute, ThemeScene } from "./scenes.ts";
import { useAppearance } from "./ThemeProvider.tsx";
import { AtmosphereControl } from "./AppearancePicker.tsx";

/** Original vector illustration. Coordinates describe art, never money or progress. */
function House({ x, y, color, height = 105, width = 64 }: { x: number; y: number; color: string; height?: number; width?: number }) {
  return <g transform={`translate(${x} ${y})`} className="scene-house">
    <path d={`M-5 0 L${width / 2} -24 L${width + 5} 0 Z`} fill="var(--theme-second)" />
    <path d={`M0 0 H${width} V${height} H0 Z`} fill={color} />
    {[15, 31, 47, 63, 79, 95].filter(line => line < height).map(line => <path key={line} d={`M0 ${line} H${width}`} stroke="white" strokeOpacity=".18" />)}
    <rect x="10" y="15" width="17" height="25" rx="1" fill="#fff1c4" stroke="#fdf5e7" strokeWidth="4" />
    <rect x={width - 27} y="15" width="17" height="25" rx="1" fill="#fff1c4" stroke="#fdf5e7" strokeWidth="4" />
    <path d={`M18.5 15 V40 M10 27 H27 M${width - 18.5} 15 V40 M${width - 27} 27 H${width - 10}`} stroke="var(--theme-second)" strokeWidth="1.5" />
    <rect x={width / 2 - 10} y={height - 39} width="20" height="39" fill="var(--theme-second)" stroke="#fdf5e7" strokeWidth="3" />
    <circle cx={width / 2 + 5} cy={height - 16} r="1.6" fill="#e9c776" />
  </g>;
}
function Tower({ x, y, lighthouse = false }: { x: number; y: number; lighthouse?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    {lighthouse ? <><path d="M-24 100 L-16 12 H16 L24 100 Z" fill="#fbf5e8" stroke="#596d75" strokeWidth="2" /><path d="M-22 12 H22 V-5 H-22 Z M-25 -5 L0 -24 L25 -5 Z" fill="#ac5545" /><rect x="-12" y="-1" width="24" height="11" fill="#ffe8a6" /><path d="M-6 100 V75 H6 V100" fill="#526775" /><path className="scene-beacon" d="M-12 4 L-150 -20 L-150 28 Z M12 4 L160 -20 L160 28 Z" fill="#ffe8a6" opacity=".22" /></>
      : <><path d="M-28 100 V16 H-35 V-1 H-23 V8 H-9 V-1 H3 V8 H17 V-1 H30 V16 H23 V100 Z" fill="#947b65" stroke="#665b50" strokeWidth="2" /><path d="M-6 100 V75 Q0 62 8 75 V100" fill="#4f5551" /><path d="M-8 36 V24 H2 V36 M9 57 V45 H18 V57" stroke="#ded2b8" strokeWidth="5" /><path d="M0 -1 V-43" stroke="#62574c" strokeWidth="2" /><path className="scene-flag" d="M0 -42 Q17 -51 32 -39 L26 -25 Q13 -35 0 -28Z" fill="var(--theme-accent)" /></>}
  </g>;
}
function Ocean() {
  return <g className="scene-ocean"><path d="M0 172 Q150 150 320 179 T670 175 T1000 160 V280 H0Z" fill="var(--theme-second)" opacity=".3" />
    {[194, 217, 241].map((y, i) => <path key={y} className={`scene-wave scene-wave-${i}`} d={`M-100 ${y} q70 -12 140 0 t140 0 t140 0 t140 0 t140 0 t140 0 t140 0 t140 0`} fill="none" stroke="var(--card)" strokeWidth={2 - i * .3} opacity=".55" />)}</g>;
}
function NewfoundlandArt({ scene }: { scene: ThemeScene }) {
  const motif = scene.motif;
  if (motif === "jag" || motif === "music") return <>
    <path d="M0 0 H1000 V280 H0Z" fill="var(--theme-second)" opacity=".10" />
    <g className="scene-jag-pattern" stroke="var(--theme-accent)" fill="none" strokeWidth="1.4" opacity=".45">
      {Array.from({ length: 12 }, (_, i) => <g key={i} transform={`translate(${i * 84} 0)`}>{[0, 70, 140, 210].map(y => <g key={y} transform={`translate(0 ${y})`}><path d="M42 0 L82 35 L42 70 L2 35 Z M42 0 V70 M2 35 H82 M2 35 L42 15 L82 35 L42 55 Z" /></g>)}</g>)}
    </g>
    <path d="M0 230 H1000 V280 H0Z" fill="var(--ink)" opacity=".13" />
    <g transform="translate(720 35)"><rect width="125" height="157" fill="var(--ink)" stroke="var(--theme-accent)" strokeWidth="8" /><rect x="13" y="14" width="99" height="127" fill="var(--paper)" />
      <circle cx="62" cy="74" r="39" fill="var(--theme-second)" /><circle cx="62" cy="74" r="15" fill="var(--theme-accent)" /><circle cx="62" cy="74" r="3" fill="var(--paper)" /><path d="M42 36 Q78 21 94 61" stroke="var(--card)" fill="none" opacity=".6" /></g>
    <g transform="translate(870 166)"><path d="M0 28 Q-8 -28 15 -26 H68 Q90 -20 80 28Z" fill="var(--theme-accent)" /><path d="M7 28 V69 M72 28 V69" stroke="var(--ink)" strokeWidth="7" /><path d="M1 29 H81" stroke="var(--paper)" strokeWidth="4" /></g>
    {motif === "music" && <g transform="translate(90 124)">
      <rect x="-25" y="72" width="248" height="12" rx="3" fill="var(--ink)" />
      <path d="M-10 84V139 M198 84V139" stroke="var(--ink)" strokeWidth="8" />
      <rect width="186" height="72" rx="6" fill="var(--theme-second)" />
      <ellipse cx="69" cy="32" rx="48" ry="23" fill="var(--ink)" /><ellipse cx="69" cy="32" rx="16" ry="8" fill="var(--theme-accent)" />
      <path d="M156 12 L143 50 L101 38" stroke="var(--card)" strokeWidth="4" fill="none" />
      <circle cx="163" cy="57" r="4" fill="var(--card)" />
    </g>}
    <path className="scene-metal-light" d="M80 -20 L160 -20 L370 280 L290 280Z" fill="var(--card)" opacity=".08" />
  </>;
  return <>
    <g className="scene-clouds" fill="var(--card)" opacity=".7"><path d="M38 65 Q36 41 64 43 Q83 6 116 41 Q143 28 159 60Z" /><path d="M680 54 Q700 17 725 40 Q747 18 765 48 Q790 43 802 61Z" /></g>
    <Ocean />
    {motif === "tower" ? <>
      <path d="M0 280 Q250 204 470 221 Q730 195 1000 237 V280Z" fill="#849776" />
      <path d="M510 280 Q700 225 790 233 L1000 260 V280Z" fill="#b0ac94" />
      <Tower x={812} y={62} />
      <path className="scene-grass" d="M700 256 q-17 -38 -10 -50 M712 260 q-2 -47 15 -59 M945 255 q-15 -43 -1 -60 M960 264 q-3 -47 17 -55" stroke="var(--theme-second)" strokeWidth="3" fill="none" />
      <path className="scene-gulls" d="M126 99q15 -14 30 0q15 -14 30 0 M195 75q10 -9 20 0q10 -9 20 0" stroke="var(--theme-second)" fill="none" strokeWidth="2" />
    </> : motif === "trail" ? <>
      <path d="M380 280 Q570 172 680 106 Q744 76 809 109 L1000 172 V280Z" fill="#8e9b77" />
      <path d="M440 280 L635 175 L682 137 L730 125 L709 158 L761 168 L705 196 L770 206 L830 280Z" fill="#b3ae94" />
      <path d="M520 279 Q640 219 704 186 Q750 169 706 155 Q674 143 737 115" stroke="#faf0cf" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M0 280 L92 235 L175 251 L265 174 L345 204 L420 181 L470 280Z" fill="var(--theme-second)" opacity=".65" />
      <Tower x={777} y={42} />
      <g fill="var(--theme-accent)">{[[558, 235], [650, 195], [706, 160]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`}><path d="M0 5 V-11 H18 L23 -6 L18 -1 H0" stroke="var(--ink)" strokeWidth="1" /></g>)}</g>
      <path className="scene-grass" d="M875 233 q-15 -29 -8 -37 M881 239 q-3 -31 13 -39 M907 248 q-8 -27 2 -38" stroke="var(--theme-second)" fill="none" strokeWidth="3" />
    </> : motif === "lighthouse" ? <>
      <circle className="scene-sun" cx="626" cy="137" r="39" fill="#e9b497" opacity=".8" />
      <path d="M0 280 Q80 198 219 198 L321 163 L418 189 L472 280Z" fill="#829587" /><path d="M0 264 L175 245 L238 216 L311 228 L413 216 L451 280Z" fill="#8b8884" />
      <Tower x={282} y={63} lighthouse /><path className="scene-gulls" d="M804 99 q12 -12 24 0 q12 -12 24 0 M856 68 q10 -10 20 0 q10 -10 20 0" stroke="var(--ink)" fill="none" strokeWidth="2" />
    </> : motif === "harbour" ? <>
      <path d="M0 206 H1000" stroke="var(--theme-accent)" strokeWidth="7" />{[55, 220, 710, 940].map(x => <path key={x} d={`M${x} 188 V270`} stroke="var(--theme-accent)" strokeWidth="12" />)}
      <g className="scene-boat" transform="translate(780 179)"><path d="M-47 0 H74 L55 33 H-24Z" fill="var(--theme-accent)" /><path d="M-5 0 V-36 H34 V0 M15 -36 V-61" stroke="var(--ink)" fill="var(--card)" strokeWidth="3" /><path d="M-27 11 H57" stroke="var(--card)" strokeWidth="3" /></g>
      <House x={89} y={109} height={89} color="#bb7251" /><House x={162} y={125} height={73} color="#778d81" />
    </> : motif === "rain" || motif === "street" || motif === "shop" ? <>
      <path d="M0 246 H1000 V280 H0Z" fill="var(--ink)" opacity=".13" />
      <House x={625} y={104} height={143} width={83} color="#8b6358" /><House x={717} y={123} height={124} width={80} color="#5d8684" /><House x={806} y={99} height={148} width={88} color="#947847" />
      <path d="M618 167 H710 L704 185 H624 Z" fill="var(--theme-accent)" /><path d="M816 152 H884 V188 H816Z" stroke="var(--theme-accent)" strokeWidth="4" fill="var(--paper)" />
      <path d="M577 246 V90 Q577 77 561 77 H553" stroke="var(--ink)" strokeWidth="5" fill="none" /><path d="M540 89 L545 71 H563 L568 89Z" fill="#f2d086" />
      <path className="scene-lamplight" d="M545 89 L481 246 H626 L563 89Z" fill="#f6d490" opacity=".15" />
      {motif === "rain" && <g className="scene-rain" stroke="var(--theme-second)" strokeWidth="1.2" opacity=".36">{Array.from({ length: 32 }, (_, i) => <path key={i} d={`M${i * 33} ${(i % 5) * 37} l-12 35`} />)}</g>}
      {motif === "shop" && <g transform="translate(75 153)"><rect width="112" height="99" rx="3" fill="var(--card)" transform="rotate(-8)" /><path d="M10 19 H75 M10 30 H65 M10 41 H76 M10 63 H57" stroke="var(--theme-accent)" strokeWidth="2" transform="rotate(-8)" /></g>}
    </> : <>
      <path d="M0 260 Q150 205 290 229 Q420 249 563 221 T1000 235 V280 H0Z" fill="var(--theme-second)" opacity=".35" />
      {(motif === "battery" ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5]).map((n) => <House key={n} x={540 + n * 73} y={motif === "battery" ? 165 - n * 23 : 115 + (n % 2) * 15} height={110} color={["#c8675b", "#5f908c", "#d4a24f", "#817caa", "#60828d", "#b86573"][n]!} />)}
      {motif === "cottage" && <><path d="M0 0 H1000 V280 H0Z M34 22 V256 H966 V22Z" fill="var(--theme-second)" fillRule="evenodd" /><path d="M326 20 V255 M670 20 V255 M26 120 H974" stroke="var(--card)" strokeWidth="10" /><g transform="translate(95 206)"><path d="M0 0 H62 L55 49 H8Z" fill="var(--theme-accent)" /><path d="M61 9 Q95 6 88 29 Q82 43 59 33" stroke="var(--theme-accent)" fill="none" strokeWidth="8" /><path className="scene-steam" d="M19 -8 q-12 -12 0 -28 M37 -8 q12 -12 0 -31" fill="none" stroke="var(--card)" strokeWidth="3" /></g></>}
    </>}
    <path className="scene-fog" d="M-90 161 Q240 99 504 151 T1090 136" fill="none" stroke="var(--card)" opacity=".28" strokeWidth="35" />
  </>;
}
const BRACELET_NAMES = ["JONATHAN", "BIANCA"] as const;

function BraceletStrands({ layer = "whole" }: { layer?: "rear" | "front" | "whole" }) {
  return <>
    {BRACELET_NAMES.map((name, row) => {
      const beads = Array.from({ length: 25 }, (_, i) => {
        const angle = (i / 25) * Math.PI * 2;
        return { angle, i, x: Math.cos(angle) * 91, y: Math.sin(angle) * 34 };
      }).filter(({ y }) => layer === "whole" || (layer === "rear" ? y <= 0 : y >= 0));
      return <g key={name} className={`bracelet-strand bracelet-strand--${layer}`} transform={`translate(${row ? 165 : 115} ${row ? 109 : 55}) rotate(${row ? 6 : -6})`}>
        {layer === "whole"
          ? <ellipse rx="91" ry="34" fill="none" stroke="var(--theme-second)" strokeOpacity=".45" strokeWidth="3" />
          : <path d={layer === "rear" ? "M-91 0Q0-68 91 0" : "M-91 0Q0 68 91 0"} fill="none" stroke="var(--theme-second)" strokeOpacity=".45" strokeWidth="3" />}
        {beads.map(({ angle, i, x, y }) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 6.8 : 5.5} fill={i % 4 === 0 ? "#e4b976" : i % 3 === 0 ? "var(--theme-accent)" : i % 2 ? "var(--card)" : "var(--theme-second)"} stroke="var(--card)" strokeWidth="1.4" data-angle={angle.toFixed(2)} />)}
        {layer !== "rear" && name.split("").map((letter, i) => <g key={i} transform={`translate(${(i - (name.length - 1) / 2) * 18} 31)`}>
          <rect x="-8.5" y="-11" width="17" height="23" rx="4" fill="#fffaf0" stroke="#d6bdad" />
          <text x="0" y="5" fill="#533d43" textAnchor="middle" fontSize="17" fontFamily="Figtree, sans-serif" fontWeight="700">{letter}</text>
        </g>)}
        {layer !== "rear" && <path d="M91 8 c-9 -9 -18 3 -2 14 c16 -11 7 -23 -2 -14Z" fill="#cba261" stroke="#fff1ce" />}
      </g>;
    })}
  </>;
}

export function FriendshipBracelets() {
  const prepared = MEMORABILIA.find(asset => asset.id === "bracelet-pair" && asset.status === "prepared" && asset.src);
  if (prepared) return <img className="friendship-bracelets" src={prepared.src!} alt={prepared.alt} width={prepared.width} height={prepared.height} decoding="async" />;
  return <svg className="friendship-bracelets" viewBox="0 0 280 166" role="img" aria-label="Illustrated placeholder friendship bracelets for Jonathan and Bianca" data-placeholder="bracelets">
    <BraceletStrands />
  </svg>;
}

function BraceletAnchor({ page, scene }: { page: SceneRoute; scene: ThemeScene }) {
  const shared = { fill: "var(--card)", stroke: "var(--theme-second)", strokeWidth: 2 };
  if (page === "home") {
    if (scene.theme === "taylor") return <g className="bracelet-wrap-anchor" transform="translate(107 34) rotate(4 41 48)"><rect width="82" height="96" rx="3" {...shared}/><rect x="9" y="9" width="64" height="58" fill="var(--theme-second)" opacity=".22"/><path d="M22 80h39" stroke="var(--theme-accent)" strokeWidth="3"/><path d="M41 32c-13-15-25 5 0 22 25-17 13-37 0-22Z" fill="var(--theme-accent)" opacity=".65"/></g>;
    if (scene.theme === "newfoundland") return <g className="bracelet-wrap-anchor" transform="translate(108 43)"><path d="M0 31L40 0l41 31v66H0Z" fill="var(--theme-accent)" stroke="var(--theme-second)" strokeWidth="2"/><rect x="31" y="58" width="20" height="39" fill="var(--theme-second)"/><path d="M11 42h17v18H11zm42 0h17v18H53z" fill="var(--card)"/></g>;
    return <g className="bracelet-wrap-anchor" transform="translate(103 44)"><path d="M10 22h66l-8 64Q43 99 18 86Z" {...shared}/><path d="M75 34q35-9 27 23-6 20-31 16" fill="none" stroke="var(--theme-second)" strokeWidth="7"/><ellipse cx="43" cy="23" rx="33" ry="7" fill="var(--theme-accent)" opacity=".7"/></g>;
  }
  if (page === "calendar") {
    if (scene.theme === "taylor") return <g className="bracelet-wrap-anchor" transform="translate(105 40)"><circle cx="43" cy="45" r="43" fill="var(--theme-second)" stroke="var(--card)" strokeWidth="4"/><circle cx="43" cy="45" r="13" fill="var(--theme-accent)"/><circle cx="43" cy="45" r="3" fill="var(--card)"/></g>;
    if (scene.theme === "newfoundland") return <g className="bracelet-wrap-anchor" transform="translate(120 27)"><path d="M8 104L18 23h32l10 81Z" {...shared}/><path d="M13 23h43V8H13ZM9 8L34-8 60 8Z" fill="var(--theme-accent)"/><rect x="25" y="72" width="18" height="32" fill="var(--theme-second)"/></g>;
    return <g className="bracelet-wrap-anchor" transform="translate(104 34)"><rect width="88" height="96" rx="4" {...shared}/><path d="M0 25h88" stroke="var(--theme-accent)" strokeWidth="14"/><path d="M18 48h18m12 0h18M18 68h18m12 0h18" stroke="var(--theme-second)" strokeWidth="7" opacity=".45"/></g>;
  }
  if (page === "plan") {
    if (scene.theme === "newfoundland") return <g className="bracelet-wrap-anchor" transform="translate(105 43)"><path d="M0 82l29-42 19 20 25-38 24 60Z" fill="var(--theme-second)" stroke="var(--card)" strokeWidth="3"/><path d="M8 91h82" stroke="var(--theme-accent)" strokeWidth="7"/></g>;
    return <g className="bracelet-wrap-anchor" transform="translate(103 36) rotate(-3 45 47)"><rect x="5" width="84" height="98" rx="4" {...shared}/><path d="M22 25h52M22 43h45M22 61h52M22 79h36" stroke="var(--theme-second)" strokeWidth="3" opacity=".48"/><path d="M10 0v98" stroke="var(--theme-accent)" strokeWidth="5"/></g>;
  }
  if (page === "ledger") {
    return <g className="bracelet-wrap-anchor" transform="translate(98 42) rotate(-3 48 45)"><rect x="6" y="54" width="96" height="30" rx="4" fill="var(--theme-second)" stroke="var(--card)" strokeWidth="3"/><rect x="17" y="27" width="83" height="29" rx="4" fill="var(--card)" stroke="var(--theme-accent)" strokeWidth="3"/><rect x="4" width="92" height="29" rx="4" fill="var(--theme-accent)" stroke="var(--theme-second)" strokeWidth="3"/><path d="M21 10h57M30 38h53M20 67h65" stroke="var(--card)" strokeWidth="3" opacity=".7"/></g>;
  }
  if (scene.theme === "newfoundland") return <g className="bracelet-wrap-anchor" transform="translate(105 31)"><path d="M14 45Q8 5 34 8h32q27-3 24 37v45H14Z" fill="var(--theme-accent)" stroke="var(--theme-second)" strokeWidth="3"/><path d="M14 90h76v25H14ZM23 115v18m58-18v18" fill="var(--card)" stroke="var(--theme-second)" strokeWidth="5"/></g>;
  if (scene.theme === "taylor") return <g className="bracelet-wrap-anchor" transform="translate(99 46)"><rect x="5" y="18" width="100" height="65" rx="8" fill="var(--theme-second)" stroke="var(--card)" strokeWidth="3"/><path d="M18 18V7h29v11" fill="var(--theme-accent)"/><circle cx="57" cy="51" r="24" fill="var(--card)" stroke="var(--theme-accent)" strokeWidth="5"/><circle cx="57" cy="51" r="12" fill="var(--theme-second)"/></g>;
  return <g className="bracelet-wrap-anchor" transform="translate(103 43)"><path d="M9 22h67l-8 64Q43 99 18 86Z" {...shared}/><path d="M75 34q35-9 27 23-6 20-31 16" fill="none" stroke="var(--theme-second)" strokeWidth="7"/><path d="M25 5q-12-13 0-25m24 25q12-13 0-25" fill="none" stroke="var(--theme-second)" strokeWidth="3"/></g>;
}

export function WrappedFriendshipBracelets({ page, scene }: { page: SceneRoute; scene: ThemeScene }) {
  const prepared = MEMORABILIA.find(asset => asset.id === "bracelet-pair" && asset.status === "prepared" && asset.src);
  const clipId = useId().replace(/:/g, "");
  return <svg className="friendship-bracelets friendship-bracelets--wrapped" viewBox="0 0 280 166" role="img" aria-label={`Jonathan and Bianca's friendship bracelets wrapped around a ${page} keepsake`} data-wrap-anchor={`${scene.theme}-${page}`} data-placeholder={prepared ? undefined : "bracelets"}>
    {prepared ? <>
      <defs>
        <clipPath id={`${clipId}-rear`}><path d="M0 0H280V55H0ZM0 75H280V109H0Z"/></clipPath>
        <clipPath id={`${clipId}-front`}><path d="M0 55H280V75H0ZM0 109H280V166H0Z"/></clipPath>
      </defs>
      <image href={prepared.src!} width="280" height="166" preserveAspectRatio="xMidYMid meet" clipPath={`url(#${clipId}-rear)`}/>
      <BraceletAnchor page={page} scene={scene}/>
      <image href={prepared.src!} width="280" height="166" preserveAspectRatio="xMidYMid meet" clipPath={`url(#${clipId}-front)`}/>
    </> : <>
      <BraceletStrands layer="rear"/>
      <BraceletAnchor page={page} scene={scene}/>
      <BraceletStrands layer="front"/>
    </>}
  </svg>;
}
function ScrapbookArt({ scene, uid }: { scene: ThemeScene; uid: string }) {
  return <>
    <defs><pattern id={`${uid}-sequin`} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="7" fill="var(--theme-accent)" /><path d="M5 6 L10 4 M12 10 L13 12" stroke="#fff1cd" strokeWidth="2" /></pattern></defs>
    <g transform="translate(729 30) rotate(9 100 100)"><rect width="170" height="213" fill="var(--card)" stroke="var(--line)" strokeWidth="2" /><rect x="12" y="12" width="146" height="154" fill="var(--theme-second)" opacity=".18" /><path d="M58 -5 L121 -5 L125 16 L54 16Z" fill="var(--theme-accent)" opacity=".24" /></g>
    <g transform="translate(50 80) rotate(-12 60 70)"><rect x="0" y="0" width="100" height="139" fill="var(--card)" stroke="var(--line)" /><path d="M15 25 H83 M15 36 H75 M15 47 H81 M15 77 H63 M15 88 H85" stroke="var(--theme-second)" opacity=".28" strokeWidth="2" /></g>
    {scene.motif === "crystals" ? <>
      <path d="M778 35 Q820 51 869 25 L953 202 Q890 250 816 222Z" fill={`url(#${uid}-sequin)`} />
      <path className="scene-ribbon" d="M610 246 Q728 160 872 202 Q920 216 1000 119" stroke="#8cb4a2" strokeWidth="30" fill="none" />
      <g className="scene-sparkle" fill="#fff3c9">{[[695, 54], [945, 74], [737, 224], [150, 32]].map(([x, y], i) => <path key={i} transform={`translate(${x} ${y})`} d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3Z" />)}</g>
    </> : scene.motif === "hearts" ? <g className="scene-ribbon" fill="var(--theme-accent)" opacity=".4">{[[65, 26, 1], [866, 78, 2], [647, 216, 1.5]].map(([x, y, scale], i) => <path key={i} transform={`translate(${x} ${y}) scale(${scale})`} d="M0 0 C-23 -25 -40 9 0 31 C40 9 23 -25 0 0Z" />)}</g>
      : scene.motif === "constellation" || scene.motif === "stars" ? <g className="scene-sparkle" stroke="var(--theme-accent)" fill="var(--theme-accent)"><path d="M78 58 L161 113 L98 177 L204 216 M757 66 L864 116 L920 42" fill="none" opacity=".5" />{[[78, 58], [161, 113], [98, 177], [204, 216], [757, 66], [864, 116], [920, 42]].map(([x, y], i) => <path key={i} transform={`translate(${x} ${y})`} d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2Z" />)}</g>
      : scene.motif === "serpent" ? <path d="M615 245 Q741 271 799 219 Q855 173 791 143 Q741 113 811 71 Q855 49 908 69" fill="none" stroke="var(--theme-accent)" strokeWidth="10" strokeDasharray="3 2" />
      : scene.motif === "ribbon" ? <g className="scene-ribbon" fill="none" stroke="var(--theme-accent)"><path d="M680 264 Q738 142 827 105 Q915 53 930 182 Q864 231 827 105 Q806 5 735 73 Q726 138 827 105 L974 253" strokeWidth="15" /><path d="M823 101 l15 7 -9 14 -14 -8Z" strokeWidth="12" /></g>
      : scene.motif === "manuscript" ? <g stroke="var(--theme-accent)" opacity=".5"><path d="M761 65 H871 M761 79 H859 M761 94 H875 M761 108 H853 M761 123 H881 M761 137 H864" /><path d="M747 86 L894 108 M808 183 Q859 159 891 187" fill="none" strokeWidth="2" /></g>
      : scene.motif === "gulls" ? <path className="scene-gulls" d="M715 87 q28 -25 55 0 q28 -25 55 0 M840 139 q18 -18 36 0 q18 -18 36 0" fill="none" stroke="var(--theme-second)" strokeWidth="4" />
      : scene.motif === "forest" ? <g className="scene-forest" stroke="var(--theme-second)" fill="none">
        {[0,1,2,3,4,5].map(i => <g key={i} transform={`translate(${703+i*47} ${10+(i%2)*18})`} opacity={.3+(i%3)*.18}><path d="M0 0V255M0 44L-20 15M0 85L24 44M0 139L-27 107M0 163L32 125" strokeWidth={i%2?3:5}/><path d="M-12 250Q15 201 43 241" strokeWidth="1"/></g>)}
        <path d="M75 248q15 -75 48 -122M109 171q-41 -40 -32 -54q38 11 30 50M113 161q47 -20 44 -49q-40 16 -44 49" strokeWidth="2"/>
      </g> : scene.motif === "butterflies" ? <g className="scene-butterflies" fill="var(--theme-second)" stroke="var(--theme-accent)" strokeWidth="1.3">
        {[[783,88,1.2],[901,174,.75],[153,61,.65]].map(([x,y,scale],i)=><g className="scene-ribbon" key={i} transform={`translate(${x} ${y}) scale(${scale})`}><path d="M0 0C-65 -80 -69 13 -7 7C-57 60 -8 65 0 10C8 65 57 60 7 7C69 13 65 -80 0 0Z" fillOpacity=".35"/><path d="M0 -7V26M0 -5L-8 -18M0 -5L8 -18" fill="none"/></g>)}
        <path d="M725 261Q796 180 938 239M833 224q-43 -65 -53 -37q2 21 53 37M851 225q17 -59 43 -45q9 19 -43 45" fill="none" strokeWidth="2"/>
      </g> : <g className="scene-grass" stroke="var(--theme-second)" fill="var(--theme-second)"><path d="M838 241 Q797 131 867 36 M147 245 Q184 166 141 95" fill="none" strokeWidth="2" />{[0, 1, 2, 3, 4].map(i => <g key={i} transform={`translate(${834 + i * 3} ${205 - i * 34}) rotate(${-20 + i * 8})`}><path d="M0 0 Q-52 -8 -32 -32 Q-6 -32 0 0Z" opacity=".7" /><path d="M0 -8 Q45 -45 48 -11 Q36 4 0 -8Z" opacity=".5" /></g>)}</g>}
  </>;
}
export function SceneArtwork({ scene }: { scene: ThemeScene }) {
  const uid = useId().replace(/:/g, "");
  return <svg className="scene-artwork" viewBox="0 0 1000 280" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
    {scene.theme === "newfoundland" ? <NewfoundlandArt scene={scene} /> : scene.theme === "taylor" ? <ScrapbookArt scene={scene} uid={uid} /> : <>
      {scene.motif === "pinboard" && <g transform="translate(650 18)">
        <rect width="303" height="225" rx="8" fill="var(--theme-second)" fillOpacity=".22" stroke="var(--theme-second)" strokeWidth="6"/>
        {[[20,18,-6],[160,35,8],[88,120,-3]].map(([x,y,r],i)=><g key={i} transform={`translate(${x} ${y}) rotate(${r} 55 35)`}><rect width="112" height="73" fill="var(--card)"/><circle cx="56" cy="8" r="4" fill="var(--theme-accent)"/><path d="M16 27H92M16 41H77M16 55H84" stroke="var(--theme-second)" opacity=".3"/></g>)}
      </g>}
      {scene.motif === "calendar" && <g transform="translate(731 32) rotate(4 100 100)">
        <rect width="197" height="207" rx="4" fill="var(--card)" stroke="var(--line)"/><path d="M0 38H197" stroke="var(--theme-accent)" strokeWidth="20"/><path d="M35 -7V12M162 -7V12" stroke="var(--theme-second)" strokeWidth="5"/>
        {[0,1,2,3].map(y=><g key={y}>{[0,1,2,3,4].map(x=><rect key={x} x={16+x*35} y={66+y*31} width="22" height="20" rx="2" fill="var(--theme-second)" opacity={(x+y)%4===0?.3:.09}/>)}</g>)}
      </g>}
      {scene.motif === "ledger" && <g transform="translate(667 60) rotate(-6 130 90)">
        <path d="M0 0Q65 -16 133 0Q200 -16 266 0V166Q200 150 133 166Q65 150 0 166Z" fill="var(--card)" stroke="var(--line)" strokeWidth="2"/><path d="M133 0V166" stroke="var(--theme-accent)" opacity=".4"/>
        {[28,48,68,88,108,128].map(y=><path key={y} d={`M16 ${y}H118M147 ${y}H248`} stroke="var(--theme-second)" opacity=".2"/>)}
        <path d="M88 14V149M217 14V149" stroke="var(--theme-accent)" opacity=".25"/>
      </g>}
      <g opacity={["calendar","ledger","pinboard"].includes(scene.motif) ? 0 : 1} transform="translate(780 25)"><rect width="157" height="186" rx="70" fill="var(--theme-second)" opacity=".12" /><path d="M795 40" /><path d="M79 0 V185 M0 92 H156" stroke="var(--card)" strokeWidth="6" /></g>
      <path d="M0 253 Q500 217 1000 252 V280 H0Z" fill="var(--theme-accent)" opacity=".14" />
      <g transform="translate(790 200)"><path d="M0 0 H54 L48 42 H6Z" fill="var(--theme-accent)" /><path d="M52 7 Q83 1 75 28 Q67 38 51 29" fill="none" stroke="var(--theme-accent)" strokeWidth="7" /><path className="scene-steam" d="M14 -7 q-9 -12 0 -28 M31 -7 q9 -12 0 -28" fill="none" stroke="var(--theme-second)" strokeWidth="2" /></g>
      <g transform="translate(92 214)"><path d="M0 0 Q31 -72 2 -125 M0 0 Q-35 -55 -43 -56" fill="none" stroke="var(--theme-second)" strokeWidth="2" /><ellipse cx="10" cy="-71" rx="25" ry="10" fill="var(--theme-second)" transform="rotate(-34 10 -71)" /><ellipse cx="-22" cy="-37" rx="23" ry="9" fill="var(--theme-second)" transform="rotate(28 -22 -37)" /><path d="M-25 0 H25 L19 49 H-18Z" fill="var(--theme-accent)" opacity=".55" /></g>
    </>}
  </svg>;
}
export function ThemeSceneHeading({ home = false, calendar = false, plan = false, more = false, books = false }: { home?: boolean; calendar?: boolean; plan?: boolean; more?: boolean; books?: boolean }) {
  const { scene } = useAppearance();
  const page: SceneRoute = books ? "ledger" : more ? "more" : plan ? "plan" : calendar ? "calendar" : "home";
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <section ref={ref} data-scene-visible={visible} className="theme-scene-heading" aria-label={`${scene.title} theme scene`} data-home-scene={home || undefined} data-calendar-scene={calendar || undefined} data-plan-scene={plan || undefined}>
    {books ? <BooksHeadingArtwork scene={scene}/> : more ? <MoreHeadingArtwork scene={scene}/> : home ? <HomeArtwork scene={scene} /> : calendar ? <CalendarHeadingArtwork scene={scene}/> : plan ? <PlanHeadingArtwork scene={scene}/> : <SceneArtwork scene={scene} />}
    {more && scene.theme === "newfoundland" && <img className="more-chair-sticker" src="/theme-art/more-jag-couple.webp" alt="Clip-art couple sitting side by side in white sauna robes on a tall red JAG chair" width="160" height="240" />}
    {plan && scene.id === "summit" && <img className="plan-cannon-sticker" src="/theme-art/plan-cannon.webp" alt="Simple clip-art illustration of Jonathan sitting on the cannon at Signal Hill" width="240" height="160" />}
    {calendar && scene.id === "cape-spear" && <img className="calendar-couple" src="/theme-art/calendar-cape-couple.webp" alt="Clip-art illustration of Jonathan and Bianca at Cape Spear" />}
    <div className="theme-scene-copy"><span className="theme-scene-kicker">{scene.theme === "taylor" ? "A page from our scrapbook" : scene.theme === "newfoundland" ? "A little Newfoundland" : "Welcome home"}</span><p className="theme-scene-title">{scene.title}</p><p className="theme-scene-caption">{scene.caption}</p></div>
    {(home || calendar || plan || more || books) && <div className="desktop-title-bracelets"><WrappedFriendshipBracelets page={page} scene={scene}/><EraBracelet /></div>}
    <AtmosphereControl />
  </section>;
}
