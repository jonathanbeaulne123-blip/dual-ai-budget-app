import {describe,it,expect} from 'vitest';
import {MOUNTAIN_ROAD_LINE} from '../src/harbour/mountain/roads.ts';
import {ROAD_CENTRE} from '../src/harbour/mountain/roadLine.ts';

// D-MR19/20 authorize three local edge repairs, never a moved route, altered bridge,
// narrowed carriageway or replanted mountain. These bounds are the approved proof.
describe('approved native road frame repair',()=>{
  const samples=MOUNTAIN_ROAD_LINE.samples;
  it('preserves every authored centre and scenery frame within the measured edge envelope',()=>{
    expect(samples).toHaveLength(ROAD_CENTRE.length);
    let changed=0,maxShift=0;
    samples.forEach((s,i)=>{
      expect(s.at).toEqual(ROAD_CENTRE[i]);
      const a=ROAD_CENTRE[Math.max(0,i-1)]!,b=ROAD_CENTRE[Math.min(samples.length-1,i+1)]!;
      const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),normal=[dz/length,0,-dx/length];
      expect(s.placementNormal??s.normal).toEqual(normal);
      if(s.placementNormal){changed++;expect((i>=115&&i<=153)||(i>=172&&i<=210)||(i>=848&&i<=886)).toBe(true);}
      if(s.bridgeId)expect(s.normal).toEqual(normal);
      const perpendicular=s.normal[0]*normal[0]!+s.normal[2]*normal[2]!;
      expect(perpendicular).toBeCloseTo(1,12);
      maxShift=Math.max(maxShift,s.halfWidth*Math.hypot(s.normal[0]-normal[0]!,s.normal[2]-normal[2]!));
    });
    expect(changed).toBe(117);expect(maxShift).toBeLessThanOrEqual(.666);
  });
  it('has no folded drawn triangles across the full road width',()=>{
    const rows=samples.map(s=>[-s.halfWidth,-s.halfWidth+.55,-.45,.45,s.halfWidth-.55,s.halfWidth].map(w=>[s.at[0]+s.normal[0]*w,s.at[2]+s.normal[2]*w]));
    const signs:number[]=[];
    for(let i=1;i<rows.length;i++)for(let k=1;k<rows[i]!.length;k++){
      const a=rows[i-1]![k-1]!,b=rows[i]![k-1]!,c=rows[i]![k]!,d=rows[i-1]![k]!;
      for(const [p,q,r] of [[a,b,c],[a,c,d]])signs.push((q![0]!-p![0]!)*(r![1]!-p![1]!)-(q![1]!-p![1]!)*(r![0]!-p![0]!));
    }
    expect(signs.every(s=>s>1e-8)||signs.every(s=>s< -1e-8)).toBe(true);
  });
});
