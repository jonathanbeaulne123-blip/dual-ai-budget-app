/**
 * Skate Lab · named scenarios. Pure data over the lab core's timeline, so the
 * same scenario runs headless in `test/skate-lab.test.ts` (which checks
 * `expect`) and in the browser lab, where `scripts/skate-lab.mjs` films it.
 *
 * Positions use Tideline's local frame (`local: [lx, lz, headingDeg]`, 0° =
 * local +x; see world/NOTES-park.md for the map). `place` entries are test
 * shortcuts that set sim state (e.g. turn the board 90° in the air for a
 * boardslide) — they reset the open score line, so a filmstrip shows the
 * trick, not the points.
 */
import type {SkateIntent} from '../../src/harbour/skate/contract.ts';
import {tidelinePose,type LabEntry,type LabLoad} from './skateLabCore.ts';
import {parkPoint} from '../../src/harbour/skate/world/layout.ts';

export type LabCamera=
  | {kind:'chase'}
  /** Beside the rider, looking across its path (view heading locked when set). */
  | {kind:'side';dist?:number;height?:number;side?:1|-1;yawDeg?:number;fov?:number}
  /** Around a target (default: the rider), yaw 0° looks toward +z. */
  | {kind:'orbit';yawDeg:number;pitchDeg:number;dist:number;target?:readonly [number,number,number];fov?:number}
  | {kind:'fixed';position:readonly [number,number,number];target:readonly [number,number,number];fov?:number};

export type LabScenario={
  name:string;title:string;load:LabLoad;camera:LabCamera;script:LabEntry[];
  /** Frames to run and how many to film (evenly spaced, last = final frame). */
  frames:number;samples?:number;
  /** Event kinds (`pop:kickflip`, `grind:smith`, `land`…) that must appear in this order, and ones that must not. */
  expect:{seq:string[];not?:string[]};
};

const hold=(from:number,frames:number,intent:Partial<SkateIntent>):LabEntry=>({at:from,intent,for:frames});

