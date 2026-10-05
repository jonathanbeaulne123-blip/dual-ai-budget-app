/**
 * The building grammar (kit/buildings): every kind × dressing × tier draws finite geometry within its triangle
 * budget; collision is the plan's own solid parts (finite, non-empty when `collide`, walkable only where a floor,
 * deck or flat roof is drawn); the Journey shape is the record's footprint; everything is deterministic.
 */
import {describe,it,expect} from 'vitest';
import {CardBuilder} from '../src/harbour/art/cardScene.ts';
import {drawBuilding,buildingCollision,buildingJourneyShape,buildingPlan,collisionPartMesh,BUILDING_KINDS,BUILDING_TRI_BUDGET,buildingPalette,BUILDING_STYLES} from '../src/harbour/horizon/kit/buildings/index.ts';
import {buildingFixtures,fixtureGround,FIXTURE_KINDS} from '../src/harbour/horizon/kit/buildings/fixture.ts';
import type {BuildingRecord,DressingTheme} from '../src/harbour/horizon/neighbourhoods/types.ts';

const THEMES:DressingTheme[]=['classic','taylor','newfoundland'];
type Bucket={positions:number[]};
type Cells=Map<string,{data:Record<string,Bucket|{positions:number[]}>}>;
function stats(b:CardBuilder){
  const cells=(b as unknown as {cells:Cells}).cells;let tris=0,ink=0,nan=0,glow=0;
  for(const {data} of cells.values())for(const [k,v] of Object.entries(data)){
    if(!v||!Array.isArray((v as Bucket).positions))continue;const p=(v as Bucket).positions;
    for(const x of p)if(!Number.isFinite(x))nan++;
    if(k==='ink')ink+=p.length/6;else if(k==='checks'||k==='signs'||k==='dressing')continue;else{tris+=p.length/9;if(k==='glow')glow+=p.length/9;}}
  return {tris,ink,nan,glow};
}
const draw=(rec:BuildingRecord,theme:DressingTheme,tier:'full'|'lite')=>{const b=new CardBuilder(rec.id,tier,{ink:'#30251f'});drawBuilding(b,rec,theme,fixtureGround,tier);return stats(b);};
const recs=buildingFixtures();

describe('kit/buildings covers the contract',()=>{
  it('draws every BuildingKind and the fixture holds one of each',()=>{
    expect(new Set(FIXTURE_KINDS)).toEqual(new Set(BUILDING_KINDS));
    for(const k of BUILDING_KINDS)expect(BUILDING_TRI_BUDGET[k],k).toBeDefined();
  });
  it('authors every style sheet in all three dressings, and the dressings differ in construction',()=>{
    for(const s of BUILDING_STYLES){const [c,t,n]=THEMES.map(th=>buildingPalette(th,s));
      expect(c!.skin===t!.skin&&t!.skin===n!.skin,s).toBe(false);expect(new Set([c!.eave,t!.eave,n!.eave]).size,s).toBe(3);}
  });
});

