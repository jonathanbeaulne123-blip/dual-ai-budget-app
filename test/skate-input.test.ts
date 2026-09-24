import {describe,it,expect} from 'vitest';
import type {SkateIntent} from '../src/harbour/skate/contract.ts';
import {SKATE_FLIPS} from '../src/harbour/skate/tricks/catalog.ts';
import {buildFlickTable,createFlickRecogniser,gestureFor,gesturePath,gestureSamples,gestureSegments,recogniseGesture,FLICK_DIRS,type FlickCompletion,type StickSample} from '../src/harbour/skate/input/flick.ts';
import {createSkateInput,pickGrab,skateFacing,type SkateInput} from '../src/harbour/skate/input/index.ts';
import {createDigitalStick} from '../src/harbour/skate/input/keyboard.ts';
import type {PadLike} from '../src/harbour/skate/input/gamepad.ts';

const ALL:(string|null)[]=[null,...SKATE_FLIPS.keys()];

function play(samples:readonly StickSample[],facing:1|-1=1,digital=false):FlickCompletion[] {
  const r=createFlickRecogniser({digital});r.setFacing(facing);
  const out:FlickCompletion[]=[];
  for(const s of samples){r.feed(s.t,s.x,s.y);for(let c=r.take();c;c=r.take())out.push(c);}
  const end=(samples[samples.length-1]?.t??0)+600;r.tick(end);for(let c=r.take();c;c=r.take())out.push(c);
  return out;
}

describe('flick table',()=>{
  it('has ≥22 flip defs, every gesture unique and starting on the tail',()=>{
    expect(SKATE_FLIPS.size).toBeGreaterThanOrEqual(22);
    const table=buildFlickTable();
    expect(table.size).toBe(SKATE_FLIPS.size+1);
    for(const def of SKATE_FLIPS.values()){expect(def.gesture[0]).toBe('tail');expect(recogniseGesture(def.gesture)).toBe(def.id);}
    expect(recogniseGesture(['tail','nose'])).toBeNull();
    expect(recogniseGesture(['tail','heel'])).toBeUndefined();
  });
  it('no gesture is a jumbled copy of another: every transition is a 45° rim step or a ≥135° flick',()=>{
    for(const id of ALL)for(const seg of gestureSegments(id)){expect(Math.abs(seg.steps)===1||Math.abs(seg.steps)>=3).toBe(true);}
  });
  it('draws gesture paths in screen space, mirrored for goofy',()=>{
    const reg=gesturePath('kickflip','regular'),goofy=gesturePath('kickflip','goofy');
    expect(reg[0]).toEqual({x:0,y:-1});
    expect(reg.at(-1)!.x).toBeLessThan(0);expect(reg.at(-1)!.y).toBeGreaterThan(0); // regular kick = up-left (heels on the left)
    expect(goofy.at(-1)!.x).toBeCloseTo(-reg.at(-1)!.x,6);
    expect(gesturePath('360-flip').length).toBeGreaterThan(20);
    expect(gesturePath('nollie-nothing')).toEqual([]);
    expect(gesturePath(null,'regular','nose')[0]).toEqual({x:0,y:1});
  });
});

