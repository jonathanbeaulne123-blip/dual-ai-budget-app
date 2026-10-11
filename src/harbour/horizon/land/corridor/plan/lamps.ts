/**
 * Streetlights (ROAD.md §4.5, §6). Lit runs by context: developed = road lanterns staggered both sides (one side when
 * only one side has a footway), boulevard = one side (the median when there is one), structure = bridge lanterns on
 * the rail between the road and its footway (never on the sea edge) and tunnel lamps on the wall; coastal / mountain /
 * open stay dark except a pair at junction mouths and scenic stops, and the 40 eu approaches to bridges and tunnels.
 *
 * Spacing: ROAD's nominal spacing (CORRIDOR.lampSpacing) is the MAXIMUM between consecutive lamps along the road; it
 * is reduced so that consecutive pools (radius CORRIDOR.lampPoolRadius, measured on the centreline) leave no dark gap
 * over LAMP.maxDark. A lit run ends in two tail lamps at widening spacing (the light thins over two lamps).
 */
import type { Point3 } from '../../../world/definition.ts';
import type { CorridorStation, LampKind, LampSpot } from '../types.ts';
import { CORRIDOR } from '../types.ts';
import type { Analysis } from './context.ts';
import { landSide, seaSide, type Env } from './env.ts';
import { sign, type SideName } from './frame.ts';
import { r3 } from './rng.ts';
/** The island lantern's low version (STYLE §3.1, D-303): a 0.8 eu bollard and the small pool it throws on the road. */
export const BOLLARD_HEIGHT = .8, BOLLARD_POOL = 3;
import type { StopSpan } from './stops.ts';
import {roadLampFootSupported} from './lampFootprint.ts';

export const LAMP = Object.freeze({
  arm: 1.6,
  maxDark: 6,
  /** Keep this far (along the road) beyond a gap's end: the dropped kerb and the post's own footprint. */
  gapClear: CORRIDOR.droppedKerbLength / 2 + 0.5,
  approach: 40,
  tunnelSpacing: 15,
  tunnelHeadHeight: 4.2,
  /** Wall offset beyond the paved edge in a tunnel. */
  tunnelWall: 0.4,
  /** The pair at a junction mouth / stop stands this far either side of its centre. */
  pairHalf: 6,
  /** A lamp base may sit this far above / below the road before the spot is refused (a batter, a cut face). */
  maxStep: 1.2,
  /** Tail lamps: their spacing factors relative to the run's spacing. */
  tail: [1.3, 1.7] as const,
  /** Search this fraction of the spacing either way for a legal spot before giving a lamp up. */
  slide: 0.35,
});

/** Destinations within this of the centreline get a lantern pair at their frontage (plan.ts PLAN_DESTINATION_REACH). */
const DESTINATION_REACH = 45;
const NON_THRESHOLD = ['junction', 'entrance', 'crossing', 'viewpoint', 'layby'] as const;

type Regime = 'developed' | 'boulevard' | 'median' | 'bridge' | 'tunnel' | 'approach' | 'none';

/** A kerb-mounted lantern's set-back beyond the paved edge (eu): just clear of the road's own paved band. */
const KERB_MOUNT = 0.35;
/** A bridge lantern may stand on an approach's guard rail this far (eu) from a structure end. */
const APPROACH_RAIL = 24;
interface Slot { s: number; side: SideName | 'median'; kind: LampKind; tail?: boolean }

/** The lit runs (s ranges, before the fade-out tails) the lamps were spaced for: pools overlap inside each. */
export interface LitRun { from: number; to: number; regime: string }

