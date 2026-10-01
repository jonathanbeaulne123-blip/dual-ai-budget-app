/** Pure audit math. No runtime imports, writes, geography queries, or controller changes. */
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
// mountainRoadChain.append deduplicates coincident plan points and retains the Foot
// endpoint: [1282,54.65,720], aliasing native [1282,54.649977,720] by 23 micrometres.
// This allowance is for that named shared row only; it never moves a plan coordinate.
export const SHARED_FOOT_START_HEIGHT_TOLERANCE_M = 25e-6;
const SHARED_FOOT_START_WITNESS = {native:[1282,54.649977,720],chain:[1282,54.65,720]};
const POSITION_TOLERANCE_M = 2e-5;
export const planLength = points => points.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - points[i][0], p[2] - points[i][2]), 0);

/** Native source s is spatial arc; the chain uses cumulative horizontal segment length.
 * Match the exported source to this bake before pairing stations. Never use source s as plan s. */
export function nativeStationMap(source, roadPoints, chain) {
  const part = chain.parts.find(p => p.id === 'mountainV2.road');
  if (!part || !Array.isArray(source) || source.length < 2 || source.length !== roadPoints?.length) {
    return {valid: false, reason: 'native source and baked road sample counts do not match', samples: []};
  }
  let maxPositionErrorM = 0, plan = 0;
  const samples = source.map((p, i) => {
    const q = roadPoints[i];
    maxPositionErrorM = Math.max(maxPositionErrorM, Math.hypot(...p.at.map((v, j) => v - q[j])));
    if (i) plan += Math.hypot(q[0] - roadPoints[i - 1][0], q[2] - roadPoints[i - 1][2]);
    return {nativeS: p.s, chainS: part.from + plan, at: q};
  });
  const monotonic = samples.every((p, i) => Number.isFinite(p.nativeS) && (!i || p.nativeS > samples[i - 1].nativeS && p.chainS > samples[i - 1].chainS));
  const lengthErrorM = Math.abs(part.to - part.from - plan);
  const chainPoints = chain.points.filter((_,i) => chain.widths[i].s >= part.from-1e-6 && chain.widths[i].s <= part.to+1e-6);
  const chainErrors = chainPoints.length === roadPoints.length ? chainPoints.map((p,i) => Math.hypot(...p.map((v,j) => v-roadPoints[i][j]))) : null;
  const chainPointErrorM = chainErrors ? Math.max(...chainErrors) : Infinity;
  const previousPart = chain.parts[chain.parts.indexOf(part)-1], first = chainPoints[0], nativeStart = roadPoints[0];
  const witness = SHARED_FOOT_START_WITNESS;
  const sharedStart = chainErrors && previousPart?.id === 'mountainV2.footLane' && Math.abs(previousPart.to-part.from) <= 1e-9 && source[0].s === 0
    && first[0] === nativeStart[0] && first[2] === nativeStart[2] // exact horizontal equality; no widened plan tolerance
    && first[0] === witness.chain[0] && first[2] === witness.chain[2]
    && Math.abs(first[1]-witness.chain[1]) <= 1e-9 && Math.abs(nativeStart[1]-witness.native[1]) <= 1e-9
    && Math.abs(first[1]-nativeStart[1]) <= SHARED_FOOT_START_HEIGHT_TOLERANCE_M;
  const sharedStartHeightAlias = sharedStart && chainErrors[0] > POSITION_TOLERANCE_M ? {
    row:0,from:'mountainV2.footLane',to:part.id,chain:first,native:nativeStart,heightDifferenceM:first[1]-nativeStart[1],
    maximumHeightDifferenceM:SHARED_FOOT_START_HEIGHT_TOLERANCE_M,planCoordinates:'exactly equal',
    reason:'Coincident-plan Foot endpoint retained by mountainRoadChain.append; known 54.65 versus 54.649977 m shared-start height alias.'
  } : null;
  const chainMatches = chainErrors?.every((error,i) => error <= POSITION_TOLERANCE_M || i === 0 && sharedStartHeightAlias !== null);
  const valid = monotonic && maxPositionErrorM <= POSITION_TOLERANCE_M && chainMatches === true && lengthErrorM <= 1e-4;
  return {valid, reason: valid ? null : 'native source coordinates or length do not match this baked chain', maxPositionErrorM, chainPointErrorM, sharedStartHeightAlias, lengthErrorM,
    sourceUnits: 'native spatial metres', targetUnits: 'canonical chain plan metres, Prow to Summit', samples: valid ? samples : []};
}

