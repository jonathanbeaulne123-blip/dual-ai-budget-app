import {describe,it,expect} from 'vitest';
import type {GrindDef,SkateSimEvent} from '../src/harbour/skate/contract.ts';
import {SKATE_FLIPS,SKATE_GRABS,SKATE_GRINDS,skateCatalogs,resolveGrind} from '../src/harbour/skate/tricks/catalog.ts';
import {airLabel,createSkateScore,spinLabel,stancePrefix,SCORE_TUNING} from '../src/harbour/skate/tricks/score.ts';

describe('trick catalogs',()=>{
  it('ships the vocabulary: ≥22 flips, ≥8 grabs, ≥14 grinds/slides, all well-formed',()=>{
    expect(SKATE_FLIPS.size).toBeGreaterThanOrEqual(22);expect(SKATE_GRABS.size).toBeGreaterThanOrEqual(8);expect(SKATE_GRINDS.size).toBeGreaterThanOrEqual(14);
    for(const [id,d] of SKATE_FLIPS){expect(d.id).toBe(id);expect(d.duration).toBeGreaterThan(.3);expect(d.points).toBeGreaterThan(0);expect(d.difficulty).toBeGreaterThanOrEqual(0);expect(d.difficulty).toBeLessThanOrEqual(1);expect(Math.abs(d.roll)+Math.abs(d.yaw)+Math.abs(d.pitch)).toBeGreaterThan(0);}
    for(const id of ['kickflip','heelflip','double-kickflip','double-heelflip','pop-shove-it','fs-shove-it','360-shove-it','fs-360-shove-it','varial-kickflip','varial-heelflip','hardflip','inward-heelflip','360-flip','laser-flip','impossible','dolphin-flip'])expect(SKATE_FLIPS.has(id),id).toBe(true);
    for(const id of ['indy','melon','stalefish','mute','tail-grab','nose-grab','method'])expect(SKATE_GRABS.has(id),id).toBe(true);
    for(const id of ['50-50','5-0','nosegrind','crooked','overcrook','smith','feeble','suski','salad','boardslide','lipslide','noseslide','tailslide','bluntslide','noseblunt'])expect(SKATE_GRINDS.has(id),id).toBe(true);
    expect(skateCatalogs()).toEqual({flips:SKATE_FLIPS,grinds:SKATE_GRINDS,grabs:SKATE_GRABS});
    expect([...SKATE_FLIPS.values()].some(d=>/ollie|nollie|switch|fakie/i.test(d.id))).toBe(false);
  });
  it('board motion is honest: kick +roll, heel −roll, backside shove +yaw, tre = kick + 360 bs shove, impossible pitches',()=>{
    const f=(id:string)=>SKATE_FLIPS.get(id)!;
    expect([f('kickflip').roll,f('heelflip').roll]).toEqual([1,-1]);
    expect([f('pop-shove-it').yaw,f('fs-shove-it').yaw,f('360-shove-it').yaw]).toEqual([1,-1,2]);
    expect(f('360-flip')).toMatchObject({roll:1,yaw:2});expect(f('laser-flip')).toMatchObject({roll:-1,yaw:-2});
    expect(f('varial-kickflip')).toMatchObject({roll:1,yaw:1});expect(f('hardflip')).toMatchObject({roll:1,yaw:-1});expect(f('inward-heelflip')).toMatchObject({roll:-1,yaw:1});
    expect(f('impossible').pitch).toBe(1);expect(f('dolphin-flip').pitch).toBe(-1);expect(f('double-kickflip').roll).toBe(2);
    expect(f('360-flip').points).toBeGreaterThan(f('kickflip').points);expect(f('kickflip').duration).toBeLessThan(f('360-flip').duration);
  });
  it('grind defs are distinct points in (contact, deckYaw, deckPitch) space',()=>{
    const seen=new Set<string>();
    for(const g of SKATE_GRINDS.values()){const k=`${g.contact}|${g.deckYaw.toFixed(2)}|${g.deckPitch.toFixed(2)}`;expect(seen.has(k),g.id).toBe(false);seen.add(k);}
    const g=(id:string)=>SKATE_GRINDS.get(id)!;
    expect(g('50-50').deckYaw).toBe(0);expect(Math.abs(g('boardslide').deckYaw)).toBeCloseTo(Math.PI/2,6);
    expect(g('5-0').deckPitch).toBeLessThan(0);expect(g('nosegrind').deckPitch).toBeGreaterThan(0);
    expect(Math.sign(g('smith').deckYaw)).toBe(-Math.sign(g('feeble').deckYaw));expect(Math.sign(g('crooked').deckYaw)).toBe(-Math.sign(g('overcrook').deckYaw));
    expect(Math.sign(g('boardslide').deckYaw)).toBe(-Math.sign(g('lipslide').deckYaw));
  });
  it('resolveGrind picks every def from its own approach, by sign or by face side',()=>{
    const leanFor=(d:GrindDef)=>d.contact==='front-truck'||d.contact==='nose'?.8:d.contact==='back-truck'||d.contact==='tail'?(d.deckYaw!==0&&d.deckPitch<0&&d.contact==='back-truck'?-.85:-.6):0;
    for(const d of SKATE_GRINDS.values()){
      const over=d.id==='bluntslide'||d.id==='noseblunt';
      expect(resolveGrind({deckYawToLine:d.deckYaw,lean:leanFor(d),overLine:over,faceSide:0,frontside:true}),d.id).toBe(d.id);
      if(d.deckYaw!==0&&d.contact!=='nose'&&d.contact!=='tail'){
        // Same pick from the ledge face instead of the signed angle: + toward the face = near side.
        expect(resolveGrind({deckYawToLine:Math.abs(d.deckYaw),lean:leanFor(d),overLine:over,faceSide:d.deckYaw<0?1:-1,frontside:false}),`${d.id} face`).toBe(d.id);
      }
    }
    // Pointing back along the line (riding the board backwards onto it) mirrors the side.
    expect(resolveGrind({deckYawToLine:Math.PI-.38,lean:-.5,overLine:false,faceSide:0,frontside:true})).toBe('smith');
    expect(resolveGrind({deckYawToLine:NaN,lean:NaN,overLine:false,faceSide:0,frontside:true})).toBe('50-50');
  });
});