describe('flick recogniser',()=>{
  it('reaches every flip (and the ollie) for regular, goofy, switch and fakie, tail and nose loads',()=>{
    for(const stance of ['regular','goofy'] as const)for(const riding of [{},{switch:true},{fakie:true}])for(const origin of ['tail','nose'] as const){
      const facing=skateFacing(stance,riding);
      for(const id of ALL){
        const got=play(gestureSamples(id,{facing,origin}),facing);
        expect(got.map(c=>[c.flipId,c.from]),`${stance} ${JSON.stringify(riding)} ${origin} ${id}`).toEqual([[id,origin]]);
      }
    }
  });
  it('a gesture drawn for the other stance is a different (mirrored) trick, not the same one',()=>{
    const got=play(gestureSamples('kickflip',{facing:1}),-1);
    expect(got.map(c=>c.flipId)).toEqual(['heelflip']);
  });
  it('recognises sloppier, slower and curved thumbs within the windows',()=>{
    for(const id of ALL){
      expect(play(gestureSamples(id,{stepMs:70,flickMs:120,hz:60})).map(c=>c.flipId),`${id} slow`).toEqual([id]);
    }
    // A kickflip flick that curves and nicks the tail-heel rim on the way up.
    const t0=0,s:StickSample[]=[];for(let i=0;i<12;i++)s.push({t:t0+i*8,x:0,y:-1});
    s.push({t:100,x:-.72,y:-.7},{t:108,x:-.5,y:-.2},{t:116,x:-.55,y:.35},{t:124,x:-.7,y:.71},{t:132,x:-.7,y:.71},{t:150,x:0,y:0},{t:170,x:0,y:0});
    expect(play(s).map(c=>c.flipId)).toEqual(['kickflip']);
    // Landing a sector off and correcting straight away.
    const s2:StickSample[]=[];for(let i=0;i<12;i++)s2.push({t:i*8,x:0,y:-1});
    s2.push({t:100,x:0,y:-.3},{t:108,x:-.1,y:.99},{t:120,x:-.7,y:.71},{t:150,x:0,y:0},{t:190,x:0,y:0});
    expect(play(s2).map(c=>c.flipId)).toEqual(['kickflip']);
  });
  it('a thumb that overshoots keeps the trick it already made',()=>{
    const s:StickSample[]=[];for(let i=0;i<12;i++)s.push({t:i*8,x:0,y:-1});
    // Kickflip flick, then the thumb slides on round to the heel side and hangs there.
    s.push({t:100,x:-.2,y:-.2},{t:108,x:-.7,y:.71},{t:130,x:-1,y:0},{t:200,x:-1,y:0},{t:400,x:-1,y:0});
    expect(play(s).map(c=>c.flipId)).toEqual(['kickflip']);
    // Half sweep that runs past the nose to the toe side: the inward heelflip it passed through.
    const g=gestureSamples('inward-heelflip',{t0:0});const last=g.at(-3)!;
    const over=[...g.slice(0,-2),{t:last.t+8,x:1,y:0},{t:last.t+300,x:1,y:0}];
    expect(play(over).map(c=>c.flipId)).toEqual(['inward-heelflip']);
  });
  it('flick strength follows flick speed',()=>{
    const fast=play(gestureSamples(null,{flickMs:30}))[0]!,slow=play(gestureSamples(null,{flickMs:150}))[0]!;
    expect(fast.strength).toBeGreaterThan(slow.strength);expect(fast.strength).toBeLessThanOrEqual(1);expect(slow.strength).toBeGreaterThanOrEqual(.35);
  });
  it('slow wandering never pops',()=>{
    // Tail to nose over 700 ms.
    const a:StickSample[]=[];for(let i=0;i<=84;i++){const u=i/84;a.push({t:i*8.33,x:0,y:-1+2*u});}
    a.push({t:720,x:0,y:0});
    expect(play(a)).toEqual([]);
    // A slow lap of the rim.
    const b:StickSample[]=[];for(let i=0;i<=120;i++){const ang=Math.PI+i/120*2*Math.PI;b.push({t:i*10,x:Math.sin(ang),y:Math.cos(ang)});}
    b.push({t:1300,x:0,y:0});
    expect(play(b)).toEqual([]);
    // Deterministic noisy drift around the middle.
    let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
    const c:StickSample[]=[];let x=0,y=0;for(let i=0;i<600;i++){x=Math.max(-.6,Math.min(.6,x+(rnd()-.5)*.08));y=Math.max(-.6,Math.min(.6,y+(rnd()-.5)*.08));c.push({t:i*8,x,y});}
    expect(play(c)).toEqual([]);
    // Pull back and let go: a load is not a pop.
    expect(play([{t:0,x:0,y:-.5},{t:8,x:0,y:-1},{t:200,x:0,y:-1},{t:210,x:0,y:0},{t:260,x:0,y:0}])).toEqual([]);
  });
  it('separates a gentle manual tilt from a full crouch',()=>{
    const r=createFlickRecogniser();
    for(let t=0;t<=400;t+=8)r.feed(t,.02,-.4);
    expect(r.held(400)).toEqual({crouch:0,crouchEnd:null,manual:'manual'});
    for(let t=408;t<=460;t+=8)r.feed(t,0,-1);
    const h=r.held(460);expect(h.crouch).toBe(1);expect(h.crouchEnd).toBe('tail');
    // Popping out of an established manual keeps it until the pop.
    expect(h.manual).toBe('manual');
    const n=createFlickRecogniser();for(let t=0;t<=200;t+=8)n.feed(t,0,.45);
    expect(n.held(200).manual).toBe('nose-manual');
    // A normal quick pull-back passes through the manual zone without starting one.
    const q=createFlickRecogniser();q.feed(0,0,-.3);q.feed(40,0,-.5);q.feed(60,0,-1);
    expect(q.held(300)).toEqual({crouch:1,crouchEnd:'tail',manual:null});
  });
  it('keeps every gesture string within the eight directions',()=>{
    for(const id of ALL)for(const d of gestureFor(id)!)expect(FLICK_DIRS).toContain(d);
  });
});

