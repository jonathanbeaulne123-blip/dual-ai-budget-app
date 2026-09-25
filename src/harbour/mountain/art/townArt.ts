/**
 * The town square's new pieces: the two storefronts (Outfitters, Potter's Supply) as real
 * card buildings facing the square, with a shopfront window, a door, an awning, a sign on
 * an iron bracket and a chimney; and the mountain road's gate arch at the road foot.
 */
import {TOWN_SQUARE} from '../townSquare.ts';
import {MOUNTAIN_ROAD_LINE} from '../definition.ts';
import {groundHeightAt} from '../../scene/ground.ts';
import {CardBuilder,shade,mix,inkLift,type V3} from '../../art/cardScene.ts';
import {house,awning,hangingSign,type SignSpot} from './buildingArt.ts';
import type {MountainArtPalette} from './palette.ts';

export type TownSigns={spot:SignSpot;text:string;anchor:string}[];
export function buildTownArt(b:CardBuilder,pal:MountainArtPalette):{signs:TownSigns;smoke:V3[]}{
  const signs:TownSigns=[],smoke:V3[]=[];
  TOWN_SQUARE.storefronts.forEach((sf,i)=>{
    const [x,z]=sf.at,[hx,hz]=sf.half,yaw=sf.yaw;
    const wall=pal.theme==='newfoundland'?pal.walls[(i*3+1)%pal.walls.length]!:pal.walls[i%pal.walls.length]!;
    const h=house(b,pal,x,z,yaw,hx,hz,{wall,wallH:3.3,roofRise:1.35,door:{u:sf.door[0]+.9,face:'front'},windows:[{u:-1.3,y:2.3,face:'left'},{u:1.2,y:2.3,face:'right'},{u:.2,y:2.25,face:'back'}],chimney:true,plinth:.12});
    if(h.chimney)smoke.push(h.chimney);
    // The shopfront: a wide display window beside the door, a fascia board above both.
    const c=Math.cos(yaw),s=Math.sin(yaw),W=(lx:number,lz:number,y:number):V3=>[x+lx*c+lz*s,y,z+lz*c-lx*s];
    const f=h.floor,glass=mix(pal.glass,[.25,.3,.32],.5),frame=pal.theme==='newfoundland'?pal.trim:pal.theme==='taylor'?pal.paperEdge:pal.timber;
    b.quad(W(-2.2,hz+.04,f+.55),W(-.1,hz+.04,f+.55),W(-.1,hz+.04,f+2.2),W(-2.2,hz+.04,f+2.2),glass);
    for(const u of [-2.2,-1.15,-.1])b.box(...xz(W(u,hz+.08,0)),yaw,.06,.06,f+.5,f+2.25,frame,shade(frame,.8),null);
    b.box(...xz(W(-1.15,hz+.1,0)),yaw,1.15,.14,f+.3,f+.55,frame,shade(frame,.8));
    // Goods in the window: folded jumpers and boots (Outfitters), pots on shelves (Potter's).
    for(let k=0;k<4;k++){const q=W(-1.9+k*.5,hz-.25,0);if(sf.id==='outfitters')b.box(q[0],q[2],yaw,.2,.15,f+.6+(k%2)*.4,f+.8+(k%2)*.4,pal.cloth[k%pal.cloth.length]!,shade(pal.cloth[k%pal.cloth.length]!,.8),null);
      else{b.cone(q[0],q[2],f+.6,f+.95,.13,.18,mix([.72,.42,.3],pal.plank,.2),7);b.cone(q[0],q[2],f+1.2,f+1.45,.11,.08,mix([.7,.55,.4],pal.plank,.3),7);}}
    b.box(...xz(W(-.8,hz+.06,0)),yaw,1.9,.08,f+2.35,f+2.85,pal.signBoard,shade(pal.signBoard,.8));
    const stripes=pal.theme==='taylor'?[pal.tape[0]!,pal.paperEdge]:pal.theme==='newfoundland'?[wall,pal.trim]:[i===0?pal.roofTile:pal.accent,pal.plaster];
    awning(b,pal,x,z,yaw,hz,-2.4,2.4,f+3.05,stripes);
    const spot=hangingSign(b,pal,x,z,yaw,hx,hz,f+2.9,i===0?1:-1);
    signs.push({spot,text:sf.name,anchor:sf.id==='outfitters'?'mountain:outfitters':'mountain:pottery'});
    signs.push({spot:{at:W(-.8,hz+.16,f+2.6),yaw,w:3.4,h:.44},text:sf.name,anchor:sf.id==='outfitters'?'mountain:outfitters':'mountain:pottery'});
    b.shadow(x,z,hx+.8,hz+.8,yaw,groundHeightAt,.3);
  });
  // The mountain road's gate: two stone piers outside the kerbs and a timber lintel overhead.
  const S=MOUNTAIN_ROAD_LINE.samples,g=S[Math.min(S.length-1,6)]!,hw=g.halfWidth+.9,yaw=Math.atan2(g.normal[0],g.normal[2]);
  const piers=[1,-1].map(sg=>[g.at[0]+g.normal[0]*hw*sg,g.at[2]+g.normal[2]*hw*sg] as const);
  for(const [px,pz] of piers){const y=groundHeightAt(px,pz);b.box(px,pz,yaw,.45,.45,y-.3,g.at[1]+4.6,pal.coping,pal.stone);b.box(px,pz,yaw,.55,.55,g.at[1]+4.6,g.at[1]+4.8,pal.coping,shade(pal.coping,.8));}
  const a=piers[0]!,e=piers[1]!;b.beam([a[0],g.at[1]+4.35,a[1]],[e[0],g.at[1]+4.35,e[1]],.4,.55,pal.timber);
  signs.push({spot:{at:[(a[0]+e[0])/2+g.tangent[0]*-.28,g.at[1]+3.75,(a[1]+e[1])/2+g.tangent[2]*-.28],yaw:Math.atan2(-g.tangent[0],-g.tangent[2]),w:4.2,h:.62},text:'Mountain road',anchor:'mountain:district:hearth'});
  void inkLift;
  return {signs,smoke};
}
const xz=(p:V3):[number,number]=>[p[0],p[2]];