describe('trick names',()=>{
  it('composes names the way a skater says them',()=>{
    expect(stancePrefix({from:'nose'})).toBe('Nollie');expect(stancePrefix({from:'tail',switch:true})).toBe('Switch');expect(stancePrefix({from:'tail',fakie:true})).toBe('Fakie');
    expect(spinLabel(185)).toBe('Frontside 180');expect(spinLabel(-350)).toBe('Backside 360');expect(spinLabel(540)).toBe('Frontside 540');expect(spinLabel(120)).toBe('');
    expect(airLabel({prefix:'Nollie',spinDeg:-180,flipId:'heelflip'})).toBe('Nollie Backside 180 Heelflip');
    expect(airLabel({prefix:'Fakie',spinDeg:360,flipId:null})).toBe('Fakie Frontside 360');
    expect(airLabel({prefix:'Switch',spinDeg:0,flipId:'varial-kickflip'})).toBe('Switch Varial Kickflip');
    expect(airLabel({prefix:'',spinDeg:0,flipId:null,grab:{id:'indy',seconds:1.2}})).toBe('Indy (1.2s)');
    expect(airLabel({prefix:'',spinDeg:0,flipId:'kickflip',grab:{id:'indy',seconds:.3}})).toBe('Kickflip Indy');
    expect(airLabel({prefix:'',spinDeg:0,flipId:null})).toBe('Ollie');expect(airLabel({prefix:'Nollie',spinDeg:0,flipId:null})).toBe('Nollie');
    expect(airLabel({prefix:'Fakie',spinDeg:0,flipId:null})).toBe('Fakie Ollie');expect(airLabel({prefix:'Switch',spinDeg:0,flipId:null})).toBe('Switch Ollie');
    expect(airLabel({prefix:'',spinDeg:0,flipId:null,late:['kickflip']})).toBe('Late Kickflip');
    expect(airLabel({prefix:'',spinDeg:0,flipId:'heelflip',late:['kickflip']})).toBe('Heelflip Late Kickflip');
  });
});