/* ---------------------------------------------------------------- aggregator */
type Pad={axes:number[];buttons:{pressed:boolean;value:number}[]};
const fakePad=():Pad=>({axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
function withPad(){const pad=fakePad();const input=createSkateInput({getGamepads:()=>[{connected:true,mapping:'standard',index:0,...pad} as PadLike]});return {pad,input};}
function run(input:SkateInput,from:number,to:number,o:{airborne?:boolean|((t:number)=>boolean);rolling?:boolean;each?:(t:number)=>void;landingSoon?:boolean}={}):{t:number;i:SkateIntent}[] {
  const out:{t:number;i:SkateIntent}[]=[];
  for(let t=from;t<=to;t+=1000/120){o.each?.(t);const air=typeof o.airborne==='function'?o.airborne(t):Boolean(o.airborne);out.push({t,i:input.sample(t,air,o.rolling??true,{landingSoon:o.landingSoon})});}
  return out;
}
const pops=(r:{i:SkateIntent}[])=>r.flatMap(x=>x.i.pop?[x.i.pop]:[]);
/**
 * Keyboard and gamepad flick-it pop the moment a flick lands; a gesture that goes on (a double,
 * an impossible, a corner corrected a beat late) arrives in the air as a late flip that the sim
 * and scorer treat as the popped trick read further on. `ride()` flies the rider for half a
 * second after each pop; `tricks()` folds those upgrades into the pop they belong to.
 */
function ride(input:SkateInput,from:number,to:number,each?:(t:number)=>void){
  const out:{t:number;i:SkateIntent}[]=[];let airUntil=-Infinity;
  for(let t=from;t<=to;t+=1000/120){each?.(t);const i=input.sample(t,t<airUntil,true);out.push({t,i});if(i.pop)airUntil=t+500;}
  return out;
}
const tricks=(r:{i:SkateIntent}[])=>{
  const out:{flipId:string|null;from:'tail'|'nose'}[]=[];
  for(const x of r){if(x.i.pop)out.push({flipId:x.i.pop.flipId,from:x.i.pop.from});else if(x.i.lateFlip&&out.length)out[out.length-1]!.flipId=x.i.lateFlip;}
  return out;
};
/** The recogniser's completions for one gesture: early pops then upgrades; the last one is the trick. */
const finalOf=(out:readonly FlickCompletion[])=>out.length?[out[out.length-1]!.flipId]:[];

/** Drive a gamepad right stick through a gesture's samples. */
function padGesture(id:string|null,o:{origin?:'tail'|'nose';facing?:1|-1;t0?:number}={}){
  const {pad,input}=withPad();const s=gestureSamples(id,{t0:o.t0??1000,origin:o.origin,facing:o.facing});
  let k=0;
  const each=(t:number)=>{while(k<s.length&&s[k]!.t<=t+.01){pad.axes[2]=s[k]!.x;pad.axes[3]=-s[k]!.y;k++;}};
  return {pad,input,each,end:s.at(-1)!.t};
}

describe('skate input: gamepad',()=>{
  it('right-stick flicks pop every trick exactly once; pads report as the active device',()=>{
    for(const id of ALL){
      const {input,each,end}=padGesture(id);
      const r=ride(input,1000,end+400,each);
      expect(tricks(r),String(id)).toEqual([{from:'tail',flipId:id}]);
      // Exactly one pop (on the first flick); the rest of a longer gesture arrives in the air.
      expect(pops(r).map(p=>p.from),String(id)).toEqual(['tail']);
      expect(input.activeDevice()).toBe('gamepad');
    }
  });
  it('uses the stance: a goofy rider mirrors the stick',()=>{
    const {input,each,end}=padGesture('heelflip',{facing:-1});input.setStance('goofy');
    expect(pops(run(input,1000,end+400,{each})).map(p=>p.flipId)).toEqual(['heelflip']);
  });
  it('maps buttons: A push, B brake, X revert once, Y respawn, LB/RB grabs by left stick, LT powerslide, RT grind, Back marker, Start pause',()=>{
    const {pad,input}=withPad();
    run(input,0,20);
    pad.buttons[0]!.pressed=true;pad.buttons[1]!.pressed=true;pad.buttons[2]!.pressed=true;pad.buttons[6]!.value=.8;pad.buttons[7]!.value=.9;pad.buttons[9]!.pressed=true;pad.buttons[8]!.pressed=true;
    pad.axes[0]=0;pad.axes[1]=-1; // left stick up = nose
    pad.buttons[4]!.pressed=true;
    const r=run(input,30,80);
    expect(r[0]!.i).toMatchObject({push:true,brake:true,revert:true,powerslide:true,grindAssist:true,marker:true,grab:'nose-grab',lean:1});
    expect(r.filter(x=>x.i.revert).length).toBe(1);
    expect(r.filter(x=>x.i.marker).length).toBe(1);
    expect(input.pausePressed()).toBe(true);expect(input.pausePressed()).toBe(false);
    pad.buttons[4]!.pressed=false;pad.buttons[5]!.pressed=true;pad.axes[1]=0;
    expect(run(input,90,95)[0]!.i.grab).toBe('indy');
    pad.buttons[3]!.pressed=true;
    expect(run(input,100,130).filter(x=>x.i.respawn).length).toBe(1);
  });
  it('applies deadzones and ignores a drifting stick',()=>{
    const {pad,input}=withPad();pad.axes[0]=.1;pad.axes[1]=.12;pad.axes[2]=.1;pad.axes[3]=-.1;
    const i=run(input,0,50).at(-1)!.i;expect(i.steer).toBe(0);expect(i.lean).toBe(0);expect(i.crouch).toBe(0);
    pad.axes[0]=1;pad.axes[1]=0;expect(run(input,60,70).at(-1)!.i.steer).toBeCloseTo(1,6);
  });
  it('reset() forgets held buttons until they are released and pressed again',()=>{
    const {pad,input}=withPad();
    run(input,0,5);pad.buttons[0]!.pressed=true; // held when skating starts = ignored; press after
    expect(run(input,10,20).at(-1)!.i.push).toBe(true);
    input.reset();
    expect(run(input,30,300).some(x=>x.i.push)).toBe(false);
    pad.buttons[0]!.pressed=false;run(input,310,320);pad.buttons[0]!.pressed=true;
    expect(run(input,330,340).at(-1)!.i.push).toBe(true);
  });
  it('turns an airborne flick into a late flip, and buffers a pop flicked just before landing',()=>{
    const late=padGesture('kickflip');
    const lr=run(late.input,1000,late.end+300,{each:late.each,airborne:true});
    expect(pops(lr)).toEqual([]);expect(lr.filter(x=>x.i.lateFlip).map(x=>x.i.lateFlip)).toEqual(['kickflip']);
    // Ollie flicked while still in the air, 40 ms before touchdown: fires on the first grounded step, once.
    const early=padGesture(null);let doneAt=Infinity;
    const r=run(early.input,1000,early.end+400,{each:early.each,airborne:t=>t<doneAt});
    expect(pops(r)).toEqual([]); // grounded never came
    const e2=padGesture(null),r2:{t:number;i:SkateIntent}[]=[];
    let completed=-1;
    for(let t=1000;t<=e2.end+400;t+=1000/120){
      e2.each(t);const air=completed<0||t<completed+40;
      const i=e2.input.sample(t,air,true);r2.push({t,i});
      if(completed<0&&e2.input.lastGesture())completed=t;
    }
    expect(pops(r2).length).toBe(1);
    expect(r2.find(x=>x.i.pop)!.t).toBeGreaterThanOrEqual(completed+40);
    // A flip flicked with landingSoon is buffered as a pop, not a (doomed) late flip.
    const s=padGesture('heelflip');let got:{t:number;i:SkateIntent}[]=[];let seen=-1;
    for(let t=1000;t<=s.end+400;t+=1000/120){s.each(t);const air=seen<0||t<seen+30;const i=s.input.sample(t,air,true,{landingSoon:true});got.push({t,i});if(seen<0&&s.input.lastGesture())seen=t;}
    expect(got.filter(x=>x.i.lateFlip)).toEqual([]);expect(pops(got).map(p=>p.flipId)).toEqual(['heelflip']);
  });
});

/* ---------------------------------------------------------------- keyboard */
type KeyStep=[t:number,kind:'down'|'up',code:string];
function keys(steps:KeyStep[],o:{mode?:'flick'|'easy';stance?:'regular'|'goofy';airborne?:boolean}={}){
  const input=createSkateInput({getGamepads:null,mode:o.mode,stance:o.stance});
  const r:{t:number;i:SkateIntent}[]=[];let k=0,airUntil=-Infinity;const end=(steps.at(-1)?.[0]??0)+600;
  for(let t=1000;t<=1000+end;t+=1000/120){
    while(k<steps.length&&1000+steps[k]![0]<=t){const [at,kind,code]=steps[k]!;const e={key:code.startsWith('Key')?code.slice(3).toLowerCase():code,code,timeStamp:1000+at};if(kind==='down')input.keyDown(e);else input.keyUp(e);k++;}
    const i=input.sample(t,Boolean(o.airborne)||t<airUntil,true);r.push({t,i});if(i.pop)airUntil=t+500;
  }
  return {input,r};
}
const D='ArrowDown',U='ArrowUp',L='ArrowLeft',R='ArrowRight';

describe('skate input: keyboard',()=>{
  it('arrow sequences perform the same gestures as the thumb stick',()=>{
    const cases:[string|null,KeyStep[]][]=[
      [null,[[0,'down',D],[150,'up',D],[160,'down',U],[230,'up',U]]],
      ['kickflip',[[0,'down',D],[150,'up',D],[165,'down',U],[175,'down',L],[240,'up',U],[240,'up',L]]],
      ['heelflip',[[0,'down',D],[150,'up',D],[165,'down',R],[180,'down',U],[240,'up',U],[240,'up',R]]],
      // Kickflip with ↓ still held while ↑ lands first: the chord/settle keeps it a kickflip.
      ['kickflip',[[0,'down',D],[150,'down',U],[170,'down',L],[200,'up',D],[260,'up',U],[260,'up',L]]],
      // Roll round the heel side: ↓ → ↓← → ← → ←↑ → ↑.
      ['pop-shove-it',[[0,'down',D],[150,'down',L],[230,'up',D],[300,'down',U],[380,'up',L],[440,'up',U]]],
      ['fs-shove-it',[[0,'down',D],[150,'down',R],[230,'up',D],[300,'down',U],[380,'up',R],[440,'up',U]]],
      ['varial-kickflip',[[0,'down',D],[150,'down',L],[230,'up',D],[300,'down',U],[380,'up',U],[380,'up',L]]],
      ['hardflip',[[0,'down',D],[150,'down',R],[230,'up',D],[300,'down',U],[380,'up',R],[450,'down',L],[520,'up',U],[520,'up',L]]],
      ['impossible',[[0,'down',D],[150,'up',D],[160,'down',U],[220,'up',U],[240,'down',D],[300,'up',D],[310,'down',U],[370,'up',U]]],
      ['double-kickflip',[[0,'down',D],[150,'up',D],[160,'down',U],[165,'down',L],[220,'up',U],[220,'up',L],[240,'down',D],[300,'up',D],[310,'down',U],[315,'down',L],[380,'up',U],[380,'up',L]]],
      // Full lap round the heel side then flick up-left.
      ['360-flip',[[0,'down',D],[150,'down',L],[220,'up',D],[290,'down',U],[360,'up',L],[430,'down',R],[500,'up',U],[570,'down',D],[640,'up',R],[700,'up',D],[710,'down',U],[715,'down',L],[780,'up',U],[780,'up',L]]],
    ];
    for(const [id,steps] of cases){
      const {r,input}=keys(steps);
      expect(tricks(r).map(p=>[p.flipId,p.from]),String(id)).toEqual([[id,'tail']]);
      expect(input.activeDevice()).toBe('keyboard');
    }
    // Nollie: ↑ loads the nose, ↓ pops.
    expect(pops(keys([[0,'down',U],[150,'up',U],[160,'down',D],[230,'up',D]]).r).map(p=>[p.flipId,p.from])).toEqual([[null,'nose']]);
    // Nollie kickflip: the back foot kicks, so it is a flick to tail-heel.
    expect(pops(keys([[0,'down',U],[150,'up',U],[160,'down',D],[170,'down',L],[240,'up',D],[240,'up',L]]).r).map(p=>[p.flipId,p.from])).toEqual([['kickflip','nose']]);
    // Goofy mirrors left/right.
    expect(pops(keys([[0,'down',D],[150,'up',D],[165,'down',U],[175,'down',R],[240,'up',U],[240,'up',R]],{stance:'goofy'}).r).map(p=>p.flipId)).toEqual(['kickflip']);
    // I J K L are the same board stick.
    expect(pops(keys([[0,'down','KeyK'],[150,'up','KeyK'],[165,'down','KeyI'],[175,'down','KeyJ'],[240,'up','KeyI'],[240,'up','KeyJ']]).r).map(p=>p.flipId)).toEqual(['kickflip']);
  });
  it('keyboard and analogue agree on every trick through the recogniser (digital timing)',()=>{
    for(const id of ALL){
      // Digital stick: jump between the path's directions as a key player would.
      const g=gestureFor(id)!,stick=createDigitalStick(),r=createFlickRecogniser({digital:true});const out:FlickCompletion[]=[];
      const emit=(t:number,x:number,y:number)=>{r.feed(t,x,y);for(let c=r.take();c;c=r.take())out.push(c);};
      const dirKeys=(d:string):('up'|'down'|'left'|'right')[]=>[...(d.startsWith('nose')?['up' as const]:d.startsWith('tail')?['down' as const]:[]),...(d.endsWith('toe')?['right' as const]:d.endsWith('heel')?['left' as const]:[])];
      let t=0,held:('up'|'down'|'left'|'right')[]=[];
      for(const d of g){
        const want=dirKeys(d);stick.advance(t,emit);
        for(const k of held)if(!want.includes(k))stick.release(k,t);
        for(const k of want)if(!held.includes(k))stick.press(k,t);
        held=want;t+=d==='tail'?150:90;stick.advance(t,emit);
      }
      for(const k of held)stick.release(k,t);stick.advance(t+500,emit);r.tick(t+600);for(let c=r.take();c;c=r.take())out.push(c);
      expect(finalOf(out),String(id)).toEqual([id]);
    }
  });
  it('WASD rides with stroke semantics, Shift sprints, C powerslides, G grind assist, M/N manuals, X/R/T one-shots',()=>{
    const {r}=keys([[0,'down','KeyW'],[10,'up','KeyW'],[300,'down','KeyA'],[300,'down','ShiftLeft'],[300,'down','KeyC'],[300,'down','KeyG'],[300,'down','KeyM'],[300,'down','KeyX'],[300,'down','KeyT'],[300,'down','KeyR']]);
    const at=(ms:number)=>r.find(x=>x.t>=1000+ms)!.i;
    expect(at(100).push).toBe(true); // a tap still strokes
    expect(at(260).push).toBe(false);
    expect(at(310)).toMatchObject({steer:-1,sprint:true,powerslide:true,grindAssist:true,manual:'manual'});
    expect(r.filter(x=>x.i.revert).length).toBe(1);expect(r.filter(x=>x.i.marker).length).toBe(1);expect(r.filter(x=>x.i.respawn).length).toBe(1);
  });
  it('Q/E grab with the front/back hand, picked by the WASD direction and stance',()=>{
    const {r}=keys([[0,'down','KeyD'],[20,'down','KeyE'],[200,'up','KeyE'],[200,'up','KeyD'],[300,'down','KeyQ'],[400,'up','KeyQ']]);
    expect(r.find(x=>x.t>=1100)!.i.grab).toBe('indy'); // back hand + toe side (regular: toes right)
    expect(r.find(x=>x.t>=1350)!.i.grab).toBe('melon');
    expect(r.at(-1)!.i.grab).toBeNull();
    const goofy=keys([[0,'down','KeyD'],[20,'down','KeyE']],{stance:'goofy'}).r;
    expect(goofy.at(-1)!.i.grab).toBe('stalefish');
    expect(pickGrab('front',0,-1)).toBe('method');expect(pickGrab('back',0,1)).toBe('crail');expect(pickGrab('front',1,1)).toBe('japan');expect(pickGrab('back',-1,-1)).toBe('roastbeef');
  });
  it('easy keys: single keys for common tricks, late flips in the air, O for nollie',()=>{
    expect(pops(keys([[0,'down','KeyJ'],[120,'up','KeyJ']],{mode:'easy'}).r).map(p=>[p.flipId,p.from])).toEqual([[null,'tail']]);
    expect(pops(keys([[0,'down','KeyF'],[120,'up','KeyF']],{mode:'easy'}).r).map(p=>p.flipId)).toEqual(['kickflip']);
    expect(pops(keys([[0,'down','KeyO'],[40,'down','KeyF'],[120,'up','KeyF'],[130,'up','KeyO']],{mode:'easy'}).r).map(p=>[p.flipId,p.from])).toEqual([['kickflip','nose']]);
    const air=keys([[0,'down','KeyU'],[120,'up','KeyU']],{mode:'easy',airborne:true}).r;
    expect(air.filter(x=>x.i.lateFlip).map(x=>x.i.lateFlip)).toEqual(['360-flip']);expect(pops(air)).toEqual([]);
    const held=keys([[0,'down','KeyH']],{mode:'easy'}).r.at(-1)!.i;expect(held.crouch).toBe(1);expect(held.crouchEnd).toBe('tail');
    // In easy mode J is the ollie key, not the board stick.
    expect(pops(keys([[0,'down','KeyK'],[150,'up','KeyK'],[165,'down','KeyI'],[240,'up','KeyI']],{mode:'easy'}).r)).toEqual([]);
  });
  it('reset() clears held keys and pending gestures',()=>{
    const input=createSkateInput({getGamepads:null});
    input.keyDown({key:'w',code:'KeyW',timeStamp:10});input.keyDown({key:'ArrowDown',code:'ArrowDown',timeStamp:10});
    expect(input.sample(100,false,true).crouch).toBe(1);
    input.reset();
    const i=input.sample(400,false,true);expect(i.push).toBe(false);expect(i.crouch).toBe(0);
    expect(input.keyDown({key:'p',code:'KeyP',timeStamp:500})).toBe(false); // pause is the world's key
    expect(input.keyDown({key:' ',code:'Space',timeStamp:500})).toBe(false);
    expect(input.keyDown({key:'b',code:'KeyB',timeStamp:500})).toBe(false);
  });
});

/* ---------------------------------------------------------------- pointer + touch */
describe('skate input: pointer and touch',()=>{
  it('mouse drag is the board stick (90 px radius from the press point); right button grabs',()=>{
    const input=createSkateInput({getGamepads:null});
    const ev=(t:number,x:number,y:number,button=0)=>({pointerId:1,clientX:x,clientY:y,button,timeStamp:t,pointerType:'mouse'});
    input.pointerDown(ev(1000,400,300));
    const r:{t:number;i:SkateIntent}[]=[];
    const moves:[number,number][]=[[1008,340],[1016,390],[1100,392],[1110,330],[1118,260],[1126,212]];
    let k=0;
    for(let t=1000;t<=1500;t+=1000/120){while(k<moves.length&&moves[k]![0]<=t){input.pointerMove(ev(moves[k]![0],400,moves[k]![1]));k++;}if(t>=1140&&t<1150)input.pointerUp(ev(1140,400,212));r.push({t,i:input.sample(t,false,true)});}
    expect(pops(r).map(p=>p.flipId)).toEqual([null]);expect(input.activeDevice()).toBe('pointer');
    input.pointerDown(ev(1600,0,0,2));expect(input.sample(1610,true,true).grab).toBe('indy');
    input.pointerUp(ev(1700,0,0,2));expect(input.sample(1710,true,true).grab).toBeNull();
    expect(input.pointerDown({...ev(1800,0,0),pointerType:'touch'})).toBe(false);
  });
  it('touch: floating left stick, flick pad, push/brake/grab zones, multi-touch and cancel-safe',()=>{
    const input=createSkateInput({getGamepads:null});
    const ev=(id:number,t:number,x:number,y:number)=>({pointerId:id,clientX:x,clientY:y,timeStamp:t});
    input.touchStart('left',ev(1,1000,100,500));input.touchMove(ev(1,1005,156,500));
    input.touchStart('push',ev(2,1000,300,600));
    expect(input.sample(1010,false,true)).toMatchObject({steer:1,push:true});
    input.touchStart('grab-back',ev(3,1020,700,300));
    expect(input.sample(1030,true,true).grab).toBe('indy'); // left stick → toe side
    input.touchCancel(ev(3,1040,0,0));input.touchEnd(ev(2,1040,0,0));input.touchCancel(ev(1,1040,0,0));
    const quiet=input.sample(1300,false,true);expect(quiet).toMatchObject({steer:0,push:false,grab:null});
    // Flick pad: kickflip with the right thumb while the left thumb steers.
    input.touchStart('left',ev(4,2000,100,500));input.touchMove(ev(4,2000,60,500));
    input.touchStart('right',ev(5,2000,800,500));
    const s=gestureSamples('kickflip',{t0:2000});const r:{t:number;i:SkateIntent}[]=[];let k=0;
    for(let t=2000;t<=s.at(-1)!.t+300;t+=1000/120){while(k<s.length&&s[k]!.t<=t+.01){input.touchMove(ev(5,s[k]!.t,800+s[k]!.x*64,500-s[k]!.y*64));k++;}if(k>=s.length&&input.touches().some(x=>x.zone==='right'))input.touchEnd(ev(5,t,800,500));r.push({t,i:input.sample(t,false,true)});}
    expect(pops(r).map(p=>p.flipId)).toEqual(['kickflip']);expect(r.at(-1)!.i.steer).toBeCloseTo(-40/56,6);
    expect(input.activeDevice()).toBe('touch');
    expect(input.touchEnd(ev(99,3000,0,0))).toBe(false);
  });
  it('one-shots are true for exactly one sample',()=>{
    const {pad,input}=withPad();const s=gestureSamples('varial-heelflip',{t0:1000});let k=0;
    const r=run(input,1000,s.at(-1)!.t+500,{each:t=>{while(k<s.length&&s[k]!.t<=t+.01){pad.axes[2]=s[k]!.x;pad.axes[3]=-s[k]!.y;k++;}}});
    expect(r.filter(x=>x.i.pop).length).toBe(1);expect(r.filter(x=>x.i.lateFlip).length).toBe(0);
  });
});