export const LAB_SCENARIOS:readonly LabScenario[]=[
  {name:'push-away',title:'Push away (W held)',load:{local:[-4,.5,0]},camera:{kind:'side',side:-1,dist:3.2,height:.9},
    script:[{at:0,key:'w',down:true},{at:140,key:'w',down:false}],frames:150,expect:{seq:['push','push','push']}},
  {name:'ollie',title:'Ollie on the flat (flick-it: ↓ then ↑ on the right stick)',load:{local:[-4,.5,0],speed:4},camera:{kind:'side',dist:3,height:.7},
    script:[{at:6,flick:null}],frames:70,expect:{seq:['pop:ollie','land'],not:['bail']}},
  {name:'kickflip',title:'Kickflip (flick-it ↓ then ↖)',load:{local:[-4,.5,0],speed:4.5},camera:{kind:'side',dist:2.6,height:.6},
    script:[{at:6,flick:'kickflip'}],frames:70,expect:{seq:['pop:kickflip','flip-caught','land'],not:['bail']}},
  {name:'heelflip',title:'Heelflip (flick-it ↓ then ↗)',load:{local:[-4,.5,0],speed:4.5},camera:{kind:'side',dist:2.6,height:.6},
    script:[{at:6,flick:'heelflip'}],frames:70,expect:{seq:['pop:heelflip','flip-caught','land'],not:['bail']}},
  {name:'pop-shuvit',title:'Pop shove-it (flick-it: sweep round the heel side)',load:{local:[-4,.5,0],speed:4.5},camera:{kind:'orbit',yawDeg:-30,pitchDeg:35,dist:3.2},
    script:[{at:6,flick:'pop-shove-it'}],frames:70,expect:{seq:['pop:pop-shove-it','flip-caught','land'],not:['bail']}},
  {name:'360-flip',title:'360 flip off the Hatch kicker (raw intent pop at the lip)',load:{local:[11,2.5,180],speed:8},camera:{kind:'side',dist:4,height:.9},
    script:[hold(26,15,{crouch:1,crouchEnd:'tail'}),{at:41,intent:{pop:{from:'tail',flipId:'360-flip',strength:1}}},hold(80,40,{crouch:1,crouchEnd:'tail'})],frames:140,expect:{seq:['pop:360-flip','flip-caught','land'],not:['bail']}},
  {name:'fs-180',title:'Frontside 180 ollie (carve left through the air)',load:{local:[-4,.5,0],speed:4.5},camera:{kind:'orbit',yawDeg:150,pitchDeg:30,dist:3.4},
    script:[hold(0,8,{crouch:1,crouchEnd:'tail',steer:-1}),{at:8,intent:{pop:{from:'tail',flipId:null,strength:1},steer:-1}},hold(9,14,{steer:-1})],frames:75,expect:{seq:['pop:ollie','land'],not:['bail']}},
  {name:'indy-kicker',title:'Indy grab off the Hatch kicker (E held)',load:{local:[11,2.5,180],speed:8},camera:{kind:'side',dist:4,height:.9},
    script:[hold(20,45,{grab:'indy'})],frames:90,expect:{seq:['grab-start','grab-end','land'],not:['bail']}},
  {name:'grind-5050',title:'Ollie to 50-50 on the Rolling Pin',load:{local:[-1.2,-3.1,-4],speed:5},camera:{kind:'side',side:1,dist:3.2,height:.8},
    script:[{at:4,flick:null},{at:30,auto:'grind',for:70}],frames:120,expect:{seq:['pop:ollie','grind:50-50','grind-end'],not:['bail']}},
  {name:'grind-boardslide',title:'Boardslide on the Rolling Pin (board turned 90° in the air: place shortcut)',load:{local:[-1.2,-3.1,-4],speed:5},camera:{kind:'orbit',yawDeg:200,pitchDeg:25,dist:4},
    script:[{at:4,flick:null},{at:20,place:{boardYaw:'@+90'}},{at:30,auto:'grind',for:80}],frames:120,expect:{seq:['pop:ollie','grind:boardslide','grind-end'],not:['bail']}},
  {name:'grind-smith',title:'Smith on the Breadboard ledge (board angled nose-in, no lean)',load:{local:[0.4,-6.75,-3],speed:4.5},camera:{kind:'side',side:1,dist:3,height:.7},
    script:[{at:4,flick:null},{at:30,place:{boardYaw:'@-25'}},{at:40,auto:'grind',for:60}],frames:110,expect:{seq:['pop:ollie','grind:smith','grind-end'],not:['bail']}},
  {name:'manual',title:'Ollie onto the Breadboard, land into a manual (M held, balanced)',load:{local:[0.6,-7.6,0],speed:4.5},camera:{kind:'side',dist:3,height:.6},
    script:[{at:8,flick:null},{at:32,auto:'manual',for:90}],frames:130,expect:{seq:['pop:ollie','manual-start','land','manual-end'],not:['bail']}},
  {name:'bowl',title:'Drop into the Kettle and carve the bowl',load:{local:[-13.4,-5.8,0],speed:2.6},camera:{kind:'chase'},
    script:[{at:0,key:'w',down:true},{at:25,key:'w',down:false},hold(60,40,{steer:.35})],frames:180,expect:{seq:['land'],not:['bail']}},
  {name:'vert-air',title:'Vert air on the Chimney, back in fakie',load:{local:[4,-6.7,0],speed:9.5},camera:{kind:'side',side:-1,dist:5,height:1.6},
    script:[],frames:150,expect:{seq:['land'],not:['bail','grind-start']}},
  {name:'powerslide',title:'Powerslide round to fakie (C + carve)',load:{local:[-4,.5,0],speed:6},camera:{kind:'orbit',yawDeg:-60,pitchDeg:30,dist:4},
    script:[hold(5,50,{powerslide:true,steer:1})],frames:80,expect:{seq:['powerslide'],not:['bail']}},
  {name:'bail',title:'Bail (a triple kickflip popped too low) and get up',load:{local:[-4,.5,0],speed:4},camera:{kind:'side',dist:3.2,height:.9},
    script:[{at:4,intent:{pop:{from:'tail',flipId:'triple-kickflip',strength:0}}}],frames:180,expect:{seq:['pop:triple-kickflip','bail','recovered']}},
  {name:'line',title:'A line: ollie to 50-50 the Rolling Pin, roll out, kickflip, manual',load:{local:[-2.4,-3.0,-4],speed:5.4},camera:{kind:'chase'},
    script:[{at:10,flick:null},{at:40,auto:'grind',for:60},{at:112,flick:'kickflip'},{at:150,auto:'manual',for:50}],frames:220,expect:{seq:['pop:ollie','grind:50-50','grind-end','land','pop:kickflip','flip-caught','land'],not:['bail']}},
];

/** Tideline local → world, with a height. */
const at=(lx:number,lz:number,y:number):readonly [number,number,number]=>{const [x,z]=parkPoint('tideline',lx,lz);return [x,y,z];};
void tidelinePose;
/** Park overviews for the stills: [name, camera]. */
export const LAB_STILL_CAMERAS:readonly [string,LabCamera][]=[
  ['overview',{kind:'fixed',position:at(2,20,13),target:at(0,-1,.5),fov:55}],
  ['street',{kind:'fixed',position:at(16,9,3.2),target:at(6,-2,1.2),fov:55}],
  ['bowl',{kind:'fixed',position:at(-5,-1,4),target:at(-10,-6,1),fov:55}],
];