/* ------------------------------------------------------------------ scoring */
let T=0;
const at=(dt=0)=>(T+=dt);
const pop=(o:Partial<Extract<SkateSimEvent,{kind:'pop'}>>={}):SkateSimEvent=>({t:at(),kind:'pop',from:'tail',switch:false,fakie:false,height:.5,flipId:null,fromFeature:null,...o});
const land=(o:Partial<Extract<SkateSimEvent,{kind:'land'}>>={}):SkateSimEvent=>({t:at(),kind:'land',spinDeg:0,boardClean:1,fakie:false,switch:false,airTime:.6,gap:0,onFeature:null,revert:false,...o});
const caught=(flipId:string,quality=1):SkateSimEvent=>({t:at(),kind:'flip-caught',flipId,quality});

describe('scoring',()=>{
  it('names and scores a composed line, then banks it after the keep-alive',()=>{
    T=0;const s=createSkateScore({stance:'regular'});
    s.step([pop({from:'nose',flipId:'heelflip'})],at(.1));
    expect(s.line()).toMatchObject({active:true,keepAlive:1});
    at(.5);s.step([caught('heelflip'),land({spinDeg:-182})],T);
    expect(s.line().latest).toBe('Nollie Backside 180 Heelflip');
    s.step([{t:at(.05),kind:'manual-start',manual:'manual',distance:0,seconds:0}],T);
    s.step([{t:at(1.2),kind:'manual-end',manual:'manual',distance:4,seconds:1.2}],T);
    expect(s.line().tricks.map(k=>k.label)).toEqual(['Nollie Backside 180 Heelflip to Manual']);
    // Pop off the manual onto a ledge: kickflip into a smith, transfer to nosegrind.
    s.step([pop({flipId:'kickflip'}),caught('kickflip',.8)],at(.1));
    s.step([{t:at(.3),kind:'grind-start',grindId:'smith',grindableId:'ledge-a',kind2:'ledge',switch:false,fakie:false,frontside:false} as SkateSimEvent],T);
    s.step([{t:at(.8),kind:'grind-end',grindId:'smith',grindableId:'ledge-a',distance:3,seconds:.8,exit:'transfer'}],T);
    s.step([{t:at(.1),kind:'grind-start',grindId:'nosegrind',grindableId:'ledge-b',kind2:'ledge',switch:false,fakie:false}],T);
    s.step([{t:at(.6),kind:'grind-end',grindId:'nosegrind',grindableId:'ledge-b',distance:2,seconds:.6,exit:'ollie'}],T);
    at(.5);s.step([pop(),land({gap:3.2,airTime:.5})],T);
    const line=s.line();
    expect(line.tricks.map(k=>k.label)).toEqual(['Nollie Backside 180 Heelflip to Manual','Kickflip to Backside Smith Grind to Nosegrind','Ollie','Gap']);
    expect(line.multiplier).toBe(4);expect(line.base).toBe(line.tricks.reduce((a,k)=>a+k.points,0));
    expect(line.keepAlive).toBe(1);
    expect(s.step([],at(.75))).toEqual([]);expect(s.line().keepAlive).toBeCloseTo(.5,6);
    const out=s.step([],at(.8));
    expect(out).toEqual([{kind:'banked',points:line.base*4,tricks:line.tricks.map(k=>k.label)}]);
    expect(s.line()).toMatchObject({active:false,tricks:[],base:0,multiplier:1,latest:null});
  });
  it('names the examples: Fakie Frontside 360, Switch Varial Kickflip, Frontside Boardslide, 50-50 to Nosegrind, Indy (1.2s), Rock to Fakie, Revert',()=>{
    T=100;const s=createSkateScore();const labels=()=>s.line().tricks.map(k=>k.label);
    s.step([pop({fakie:true}),land({spinDeg:361,fakie:false})],at(.5));
    s.step([pop({switch:true,flipId:'varial-kickflip'}),caught('varial-kickflip'),land({switch:true})],at(.5));
    s.step([pop(),{t:at(.2),kind:'grind-start',grindId:'boardslide',grindableId:'rail',kind2:'round-rail',switch:false,fakie:false,frontside:true} as SkateSimEvent],T);
    s.step([{t:at(.5),kind:'grind-end',grindId:'boardslide',grindableId:'rail',distance:2,seconds:.5,exit:'roll'}],T);
    s.step([{t:at(.2),kind:'grind-start',grindId:'50-50',grindableId:'c',kind2:'coping',switch:false,fakie:false},{t:at(.4),kind:'grind-end',grindId:'50-50',grindableId:'c',distance:1,seconds:.4,exit:'transfer'},{t:at(.1),kind:'grind-start',grindId:'nosegrind',grindableId:'c2',kind2:'coping',switch:false,fakie:false},{t:at(.4),kind:'grind-end',grindId:'nosegrind',grindableId:'c2',distance:1,seconds:.4,exit:'roll'}],T);
    s.step([pop(),{t:at(.1),kind:'grab-start',grabId:'indy',seconds:0},{t:at(1.2),kind:'grab-end',grabId:'indy',seconds:1.2},land({airTime:1.4})],T);
    s.step([{t:at(.3),kind:'lip-trick',id:'rock-to-fakie'},{t:at(.1),kind:'revert'}],T);
    s.step([pop({flipId:'kickflip'}),caught('kickflip'),land({revert:true})],at(.3));
    expect(labels()).toEqual(['Fakie Frontside 360','Switch Varial Kickflip','Ollie to Frontside Boardslide','50-50 to Nosegrind','Indy (1.2s)','Rock to Fakie Revert','Kickflip Revert']);
  });
  it('names the way onto a grind: Ollie to 50-50, Kickflip to Boardslide (one trick, worth both)',()=>{
    T=0;const s=createSkateScore();const labels=()=>s.line().tricks.map(k=>k.label);
    const on=(id:string,extra:Partial<Record<string,unknown>>={})=>({t:at(.3),kind:'grind-start',grindId:id,grindableId:'r',kind2:'round-rail',switch:false,fakie:false,...extra}) as SkateSimEvent;
    const off=(id:string)=>({t:at(.6),kind:'grind-end',grindId:id,grindableId:'r',distance:2,seconds:.6,exit:'roll'}) as SkateSimEvent;
    s.step([pop(),on('50-50')],T);s.step([off('50-50')],T);
    s.step([pop({flipId:'kickflip'}),caught('kickflip'),on('boardslide',{frontside:false})],T);s.step([off('boardslide')],T);
    // Rolling onto a ledge without a pop is just the grind.
    s.step([on('5-0')],T);s.step([off('5-0')],T);
    expect(labels()).toEqual(['Ollie to 50-50','Kickflip to Backside Boardslide','5-0 Grind']);
    const [a,b,c]=s.line().tricks.map(k=>k.points);
    expect(b!).toBeGreaterThan(a!);expect(a!).toBeGreaterThan(c!*.9);
  });
  it('flick-it upgrades: a flip read further on after the pop is the popped trick, not a late one',()=>{
    T=0;const s=createSkateScore();const labels=()=>s.line().tricks.map(k=>k.label);
    // Keys pop on the first flick; the rest of a double lands in the air as its upgrade.
    s.step([pop({flipId:'kickflip'})],T);s.step([{t:at(.25),kind:'late-flip',flipId:'double-kickflip'},caught('double-kickflip')],T);at(.4);s.step([land()],T);
    // A corner corrected a beat late (ollie read, then kickflip) — within upgradeS.
    at(.5);s.step([pop()],T);s.step([{t:at(.08),kind:'late-flip',flipId:'kickflip'},caught('kickflip')],T);at(.4);s.step([land()],T);
    // Ollie → impossible (the up-down-up carries on from the ollie's up).
    at(.5);s.step([pop()],T);s.step([{t:at(.3),kind:'late-flip',flipId:'impossible'},caught('impossible')],T);at(.3);s.step([land()],T);
    // A real late flip: later, and not a continuation.
    at(.5);s.step([pop()],T);s.step([{t:at(.3),kind:'late-flip',flipId:'heelflip'},caught('heelflip')],T);at(.3);s.step([land()],T);
    expect(labels()).toEqual(['Double Kickflip','Kickflip','Impossible','Late Heelflip']);
  });
  it('style counts: clean catches, spins and switch score more than sloppy plain ones',()=>{
    const one=(events:SkateSimEvent[])=>{T=0;const s=createSkateScore();s.step(events,at(.5));return s.line().tricks[0]!.points;};
    const clean=one([pop({flipId:'kickflip'}),caught('kickflip',1),land()]),sloppy=one([pop({flipId:'kickflip'}),caught('kickflip',.1),land({boardClean:.2})]);
    expect(clean).toBeGreaterThan(sloppy);
    expect(one([pop({flipId:'kickflip'}),caught('kickflip'),land({spinDeg:180})])).toBeGreaterThan(clean);
    expect(one([pop({flipId:'kickflip',switch:true}),caught('kickflip'),land()])).toBeGreaterThan(clean);
    expect(one([pop({flipId:'360-flip'}),caught('360-flip'),land()])).toBeGreaterThan(clean);
  });
  it('repeats inside a line are worth less, and do not raise the multiplier',()=>{
    T=0;const s=createSkateScore();
    for(let i=0;i<3;i++)s.step([pop({flipId:'kickflip'}),caught('kickflip'),land()],at(.5));
    const [a,b,c]=s.line().tricks;
    expect(b!.points).toBe(Math.round(a!.points*SCORE_TUNING.repeatDecay));expect(c!.points).toBe(Math.round(a!.points*SCORE_TUNING.repeatDecay**2));
    expect(s.line().multiplier).toBe(1);
  });
  it('a bail loses the line and reports what was lost',()=>{
    T=0;const s=createSkateScore();
    s.step([pop({flipId:'kickflip'}),caught('kickflip'),land()],at(.5));
    s.step([pop({flipId:'hardflip'})],at(.2));
    const lost=s.line().base*s.line().multiplier;
    const out=s.step([{t:at(.3),kind:'bail',reason:'flip-not-caught'}],T);
    expect(out).toEqual([{kind:'lost',points:lost,reason:'flip-not-caught'}]);
    expect(s.line().active).toBe(false);
    expect(s.step([{t:at(1),kind:'bail',reason:'wall'}],T)).toEqual([]); // nothing to lose
  });
  it('stays alive while busy: a long grind or manual never times the line out',()=>{
    T=0;const s=createSkateScore();
    s.step([pop({flipId:'kickflip'}),caught('kickflip'),land()],at(.5));
    s.step([{t:at(.2),kind:'manual-start',manual:'nose-manual',distance:0,seconds:0}],T);
    expect(s.step([],at(3))).toEqual([]);expect(s.line().keepAlive).toBe(1);
    s.step([{t:at(0),kind:'manual-end',manual:'nose-manual',distance:9,seconds:3}],T);
    expect(s.line().tricks.map(k=>k.label)).toEqual(['Kickflip','Nose Manual']);
    expect(s.bank()[0]).toMatchObject({kind:'banked',tricks:['Kickflip','Nose Manual']});
    s.step([pop()],at(.1));s.step([land()],at(.5));
    expect(s.drop('paused')).toMatchObject([{kind:'lost',reason:'paused'}]);
  });
  it('is deterministic',()=>{
    const runLine=()=>{T=0;const s=createSkateScore();s.step([pop({flipId:'laser-flip'}),caught('laser-flip',.7),{t:at(.1),kind:'grab-start',grabId:'melon',seconds:0},{t:at(.4),kind:'grab-end',grabId:'melon',seconds:.4},land({spinDeg:-190,gap:4})],at(.2));return s.step([],at(5));};
    expect(runLine()).toEqual(runLine());
    expect(runLine()[0]).toMatchObject({kind:'banked',tricks:['Backside 180 Laser Flip Melon','Gap']});
  });
});