describe('kit/buildings draws within budget, finite, every kind × dressing × tier',()=>{
  const table:string[]=[];
  for(const rec of recs)it(`${rec.kind} (${rec.id})`,()=>{
    const [full,lite]=BUILDING_TRI_BUDGET[rec.kind]!,row:number[]=[];
    for(const theme of THEMES){
      const f=draw(rec,theme,'full'),l=draw(rec,theme,'lite');
      expect(f.nan,`${rec.id} ${theme} full NaN`).toBe(0);expect(l.nan,`${rec.id} ${theme} lite NaN`).toBe(0);
      expect(f.tris,`${rec.id} ${theme} full`).toBeGreaterThan(10);
      expect(f.tris,`${rec.id} ${theme} full budget`).toBeLessThanOrEqual(full);
      expect(l.tris,`${rec.id} ${theme} lite budget`).toBeLessThanOrEqual(lite);
      expect(l.tris,`${rec.id} ${theme} lite ≤ full`).toBeLessThanOrEqual(f.tris);
      row.push(f.tris,l.tris);
    }
    table.push(`${rec.kind.padEnd(15)} ${rec.id.padEnd(14)} ${row.join(' / ')}  (budget ${full}/${lite})`);
    if(rec===recs[recs.length-1])console.log(`triangles full/lite: classic, taylor, newfoundland\n${table.join('\n')}`);
  });
  it('row houses stay within the district rule (≤ 400 full; lite much less)',()=>{
    for(const rec of recs.filter(r=>r.kind==='rowHouse'))for(const theme of THEMES){const f=draw(rec,theme,'full'),l=draw(rec,theme,'lite');expect(f.tris).toBeLessThanOrEqual(400);expect(l.tris).toBeLessThanOrEqual(f.tris*.6);}
  });
  it('lit windows and lamps go to the glow bucket (night) for every lived-in kind',()=>{
    for(const rec of recs.filter(r=>!['arch','hoodoo','wall','deck','platform','gate','windpump','liftTower','liftStation','barn','shed','hide'].includes(r.kind)))expect(draw(rec,'classic','full').glow,rec.id).toBeGreaterThan(0);
  });
});

describe('kit/buildings collision is what is drawn',()=>{
  it('every part is finite and non-degenerate; colliding records have parts',()=>{
    for(const rec of recs){const parts=buildingCollision(rec,fixtureGround);
      if(rec.collide)expect(parts.length,rec.id).toBeGreaterThan(0);else expect(parts.length,rec.id).toBe(0);
      for(const p of parts){
        if(p.kind==='box'){for(const v of [...p.centre,...p.size,p.yaw,p.bottom,p.top])expect(Number.isFinite(v),rec.id).toBe(true);expect(p.top,rec.id).toBeGreaterThan(p.bottom);expect(Math.min(...p.size),rec.id).toBeGreaterThan(0);}
        else{expect(p.corners.length,rec.id).toBeGreaterThanOrEqual(3);for(const c of p.corners){for(const v of c)expect(Number.isFinite(v),rec.id).toBe(true);expect(c[1],rec.id).toBeGreaterThanOrEqual(p.bottom-1e-9);}}
        const m=collisionPartMesh(p);expect(m.indices.length%3).toBe(0);for(const i of m.indices)expect(i).toBeLessThan(m.positions.length/3);
      }}
  });
  it('walkable parts are floors, decks and flat roofs; roofs on a pitch, walls and rails never are',()=>{
    for(const rec of recs)for(const p of buildingCollision(rec,fixtureGround)){
      if(p.walkable)expect(['deck','floor','roof'],`${rec.id} ${p.role}`).toContain(p.role);
      if(p.role==='wall'||p.role==='rail'||p.role==='support')expect(p.walkable,`${rec.id} ${p.role}`).toBe(false);
      if(p.walkable&&p.kind==='prism'){const ys=p.corners.map(c=>c[1]);if(p.role==='roof')expect(Math.max(...ys)-Math.min(...ys),rec.id).toBeLessThan(.01);}
    }
  });
  it('decks and platforms are walkable with 1.05 rails as walls; open structures leave their openings open',()=>{
    for(const rec of recs.filter(r=>r.kind==='deck'||r.kind==='platform')){const parts=buildingCollision(rec,fixtureGround),deckTop=parts.find(p=>p.walkable&&p.role==='deck');
      expect(deckTop,rec.id).toBeDefined();expect(deckTop!.kind==='box'&&Math.abs(deckTop!.top-rec.at[1])<1e-9).toBe(true);
      const rails=parts.filter(p=>p.role==='rail');expect(rails.length,rec.id).toBe(3);for(const r of rails)expect(r.kind==='box'&&Math.abs(r.top-rec.at[1]-1.05)<1e-9,rec.id).toBe(true);}
    // The pavilion's door side has no parapet; the campanile's belfry floor is walkable with rails at 1.05.
    const pav=recs.find(r=>r.kind==='pavilion')!,pr=buildingCollision(pav,fixtureGround).filter(p=>p.role==='rail');expect(pr.length).toBe(7);
    const camp=recs.find(r=>r.kind==='campanile')!,cp=buildingCollision(camp,fixtureGround),bf=cp.find(p=>p.walkable&&p.role==='floor');expect(bf).toBeDefined();
    const top=(p:typeof cp[number])=>p.kind==='box'?p.top:Math.max(...p.corners.map(c=>c[1]));
    const cr=cp.filter(p=>p.role==='rail');expect(cr.length).toBe(4);for(const r of cr)expect(top(r)-top(bf!)).toBeCloseTo(1.05,6);
  });
  it('the landmarks reach their story heights',()=>{
    const camp=recs.find(r=>r.kind==='campanile')!;expect(buildingJourneyShape(camp).roofHeight).toBeGreaterThan(30);
    const ww=recs.find(r=>r.kind==='chapel')!;expect(buildingJourneyShape(ww).roofHeight).toBeGreaterThanOrEqual(9.5);
    const el=recs.find(r=>r.kind==='elevator')!;expect(buildingJourneyShape(el).roofHeight).toBeGreaterThan(27);
    const wh=recs.find(r=>r.kind==='ferrisWheel')!;expect(buildingJourneyShape(wh).roofHeight).toBeCloseTo(16+13+.6,6);
    const lib=recs.find(r=>r.kind==='library')!;expect(buildingPlan(lib).eave+(buildingPlan(lib) as unknown as {rise:number}).rise).toBeCloseTo(5.2+9,6);
    for(const rec of recs){const top=Math.max(...buildingCollision(rec,fixtureGround).map(p=>p.kind==='box'?p.top:Math.max(...p.corners.map(c=>c[1]))),-Infinity);if(rec.collide)expect(top-rec.at[1],rec.id).toBeLessThanOrEqual(buildingJourneyShape(rec).roofHeight+1e-6);}
  });
});

