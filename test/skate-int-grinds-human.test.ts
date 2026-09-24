/**
 * Skate v2 · feel pass: every grind and slide is reachable by a PERSON — keys pressed at human
 * times through the real input, driver, sim and park (Skate Lab core) — not only by tests that
 * place the board. The recipe (NOTES-tricks.md "Grinds"): the board's angle picks the family,
 * the left stick at contact picks the grind. Up/down = nose/tail; toward the obstacle = over
 * (feeble, overcrook, salad, boardslide), away = back (smith, crooked, suski, lipslide); spin
 * ~90° for slides (hold the key toward the obstacle through contact, with a lean, to blunt).
 */
import {describe,expect,it} from 'vitest';
import {createLabCore,type LabEntry,type LabLoad} from './browser/skateLabCore.ts';
import {SKATE_GRINDS} from '../src/harbour/skate/tricks/catalog.ts';
import {lcg} from '../src/harbour/skate/sim/testKit.ts';

type Spot={name:string;load:LabLoad;toward:'a'|'d'};
/** The Rolling Pin from its +z side and the Breadboard's +z ledge; `toward` = the steer key that points at the obstacle. */
const SPOTS:Spot[]=[
  {name:'Rolling Pin',load:{local:[-1.2,-3.1,-4],speed:5},toward:'a'},
  {name:'Breadboard ledge',load:{local:[0.4,-6.75,-3],speed:4.5},toward:'a'},
];
const away=(k:'a'|'d')=>k==='a'?'d':'a';
/** Ollie on the arrows (↓ held, ↑ tapped), as in the lab. */
const OLLIE:LabEntry[]=[{at:2,key:'ArrowDown',down:true},{at:12,key:'ArrowDown',down:false},{at:13,key:'ArrowUp',down:true},{at:18,key:'ArrowUp',down:false}];

/** Frames from start to lock with a plain ollie (the contact the human times against). */
function contactFrame(spot:Spot):number{
  const lab=createLabCore();lab.load(spot.load);lab.script(OLLIE);lab.step(80);
  return lab.trace().find(f=>f.events.some(e=>e.kind==='grind-start'))!.frame;
}

type Hold={key:string;from:number;to:number};
/** A person's recipe for a grind, in frames relative to contact L, jittered by `r`. */
function recipe(id:string,spot:Spot,L:number,r:()=>number):Hold[]{
  const j=(a:number,b:number)=>Math.round(a+(b-a)*r());
  const tw=spot.toward,aw=away(tw);
  const lean=(k:'w'|'s'):Hold=>({key:k,from:L-j(6,14),to:L+10});
  const side=(k:string):Hold=>({key:k,from:L-j(3,7),to:L+10});
  // Spin the board round in the air: hold the key ~0.25 s (and keep it for a blunt / a board-lip slide).
  const spin=(k:string,keep:boolean):Hold=>({key:k,from:L-j(15,19),to:keep?L+10:L-j(2,4)});
  switch(id){
    case '50-50':return [];
    case '5-0':return [lean('s')];
    case 'nosegrind':return [lean('w')];
    case 'feeble':return [side(tw)];
    case 'smith':return [side(aw)];
    case 'overcrook':return [side(tw),lean('w')];
    case 'crooked':return [side(aw),lean('w')];
    case 'salad':return [side(tw),lean('s')];
    case 'suski':return [side(aw),lean('s')];
    case 'boardslide':return [spin(tw,true)];
    case 'lipslide':return [spin(aw,true)];
    case 'noseslide':return [spin(tw,false),lean('w')];
    case 'tailslide':return [spin(tw,false),lean('s')];
    case 'noseblunt':return [spin(tw,true),lean('w')];
    case 'bluntslide':return [spin(tw,true),lean('s')];
  }
  throw new Error(id);
}

function play(spot:Spot,holds:Hold[]):string|undefined{
  const lab=createLabCore();lab.load(spot.load);
  lab.script([...OLLIE,...holds.flatMap(h=>[{at:h.from,key:h.key,down:true},{at:h.to,key:h.key,down:false}] as LabEntry[])]);
  lab.step(70);
  const e=lab.trace().flatMap(f=>f.events).find(e=>e.kind==='grind-start');
  return e&&e.kind==='grind-start'?e.grindId:undefined;
}

describe('skate v2 · grinds by hand (keys, human timing, real park)',()=>{
  for(const spot of SPOTS){
    it(`all 15 on the ${spot.name}, 6 tries each with jittered timing`,()=>{
      const L=contactFrame(spot),r=lcg(spot.name.length*97);
      const misses:string[]=[];
      for(const id of SKATE_GRINDS.keys())for(let n=0;n<6;n++){
        const got=play(spot,recipe(id,spot,L,r));
        if(got!==id)misses.push(`${id}→${got}`);
      }
      // A person gets what they asked for (at most one miss in the 90).
      expect(misses.length,misses.join(', ')).toBeLessThanOrEqual(1);
    });
  }
});
