/** D-MR19, approved 2026-10-01. Fair the entry before the preserved first rail.
 * `roadFloor` samples the actual full-detail swept road triangles (paint lift excluded).
 * Both native and Horizon subsequently draw and query the same generated landingRows.
 * This does not promise a seamless full road width: the preserved rail rows overlap its
 * outer verge. The central +/-2.5m road corridor is measured separately in the proof. */
export function fairAwningEntry(branch,roadFloor){
  const rows=branch.landingRows.map((row,i)=>i<5?row.map(p=>{
    const road=roadFloor(p[0],p[2]);if(!road)throw new Error('Awning entry lost its drawn road support');
    return [p[0],road.y,p[2]];
  }):row);
  const points=branch.points.map((p,i)=>i<5?[p[0],rows[i][2][1],p[2]]:p);
  return {...branch,points,landingRows:rows};
}