describe('kit/buildings Journey shape and determinism',()=>{
  it('the Journey footprint is the record footprint (turned w × d) and heights are ordered',()=>{
    for(const yaw of [0,.7,-2.1])for(const rec0 of recs){const rec={...rec0,yaw,at:[rec0.at[0]+31,rec0.at[1],rec0.at[2]-17] as [number,number,number]},s=buildingJourneyShape(rec);
      expect(s.footprint.length).toBe(4);const cx=s.footprint.reduce((a,p)=>a+p[0],0)/4,cz=s.footprint.reduce((a,p)=>a+p[1],0)/4;expect(cx).toBeCloseTo(rec.at[0],6);expect(cz).toBeCloseTo(rec.at[2],6);
      expect(Math.hypot(s.footprint[1]![0]-s.footprint[0]![0],s.footprint[1]![1]-s.footprint[0]![1])).toBeCloseTo(rec.size.w,6);
      expect(Math.hypot(s.footprint[2]![0]-s.footprint[1]![0],s.footprint[2]![1]-s.footprint[1]![1])).toBeCloseTo(rec.size.d,6);
      expect(s.roofHeight,rec.id).toBeGreaterThanOrEqual(s.height);expect(s.height,rec.id).toBeGreaterThan(0);}
  });
  it('the same record draws the same triangles and the same collision, every time',()=>{
    for(const rec of recs){const pos=(t:DressingTheme)=>{const b=new CardBuilder('d','full',{ink:'#30251f'});drawBuilding(b,structuredClone(rec),t,fixtureGround,'full');const cells=(b as unknown as {cells:Cells}).cells;return [...cells.values()].map(c=>(c.data.card as Bucket).positions.slice(0,60).join(',')).join('|');};
      expect(pos('taylor')).toBe(pos('taylor'));expect(JSON.stringify(buildingCollision(structuredClone(rec),fixtureGround))).toBe(JSON.stringify(buildingCollision(rec,fixtureGround)));}
  });
});
