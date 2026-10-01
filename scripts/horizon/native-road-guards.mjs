/** Read-only audit ownership. Authored edge guards still constrain measured width and
 * controller contact. Only their ordinary edge placement is exempt from scenery/obstruction. */
export function nativeRoadGuardOwnership({solids, runs, line, offset}) {
  const key = p => p.map(v => v.toFixed(6)).join(',');
  const samples = new Map(), indices = new Map(line.samples.map((s,i)=>[s,i]));
  for (const s of line.samples) for (const [side, sign] of [['left', 1], ['right', -1]]) {
    samples.set(`${side}:${key([s.at[0] + s.normal[0] * s.halfWidth * sign, s.at[1], s.at[2] + s.normal[2] * s.halfWidth * sign])}`, s);
  }
  const source = new Map(solids.map(s => [s.id, s])), guards = new Map();
  for (const run of runs) {
    if (run.line !== line.id || run.kind === 'kerb') continue;
    for (let k = 0; k < run.points.length - 1; k += 2) {
      const a = run.points[k], b = run.points[Math.min(k + 2, run.points.length - 1)];
      const ca = samples.get(`${run.side}:${key(a)}`), cb = samples.get(`${run.side}:${key(b)}`), solid = source.get(`${run.id}:${k}`);
      // Geometry and ownership must agree; unknown or moved geometry stays a finding.
      if (!ca || !cb || !solid || solid.thickness !== (run.kind === 'wall' ? .7 : .3) || Math.hypot(solid.a[0] - a[0], solid.a[1] - a[2], solid.b[0] - b[0], solid.b[1] - b[2]) > .001) continue;
      guards.set(`mountainV2:${solid.id}`, {a, b, ca: ca.at, cb: cb.at, before:line.samples[indices.get(ca)-1]?.at, after:line.samples[indices.get(cb)+1]?.at, thickness:solid.thickness});
    }
  }
  return (id, p, half, probeRadius = 0) => {
    const q = guards.get(id); if (!q) return false;
    const x = p.x - offset.x, y = p.y - offset.y, z = p.z - offset.z;
    const dx = q.cb[0] - q.ca[0], dz = q.cb[2] - q.ca[2], l2 = dx * dx + dz * dz;
    if (l2 < 1e-8) return false;
    const t = ((x - q.ca[0]) * dx + (z - q.ca[2]) * dz) / l2;
    // Contact capsules also meet a guard's end just outside its centreline span.
    // Verify the actual adjacent source segment and physical endpoint, never an
    // extrapolated chord or a wider station tolerance. No radius means no cap.
    if(t<0||t>1){
      if(!(probeRadius>0))return false;
      const start=t<0, a=start?q.before:q.cb, b=start?q.ca:q.after, edge=start?q.a:q.b;
      if(!a||!b)return false;
      const dx=b[0]-a[0],dz=b[2]-a[2],l2=dx*dx+dz*dz;
      if(l2<1e-8)return false;
      const u=((x-a[0])*dx+(z-a[2])*dz)/l2;
      if(u<0||u>1||Math.hypot(x-a[0]-u*dx,z-a[2]-u*dz)>.1||Math.abs(y-a[1]-u*(b[1]-a[1]))>.1)return false;
      const ex=edge[0]-x,ez=edge[2]-z,along=Math.abs(ex*p.tx+ez*p.tz),lateral=Math.abs(ex*-p.tz+ez*p.tx);
      return along<=probeRadius+q.thickness/2&&lateral>=half-.1&&lateral<=half+.1;
    }
    // Restrict ownership to THIS segment's road station and level, including at hairpins.
    if ( Math.hypot(x - q.ca[0] - t * dx, z - q.ca[2] - t * dz) > .1 || Math.abs(y - q.ca[1] - t * (q.cb[1] - q.ca[1])) > .1) return false;
    const ex = q.a[0] + t * (q.b[0] - q.a[0]) - x, ez = q.a[2] + t * (q.b[2] - q.a[2]) - z;
    const lateral = Math.abs(ex * -p.tz + ez * p.tx);
    // The authored centre must remain on the edge (10 cm chord/resampling tolerance).
    // A rail that intrudes farther into the carriageway remains a MAJOR obstruction.
    return lateral >= half - .1 && lateral <= half + .1;
  };
}