export function planLamps(A: Analysis, env: Env, stops: readonly { span: StopSpan; s: number }[], litRuns: LitRun[] = []): LampSpot[] {
  const F = A.frame, S = A.stations, n = S.length;
  const regimeOf = (st: CorridorStation): Regime => {
    if (st.structureId) return env.structureKind(st.structureId) === 'tunnel' ? 'tunnel' : 'bridge';
    if (!A.furnished) return 'none';
    if (st.context === 'developed') return 'developed';
    if (st.context === 'boulevard') return st.median ? 'median' : 'boulevard';
    return 'none';
  };
  const regime: Regime[] = S.map(regimeOf);
  // Approaches to bridges and tunnels (main roads): 40 eu of light before each structure end, where it is otherwise dark.
  if (A.furnished) for (const x of A.structures) {
    for (const [edge, dir] of [[x.run.from, -1], [x.run.to, 1]] as const) {
      if (!F.closed && (edge <= 0.01 && dir < 0 || edge >= F.length - 0.01 && dir > 0)) continue;
      for (let d = CORRIDOR.step / 2; d <= LAMP.approach; d += CORRIDOR.step / 2) { const i = F.nearestIndex(edge + dir * d); if (regime[i] === 'none') regime[i] = 'approach'; }
    }
  }

  const out: { l: LampSpot; s: number; run: number }[] = [];
  let runNo = 0;
  /** The carriageway-side rail line: the kerb rail CORRIDOR.guardSetback beyond the paved edge (types.ts guard offsets). */
  const railOffset = (st: CorridorStation, side: SideName): number => st[side].guardOffset ?? st[side].paved + CORRIDOR.guardSetback;
  /** One serializer for both measured candidates and emitted fixtures: same frame, head direction and rounding. */
  const packedLamp=(s:number,slotSide:SideName|'median',kind:LampKind,o:number,headO:number,baseY:number,headY:number):LampSpot=>{
    const f=F.frameAt(s),at=F.point(s,o),head=F.point(s,headO),st=S[F.nearestIndex(s)]!;
    const dx=slotSide==='median'?f.right[0]:head[0]-at[0],dz=slotSide==='median'?f.right[1]:head[2]-at[2];
    return {id:'',kind,at:[r3(at[0]),r3(baseY),r3(at[2])],head:[r3(head[0]),r3(headY),r3(head[2])],
      pool:[r3(head[0]),r3(f.at[1]),r3(head[2])],poolRadius:CORRIDOR.lampPoolRadius,yaw:r3(Math.atan2(dx,dz)),
      side:slotSide==='median'?'right':slotSide,reachId:st.reachId};
  };
  const roadCandidate=(s:number,side:SideName,back:number):LampSpot=>{
    const st=S[F.nearestIndex(s)]!,sg=sign(side),o=sg*(st[side].paved+back),p=F.point(s,o),baseY=baseHeight(st,side,Math.abs(o),p);
    return packedLamp(s,side,'roadLantern',o,o-sg*LAMP.arm,baseY,baseY+CORRIDOR.lampHeight);
  };
  const mountedCandidate=(s:number,side:SideName):LampSpot=>{
    const st=S[F.nearestIndex(s)]!,sg=sign(side),o=sg*railOffset(st,side),y=st.at[1]+CORRIDOR.kerbRise;
    return packedLamp(s,side,'roadLantern',o,o-sg*LAMP.arm,y,y+CORRIDOR.lampHeight);
  };
  const measuredSetback=(s:number,side:SideName)=>env.lampSetback?.(s,side,{roadHeight:S[F.nearestIndex(s)]!.at[1],candidate:back=>roadCandidate(s,side,back)});
  /** A road lantern's lateral set-back beyond the paved edge: CORRIDOR.lampSetback, or KERB_MOUNT where that spot is taken
   * (a separated lane, a path or a pad right beside the road) and the kerb line is free (integration: the Quay Bridge's
   * south approach had no legal spot for 18 eu). */
  const setbackAt = (s: number, side: SideName): number => {
    const st = S[F.nearestIndex(s)]!, sd = st[side], measured=measuredSetback(s,side),setback=measured??CORRIDOR.lampSetback, at = (o: number) => F.point(s, sign(side) * (sd.paved + o));
    const free = (o: number) => { const p = at(o); return !env.occupied(p[0], p[2]); };
    return measured!==undefined?setback:free(setback) || (sd.footway && sd.paved + setback >= sd.footway.inner - 0.3) || !free(KERB_MOUNT) ? setback : KERB_MOUNT;
  };
  const reject = (s: number, side: SideName | 'median', kind: LampKind): string | null => {
    const i = F.nearestIndex(s), st = S[i]!;
    if (side === 'median') return st.median ? null : 'no median';
    const sd = st[side];
    // Bridge lanterns stand on the structure's own rail and tunnel lamps on its wall — or, a bridge lantern, on the approach's
    // guard rail within APPROACH_RAIL of a structure end (a crowded approach has no other legal spot: the Quay Bridge's
    // south approach, the High Span's west approach).
    if (kind === 'tunnelLamp' && !A.structureAt(s)) return 'off structure';
    if (kind === 'bridgeLantern' && !A.structureAt(s)) {
      const railed = sd.guard === 'postRail' || sd.guard === 'stoneParapet';
      let near = false; for (let d = -APPROACH_RAIL; d <= APPROACH_RAIL && !near; d += 2) near = !!A.structureAt(F.wrapS(s + d));
      if (!railed || !near) return 'off structure';
    }
    // Gaps stay open; a bridge lantern may stand on the end pier at the structure's own threshold (a deliberate rail end).
    if (kind !== 'tunnelLamp' && A.nearMouth(s, side, LAMP.gapClear, kind === 'bridgeLantern' ? NON_THRESHOLD : undefined)) return 'gap';
    // Integration (design lead): a lantern's slim post may stand in a junction's sight triangle (ROAD.md §5 keeps planting
    // over 0.6 out of it, not posts); it still keeps LAMP.gapClear from the mouth. Junctions are where light matters most
    // (brief §3), and the triangle rule left the Quay Bridge's south approach 17.5 eu dark.
    for (const t of stops) if (t.span.side === side && Math.abs(F.delta(t.s, s)) <= Math.abs(F.delta(t.span.from, t.span.to)) / 2 + 1) return 'stop';
    if (kind === 'roadLantern') {
      if (st.structureId) return 'structure';
      const back = setbackAt(s, side), p = F.point(s, sign(side) * (sd.paved + back));
      if (env.wet(p[0], p[2])) return 'water';
      const g = baseHeight(st, side, sd.paved + back, p);
      // Over a batter or a cut the lantern stands on the guard's line instead (a parapet- or rail-mounted post), else nowhere.
      if (Math.abs((env.lampSetback?r3(g):g) - st.at[1]) > LAMP.maxStep) {
        if(sd.guard==='none'||sd.guard==='retaining')return 'step';
        // Moving from a shoulder onto masonry changes the actual footprint. Check
        // that final candidate before the ordinary bounded slide/side search accepts it.
        return env.lampMountAllowed&&!env.lampMountAllowed(mountedCandidate(s,side),side)?'mount-footprint':null;
      }
      // A measured environment must accept the actual emitted rotated foot. An undefined
      // search result cannot fall back to an unchecked ground post. Explicit guard mounts
      // above retain their separate real-masonry support proof.
      if(env.lampSetback&&(measuredSetback(s,side)===undefined||!roadLampFootSupported(roadCandidate(s,side,back),{ground:env.ground,occupied:env.occupied,water:env.wet})))return 'post-footprint';
      if (env.occupied(p[0], p[2]) && !(sd.footway && sd.paved + back >= sd.footway.inner - 0.3)) return 'occupied';
    }
    return null;
  };
  const baseHeight = (st: CorridorStation, side: SideName, o: number, p: Point3): number => {
    const fw = st[side].footway;
    if (fw && o >= fw.inner - 0.3 && o <= fw.outer + 0.3) return fw.height;
    return env.ground(p[0], p[2]);
  };
  const make = (slot: Slot): LampSpot | null => {
    const i = F.nearestIndex(slot.s), st = S[i]!;
    let o: number, headO: number, headY: number, baseY: number;
    if (slot.side === 'median') {
      // A median lantern: a twin-arm post on the median's centre; `head` is its lantern over the median (both arms light both carriageways).
      o = 0; headO = 0; baseY = st.at[1] + CORRIDOR.kerbRise; headY = baseY + CORRIDOR.lampHeight;
    } else {
      const sd = st[slot.side], sg = sign(slot.side);
      if (slot.kind === 'tunnelLamp') { o = sg * (sd.paved + LAMP.tunnelWall); headO = sg * (sd.paved - 0.2); baseY = st.at[1]; headY = st.at[1] + LAMP.tunnelHeadHeight; }
      else if (slot.kind === 'bridgeLantern') { o = sg * railOffset(st, slot.side); headO = o - sg * LAMP.arm; baseY = st.at[1] + CORRIDOR.kerbRise; headY = baseY + CORRIDOR.lampHeight; }
      else {
        o = sg * (sd.paved + setbackAt(slot.s, slot.side)); headO = o - sg * LAMP.arm;
        const p = F.point(slot.s, o); baseY = baseHeight(st, slot.side, Math.abs(o), p);
        if (Math.abs((env.lampSetback?r3(baseY):baseY) - st.at[1]) > LAMP.maxStep)return mountedCandidate(slot.s,slot.side);
        headY = baseY + CORRIDOR.lampHeight;
      }
    }
    return packedLamp(slot.s,slot.side,slot.kind,o,headO,baseY,headY);
  };
  /**
   * The largest spacing at which consecutive pools (heads at the cyclic lateral offsets `heads`) leave at most
   * LAMP.maxDark − 0.5 unlit along either lane centre (±lane) — the lines a rider actually drives.
   */
  const fit = (heads: readonly number[], lane: number): number => {
    const R = CORRIDOR.lampPoolRadius, chord = (h: number, o: number) => Math.sqrt(Math.max(0, R * R - (o - h) * (o - h)));
    let best = Infinity;
    for (let j = 0; j < heads.length; j++) {
      const a = heads[j]!, b = heads[(j + 1) % heads.length]!;
      for (const o of [-lane, lane]) best = Math.min(best, chord(a, o) + chord(b, o) + LAMP.maxDark - 0.5);
    }
    return Math.max(6, best);
  };
  const laneOf = (st: CorridorStation): number => (st.median ? st.median.half + (st.half - st.median.half) / 2 : st.half / 2);
  /** Lateral head offset of a lamp of `kind` on `side` at a station (matches `make`). */
  const headOffset = (st: CorridorStation, side: SideName | 'median', kind: LampKind): number => {
    if (side === 'median') return 0;
    const sd = st[side], sg = sign(side);
    if (kind === 'tunnelLamp') return sg * (sd.paved - 0.2);
    if (kind === 'bridgeLantern') return sg * (railOffset(st, side) - LAMP.arm);
    return sg * (sd.paved + (measuredSetback(st.s,side)??CORRIDOR.lampSetback) - LAMP.arm);
  };

  // 1. Lit runs.
  const lit = F.runs((_, i) => regime[i] !== 'none');
  for (const run of lit) {
    runNo++;
    {
      const regs = [...new Set(F.runIndices(run).map(i => regime[i]!))].sort().join('+');
      litRuns.push({ from: r3(F.wrapS(run.from - CORRIDOR.step / 2)), to: r3(F.wrapS(run.to + CORRIDOR.step / 2)), regime: regs });
    }
    const idx = F.runIndices(run);
    // Sub-runs of one regime.
    const parts: { reg: Regime; a: number; b: number }[] = [];
    for (const i of idx) { const r = regime[i]!, last = parts[parts.length - 1]; if (last && last.reg === r) last.b = i; else parts.push({ reg: r, a: i, b: i }); }
    const slots: Slot[] = [];
    const halfStep = CORRIDOR.step / 2;
    for (const p of parts) {
      const raw = S[p.b]!.s - S[p.a]!.s, from = S[p.a]!.s - halfStep, len = (raw < 0 ? raw + F.length : raw) + 2 * halfStep;
      const mid = S[Math.floor((p.a + (p.b >= p.a ? p.b : p.b + n)) / 2) % n]!;
      // Structure lamps stay inside the structure's own stations (the approach lamps meet them at its ends).
      const inside = p.reg === 'tunnel' || p.reg === 'bridge';
      const sFrom = inside ? S[p.a]!.s : from, sLen = inside ? Math.max(0, len - 2 * halfStep) : len;
      if (p.reg === 'tunnel') {
        const st = S[p.a]!, side = seaSide(st) ? landSide(st) : 'right';
        const sp0 = Math.min(LAMP.tunnelSpacing, fit([headOffset(st, side, 'tunnelLamp')], laneOf(st)));
        const k = Math.max(1, Math.ceil(sLen / sp0)), sp = sLen / k;
        for (let j = 0; j <= k; j++) slots.push({ s: sFrom + j * sp, side, kind: 'tunnelLamp' });
        continue;
      }
      if (p.reg === 'bridge') {
        const st = S[Math.floor((p.a + (p.b >= p.a ? p.b : p.b + n)) / 2) % n]!;
        // On the rail between the road and its footway (ROAD.md R9); a deck without a footway: both kerb rails, staggered.
        const idxs = F.runIndices({ i0: p.a, i1: p.b, from: S[p.a]!.s, to: S[p.b]!.s });
        const share = (sd: SideName) => idxs.filter(i => !!S[i]![sd].footway).length / idxs.length;
        let sides: SideName[] = (['left', 'right'] as const).filter(sd => share(sd) > 0.5);
        if (sides.length !== 1) sides = ['left', 'right'];
        // Fitted to the widest rail along the span (the heads furthest from the lanes), not the mid-span station alone.
        const worstHead = (sd: SideName) => idxs.reduce((m, i) => Math.abs(headOffset(S[i]!, sd, 'bridgeLantern')) > Math.abs(m) ? headOffset(S[i]!, sd, 'bridgeLantern') : m, headOffset(st, sd, 'bridgeLantern'));
        const sp0 = Math.min(CORRIDOR.lampSpacing.structure, fit(sides.map(worstHead), laneOf(st)));
        const k = Math.max(1, Math.ceil(sLen / sp0)), sp = sLen / k;
        for (let j = 0; j <= k; j++) slots.push({ s: sFrom + j * sp, side: sides[j % sides.length]!, kind: 'bridgeLantern' });
        continue;
      }
      const st = mid;
      if (p.reg === 'median') {
        const sp0 = Math.min(CORRIDOR.lampSpacing.boulevard, fit([0], laneOf(S[p.a]!))), k = Math.max(1, Math.ceil(len / sp0)), sp = len / k;
        for (let j = 0; j <= k; j++) slots.push({ s: from + j * sp, side: 'median', kind: 'roadLantern' });
        continue;
      }
      let sides: SideName[];
      const fw = (['left', 'right'] as const).filter(s => S[p.a]![s].footway || S[p.b]![s].footway || st[s].footway);
      if (p.reg === 'developed') sides = fw.length === 1 ? [fw[0]!] : ['left', 'right'];
      else if (p.reg === 'boulevard') sides = [fw.length === 1 ? fw[0]! : landSide(st)];
      else sides = [fw.length === 1 && fw[0] !== seaSide(st) ? fw[0]! : landSide(st)];
      const nominal = p.reg === 'boulevard' ? CORRIDOR.lampSpacing.boulevard : CORRIDOR.lampSpacing.developed;
      const sp0 = Math.min(nominal, fit(sides.map(sd => headOffset(st, sd, 'roadLantern')), laneOf(st))), k = Math.max(1, Math.ceil(len / sp0)), sp = len / k;
      for (let j = 0; j <= k; j++) slots.push({ s: from + j * sp, side: sides[j % sides.length]!, kind: 'roadLantern' });
    }
    // Tails: two widening lamps beyond each open end of the lit run (never across a seam that is itself lit).
    const whole = F.runLength(run) + CORRIDOR.step >= F.length - 1e-6;
    if (!whole) {
      const first = slots[0], last = slots[slots.length - 1];
      const sp = slots.length > 1 ? Math.abs(F.delta(slots[0]!.s, slots[1]!.s)) : CORRIDOR.lampSpacing.developed;
      for (const [end, dir] of [[first, -1], [last, 1]] as const) {
        if (!end || end.kind === 'tunnelLamp') continue;
        let s = end.s;
        for (let t = 0; t < LAMP.tail.length; t++) {
          s += dir * sp * LAMP.tail[t]!;
          if (!F.closed && (s < 0 || s > F.length)) break;
          const st = S[F.nearestIndex(s)]!;
          if (st.structureId) break;
          const side: SideName = end.side === 'median' ? landSide(st) : (st[end.side].footway || regime[F.nearestIndex(s)] === 'none' ? (end.side === seaSide(st) ? landSide(st) : end.side) : end.side);
          slots.push({ s, side, kind: 'roadLantern', tail: true });
        }
      }
    }
    for (const slot of slots) place(slot);
    repair(run);
  }

  /** Unlit length along lane line o between two lamps a → b (s increasing), sampled every 0.5 eu. */
  function darkBetween(a: { l: LampSpot; s: number }, b: { l: LampSpot; s: number }, o: number): number {
    const gap = F.delta(a.s, b.s); let dark = 0, worst = 0;
    for (let d = 0; d <= gap; d += 0.5) {
      const p = F.point(a.s + d, o), lit = [a.l, b.l].some(l => Math.hypot(p[0] - l.pool[0], p[2] - l.pool[2]) <= l.poolRadius);
      dark = lit ? 0 : dark + 0.5; worst = Math.max(worst, dark);
    }
    return worst;
  }
  /** A lit run's lamps, after placement moved some off their slots: fill any dark gap > maxDark with one more lamp. */
  function repair(run: { from: number }): void {
    for (let pass = 0; pass < 3; pass++) {
      const mine = out.filter(o => o.run === runNo).sort((a, b) => F.delta(run.from, a.s) - F.delta(run.from, b.s));
      let added = false;
      for (let k = 1; k < mine.length; k++) {
        const a = mine[k - 1]!, b = mine[k]!, gap = F.delta(a.s, b.s);
        if (gap <= 1) continue;
        const st = S[F.nearestIndex(a.s + gap / 2)]!, lane = laneOf(st);
        // A margin under maxDark: the gap is measured between these two lamps only, sampled every 0.5 eu.
        if (Math.max(darkBetween(a, b, -lane), darkBetween(a, b, lane)) <= LAMP.maxDark - 1.5) continue;
        const reg = regime[F.nearestIndex(a.s + gap / 2)]!;
        const kind: LampKind = reg === 'tunnel' ? 'tunnelLamp' : reg === 'bridge' ? 'bridgeLantern' : 'roadLantern';
        const n0 = out.length;
        // Put the extra lamp on the side the gap's lamps are not (a stagger), else the same side.
        const side: SideName | 'median' = reg === 'median' ? 'median' : kind !== 'roadLantern' ? a.l.side : a.l.side === b.l.side ? (a.l.side === 'left' ? 'right' : 'left') : a.l.side;
        // Try the stagger side first, then the other side (a junction mouth or a crossing may close one), across the gap.
        const other: SideName | 'median' = side === 'median' ? 'median' : side === 'left' ? 'right' : 'left';
        for (const sd of side === other ? [side] : [side, other]) { for (const f of [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85]) { place({ s: a.s + gap * f, side: sd, kind }); if (out.length > n0) break; } if (out.length > n0) break; }
        // Still dark beside a structure: a lantern on the approach's guard rail.
        if (out.length === n0 && kind === 'roadLantern') for (const sd of side === other ? [side] : [side, other]) { for (const f of [0.5, 0.35, 0.65, 0.25, 0.75]) { place({ s: a.s + gap * f, side: sd, kind: 'bridgeLantern' }); if (out.length > n0) break; } if (out.length > n0) break; }
        if (out.length > n0) added = true;
      }
      if (!added) break;
    }
  }

  function place(slot: Slot): void {
    // Near the slot first (either side of the road), then further along: a lamp may shift up to 9 eu to clear a gap.
    const tries: [number, boolean][] = [];
    for (const d of [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6, 7.5, -7.5, 9, -9]) { tries.push([d, false]); tries.push([d, true]); }
    for (const [d, swap] of tries) {
      const s = F.wrapS(slot.s + d);
      if (!F.closed && (s <= 0.2 || s >= F.length - 0.2)) continue;
      let side = slot.side;
      if (swap) {
        // A lamp that cannot stand on its side may cross to the other (never onto the sea edge of a bridge, never out of a median or off a tunnel wall).
        if (side === 'median' || slot.kind === 'tunnelLamp') continue;
        const other: SideName = side === 'left' ? 'right' : 'left', st = S[F.nearestIndex(s)]!;
        if (slot.kind === 'bridgeLantern' && seaSide(st) === other) continue;
        side = other;
      }
      if (reject(s, side, slot.kind)) continue;
      if (out.some(o => o.l.kind === slot.kind && Math.abs(F.delta(o.s, s)) < 4 && (side === 'median' || o.l.side === side))) continue;
      const lamp = make({ ...slot, s, side });
      if (lamp) out.push({ l: lamp, s, run: slot.tail ? -1 : runNo });
      return;
    }
  }

  // 2. Pairs in the dark: junction mouths (on the far side, opposite the mouth, out of its sight triangle) and stops.
  const lampNear = (s: number, r: number) => out.some(o => Math.abs(F.delta(o.s, s)) < r);
  // (Destination entrances and pedestrian crossings in the dark get the same pair: brief §3 "prioritise intersections …
  // and destination entrances"; a crossing is lit so a walker on it is seen.)
  if (A.furnished) for (const m of A.mouths) {
    if (m.kind !== 'junction' && m.kind !== 'entrance' && m.kind !== 'crossing') continue;
    const i = F.nearestIndex(m.s);
    if (regime[i] !== 'none' || lampNear(m.s, CORRIDOR.lampPoolRadius)) continue;
    const far: SideName = m.side === 'left' ? 'right' : 'left';
    const farOpen = !A.nearMouth(m.s, far, LAMP.pairHalf + LAMP.gapClear);
    // Opposite the mouth, a lantern either side of it; at a crossroads, on the mouth side just beyond its sight triangle.
    for (const d of [-1, 1]) place({ s: m.s + d * (farOpen ? LAMP.pairHalf : m.half + CORRIDOR.sightlineReach - 3), side: farOpen ? far : m.side, kind: 'roadLantern' });
  }
  if (A.furnished) for (const d of env.destinations) {
    let best = { s: 0, o: 0, d: Infinity };
    for (let k = 0; k < n; k += 10) { const p = F.project(d.at[0], d.at[1], k, 10); if (p.d < best.d) best = p; }
    if (best.d > DESTINATION_REACH) continue;
    const i = F.nearestIndex(best.s);
    if (regime[i] !== 'none' || S[i]!.structureId || lampNear(best.s, CORRIDOR.lampPoolRadius)) continue;
    const side: SideName = best.o >= 0 ? 'right' : 'left';
    for (const dd of [-LAMP.pairHalf, LAMP.pairHalf]) place({ s: best.s + dd, side, kind: 'roadLantern' });
  }
  for (const t of stops) {
    const half = Math.abs(F.delta(t.span.from, t.span.to)) / 2 + 2;
    if (lampNear(t.s, CORRIDOR.lampPoolRadius)) continue;
    for (const d of [-half, half]) place({ s: t.s + d, side: t.span.side, kind: 'roadLantern' });
  }

  // Sustained native bends: along-road proximity alone can leave an apex dark around a sharp curve.
  // Reuse the same legal post planner, and check the actual two running-lane points against its pools.
  if(A.furnished)for(const bend of env.lightBends??[]){
    const samples=[bend.apex];for(let s=bend.from;s<=bend.to;s+=1)samples.push(s);
    for(let pass=0;pass<3;pass++){
      let worst:{s:number;distance:number}|null=null;
      for(const s of samples){const st=S[F.nearestIndex(s)]!,lane=laneOf(st);
        const distance=Math.max(...[-lane,lane].map(o=>{const p=F.point(s,o);return Math.min(...out.map(l=>Math.hypot(p[0]-l.l.pool[0],p[2]-l.l.pool[2])-l.l.poolRadius));}));
        if(distance>.05&&(!worst||distance>worst.distance))worst={s,distance};
        // First light the actual apex when it is dark, before repairing either shoulder of the curve.
        if(pass===0&&s===bend.apex&&distance>.05)break;
      }
      if(!worst)break;
      const before=out.length;place({s:worst.s,side:landSide(S[F.nearestIndex(worst.s)]!),kind:'roadLantern'});
      if(out.length===before)break;
    }
  }

  // Required safety targets include route ends and openings as well as bends. Search
  // real, supported sites near each uncovered point; a moved post only counts when
  // its actual pool covers that point. Ordinary corridor plans omit this refinement.
  const required=env.lightTargets??[];
  const covers=(lamp:LampSpot,p:readonly [number,number])=>Math.hypot(p[0]-lamp.pool[0],p[1]-lamp.pool[2])<=lamp.poolRadius;
  for(let pass=0;pass<required.length;pass++){
    const pending=required.filter(p=>!out.some(o=>covers(o.l,p)));
    if(!pending.length)break;
    const findSite=(stationStep:number)=>{
      let best:{l:LampSpot;s:number;score:number;margin:number}|null=null;
      for(const p of pending){
        let near={s:0,d:Infinity};for(let i=0;i<n;i+=10){const q=F.project(p[0],p[1],i,10);if(q.d<near.d)near=q;}
        for(let d=-12;d<=12;d+=stationStep){const s=F.wrapS(near.s+d);if(!F.closed&&(s<=.2||s>=F.length-.2))continue;
          const st=S[F.nearestIndex(s)]!,kind:LampKind=st.structureId?(env.structureKind(st.structureId)==='tunnel'?'tunnelLamp':'bridgeLantern'):'roadLantern';
          for(const side of ['left','right'] as const){
            if(kind==='bridgeLantern'&&(seaSide(st)===side||!['bridgeRail','postRail','stoneParapet'].includes(st[side].guard)))continue;
            // A missing ground site is usable only through the explicit final-mount
            // validator in reject(). Ordinary measured environments retain the strict
            // ground-only rule; a guard label alone never invents a legal foot.
            if(kind==='roadLantern'&&env.lampSetback&&measuredSetback(s,side)===undefined&&!env.lampMountAllowed)continue;
            if(reject(s,side,kind)||out.some(o=>o.l.kind===kind&&o.l.side===side&&Math.abs(F.delta(o.s,s))<4))continue;
            const l=make({s,side,kind});if(!l||!covers(l,p))continue;
            const covered=pending.filter(t=>covers(l,t)),score=covered.length,margin=Math.min(...covered.map(t=>l.poolRadius-Math.hypot(t[0]-l.pool[0],t[1]-l.pool[2])));
            if(!best||score>best.score||score===best.score&&margin>best.margin)best={l,s,score,margin};
          }
        }
      }
      return best;
    };
    // Preserve the ordinary plan first. A narrow real footing can fall between
    // its 1.5m stations; refine only a failed required target search, over the
    // same +/-12m interval with identical support, gap, spacing and pool checks.
    const best=findSite(1.5)??findSite(.25);
    if(!best)throw new Error(`${A.id}: no supported lamp site covers safety target ${pending[0]}`);
    out.push({l:best.l,s:best.s,run:runNo});
  }

  // 3. A minor road (a spur) ending at a developed destination: one lantern at its end (ROAD.md §3 'other roads').
  if (!A.furnished && n > 3) {
    const endSt = S[n - 1]!;
    if (S.slice(Math.max(0, n - 6)).some(st => st.context === 'developed') && F.length > 12) place({ s: F.length - 4, side: endSt.right.gap ? 'left' : 'right', kind: 'roadLantern' });
  }

  // Order along the road, then name.
  out.sort((a, b) => a.s - b.s || (a.l.side < b.l.side ? -1 : 1));
  // The Water's Way (D-303, L2b): inside a low zone (STYLE rule 12, the Green's protected centre) a lantern is the island lantern's
  // low version, the 0.8 eu bollard, on its own spot (no arm: the head over the post). A bridge lantern on a deck's rail line stays
  // where it stands, below the 1.05 rail, so the bridge's guard is unchanged. The road keeps its ids and its sequence.
  const low = (l: LampSpot) => env.lowZones.some(zn => CORRIDOR.lampHeight > zn.maxHeight && Math.hypot(l.at[0] - zn.centre[0], l.at[2] - zn.centre[1]) < zn.radius);
  return out.map(({ l }, k) => ({ ...(low(l) ? { ...l, kind: 'bollard' as LampKind, head: [l.at[0], r3(l.at[1] + BOLLARD_HEIGHT), l.at[2]] as Point3, pool: [l.at[0], l.pool[1], l.at[2]] as Point3, poolRadius: BOLLARD_POOL } : l), id: `${A.id}.lamp.${k}` }));
}