export function nativeToChain(nativeS, mapping) {
  if (!mapping?.valid || !mapping.samples?.length) throw new Error('A matching full native source-to-baked-chain station map is required');
  const rows = mapping.samples;
  if (!Number.isFinite(nativeS) || nativeS < rows[0].nativeS - 1e-6 || nativeS > rows.at(-1).nativeS + 1e-6) throw new Error(`Native station outside mapping: ${nativeS}`);
  let lo = 0, hi = rows.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (rows[mid].nativeS <= nativeS) lo = mid; else hi = mid; }
  const a = rows[lo], b = rows[hi], t = Math.max(0, Math.min(1, (nativeS - a.nativeS) / (b.nativeS - a.nativeS)));
  return a.chainS + t * (b.chainS - a.chainS);
}

/** Derivatives of actual velocity and body heading over one controller step. These are
 * kinematics, not a friction coefficient or finite tyre-force/grip reserve. */
export function kinematics(before, after, dt, steer) {
  const oldSpeed = Math.hypot(before.vx, before.vz), speed = Math.hypot(after.vx, after.vz), moving = oldSpeed >= .25 && speed >= .25;
  const heading = after.yaw ?? after.heading, oldHeading = before.yaw ?? before.heading;
  const velocityHeading = speed >= .25 ? Math.atan2(after.vx, after.vz) : null;
  const velocityTurnRate = moving ? wrapAngle(velocityHeading - Math.atan2(before.vx, before.vz)) / dt : null;
  const headingTurnRate = wrapAngle(heading - oldHeading) / dt;
  return {velocity: [after.vx, after.vy, after.vz], heading, velocityHeading, headingTurnRate,
    velocityTurnRate, observedCurvature: velocityTurnRate === null ? null : velocityTurnRate / ((oldSpeed + speed) / 2),
    steer, steeringInputReserve: 1 - Math.abs(steer)};
}

/** Project a post-step pose near the driver's existing sample. A bounded local window
 * cannot switch to a neighbouring arm of a hairpin. Q is in travel order; s is canonical. */
export function localPlanStation(Q, k, x, z, closed = false) {
  let best = Infinity, station = Q[Math.max(0, Math.min(Q.length - 1, k))].s;
  for (let j = Math.max(0, k - 3); j < Math.min(Q.length - 1, k + 4); j++) {
    const a = Q[j], b = Q[j + 1], ax = a.cx ?? a.x, az = a.cz ?? a.z, bx = b.cx ?? b.x, bz = b.cz ?? b.z;
    if (closed && Math.abs(b.s - a.s) > 1) continue;
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const distance = Math.hypot(x - ax - t * dx, z - az - t * dz);
    if (distance < best) { best = distance; station = a.s + t * (b.s - a.s); }
  }
  return {stationPlanM: station, distanceFromCentreM: best};
}

/** Each native result's d is travel progress MINUS the initial 0.5 m spawn station.
 * Reversed and separately clipped reaches need their own baked from/to bounds. */
export function nativeSampleChainStation(sample, result, range) {
  if (Number.isFinite(sample.chainS)) return sample.chainS;
  if (!range || !Number.isFinite(sample.d)) return null;
  const travelS = Number.isFinite(sample.travelStationM) ? sample.travelStationM : sample.d + .5;
  const routeS = result.direction === 'reverse' ? result.pathLengthM - travelS : travelS;
  return range.from + routeS;
}

/** Completion uses the current pose, never the monotone progress high-water mark.
 * Preserve the audit's existing half-metre finish and one-metre lateral margins. */
export function currentProjectionFinishReached(current, pathLengthM) {
  return Number.isFinite(current.d) && Number.isFinite(current.off)
    && current.d >= pathLengthM - .5 && current.off < 1;
}
