import * as THREE from 'three';
import { Craft } from './craft.ts';
import type { LibraryDressing } from '../library/dressing.ts';
import { BINDERY_MACHINES } from '../../house/bindery.ts';

/** A reading room built around the book: no texture downloads or scenery ledger. */
export function libraryInterior(root:THREE.Group,d:LibraryDressing) {
  const c=new Craft(root), nf=d.theme==='newfoundland', album=d.theme==='taylor';
  const joinery=nf?'#426969':album?'#343332':'#294a40', dark=nf?'#293d3d':album?'#292727':'#27362b';
  const timber=nf?'#8b7358':album?'#756858':'#704931', trim=nf?'#c0ad83':album?'#b3a68d':'#b38a48';
  const plaster=nf?'#d7d7bd':album?'#dad2c2':'#d8c09a', paper='#eadfc1';
  // Board grain is physical inlay; the 160 boards merge into four draw calls.
  for(let row=0;row<16;row++)for(let col=0;col<10;col++) {
    const x=-3.96+col*.88,z=-3.1875+row*.425;
    c.box([.865,.07,.412],[x,.015,z],[timber,nf?'#947b60':album?'#807360':'#805940'][((row*7+col)%5===0)?1:0]!);
    if(col%3===0)c.box([.003,.001,.27],[x+.18,.051,z],'#5e4e3b');
  }
  c.box([8.8,3.9,.22],[0,1.95,-3.4],plaster);
  c.box([.22,3.9,6.8],[-4.4,1.95,0],plaster);
  c.box([.22,3.9,6.8],[4.4,1.95,0],plaster);
  // The front wall is a real opening: the return door remains reachable.
  c.box([4.9,.75,.2],[-1.9,.375,3.4],joinery);
  c.box([1.9,.75,.2],[3.45,.375,3.4],joinery);
  // Tall fitted cases on the back wall; inset oak panels, feet, cornices.
  for(const side of [1]) {
    const x=side*2.63;
    c.box([2.8,3.28,.36],[x,1.64,-3.16],dark);
    for(const edge of [-1,1]){
      c.box([.14,3.3,.62],[x+edge*1.36,1.65,-2.98],joinery);
      c.box([.065,3.05,.07],[x+edge*1.36,1.57,-2.62],trim);
    }
    c.box([2.92,.16,.75],[x,3.36,-2.97],joinery);
    c.box([3.04,.07,.82],[x,3.48,-2.97],trim);
    c.box([2.84,.5,.56],[x,.3,-3.02],joinery);
    for(const y of [.65,1.24,1.83,2.42,3.01]) {
      c.box([2.66,.06,.65],[x,y,-2.98],timber);
      c.box([2.68,.035,.025],[x,y,-2.64],trim);
      for(let i=0;i<19;i++) {
        const height=.29+((i*17+Math.round(y*20))%6)*.028;
        const tone=album?['#e0d7c3','#bbb4a5','#66635a','#292b28'][i%4]!:nf?['#74958e','#bd824f','#dac99d','#436773'][i%4]!:['#80503d','#b4a477','#495d4d','#a5774b','#414c55'][i%5]!;
        const bx=x-1.22+i*.131;
        c.box([.105,height,.31],[bx,y+height/2+.035,-2.87],tone);
        c.box([.083,.011,.012],[bx,y+height-.035,-2.707],trim);
        c.box([.072,.018,.014],[bx,y+.14,-2.705],paper);
      }
    }
  }
  // Garden doors occupy the left bay; built-in low drawers hold the remaining folios.
  c.arch(1.42,2.6,[-2.6,.06,-3.25],joinery,'glasshouse-way');
  c.arch(1.18,2.37,[-2.6,.16,-3.18],'#91ac8d','glasshouse-way');
  for(const x of [-2.9,-2.6,-2.3])c.box([.035,1.82,.04],[x,1.16,-3.11],trim,'glasshouse-way');
  for(const y of [.65,1.24,1.83])c.box([1.17,.035,.04],[-2.6,y,-3.11],trim,'glasshouse-way');
  c.box([.055,.11,.09],[-2.22,1.13,-3.04],trim,'glasshouse-way');
  // Three-layer arch and slender leaded lights: the room's centre of gravity.
  c.arch(2.43,3.38,[0,.38,-3.23],joinery);
  c.arch(2.18,3.13,[0,.5,-3.17],trim);
  c.arch(2.02,3.0,[0,.54,-3.1],nf?'#adc7c2':album?'#c9c3b8':'#b7c3a5');
  for(let i=-2;i<=2;i++)c.box([.035,2.19,.045],[i*.34,1.7,-3.02],joinery);
  for(const y of [1.05,1.63,2.2])c.box([1.98,.037,.048],[0,y,-3.015],joinery);
  c.ring(.38,.024,[0,2.91,-3.005],trim);
  c.box([2.5,.12,.58],[0,.54,-2.97],timber);
  // Silhouetted landscape / sea beyond the glazed arch. No implied household facts.
  for(let i=0;i<7;i++) {
    if(nf)c.box([.21,.16+(i%3)*.09,.014],[-.82+i*.26,.73+(i%3)*.035,-3.044],['#43615b','#a76f55','#d2c098'][i%3]!);
    else c.piece(new THREE.ConeGeometry(.17,.43+(i%3)*.13,5),'#76856b',[-.83+i*.28,.8,-3.045]);
  }
  // Wainscot and fine brass rails carry the theme down both sides.
  for(const side of [-1,1]) {
    c.box([.16,1.04,6.65],[side*4.22,.55,0],joinery);
    c.box([.21,.08,6.65],[side*4.19,1.12,0],trim);
    for(let i=0;i<10;i++)c.box([.07,.75,.045],[side*4.1,.55,-2.98+i*.65],timber);
    for(const z of [-2.2,.2,2.3]) { c.box([.16,.65,.1],[side*4.05,2.15,z],trim);c.lamp(side*3.9,2,z,joinery); }
  }
  // A woven, framed carpet brings the enormous floor back to human scale.
  c.box([4.65,.015,4.55],[.05,.064,.1],nf?'#738580':album?'#a7a18e':'#74483c');
  for(const x of [-2.12,2.22])c.box([.065,.017,4.2],[x,.066,.1],trim);
  for(const z of [-1.96,2.16])c.box([4.32,.017,.065],[.05,.066,z],trim);
  for(let i=0;i<13;i++)c.box([.16,.018,.16],[-1.95+i*.33,.068,1.97],paper,undefined,[0,Math.PI/4,0]);
  // The standing desk: a generous oval-edged reading island with turned legs.
  const lx=0,lz=-.9;
  c.box([2.03,.12,1.21],[lx,1.01,lz],timber,'book');
  c.box([1.83,.13,.96],[lx,.92,lz],dark,'book');
  for(const x of [-.79,.79])for(const z of [-1.3,-.5])c.leg(x,z,.95,timber,'book');
  c.box([.86,.04,.57],[0,1.14,lz],d.cover,'book',[.13,0,0]);
  for(const side of [-1,1]) {
    c.box([.41,.05,.52],[side*.215,1.184,lz],paper,'book',[.13,0,side*.08]);
    for(let line=0;line<7;line++)c.box([.28,.002,.008],[side*.215,1.216+(line-3)*.008,lz-.19+line*.055],line===0?dark:'#b7ab8d','book');
  }
  c.box([.022,.005,.68],[.13,1.22,lz+.08],nf?'#bc6653':album?'#51443d':'#963e38','book');
  c.lamp(-.7,1.09,-1.05,joinery,'book');
  c.vessel([.79,1.09,-.65],.08,.12,paper,'book');
  c.cylinder(.08,.09,.009,[.79,1.08,-.65],trim,'book');
  // The bindery: five different instruments, all wired to their real division.
  c.box([.79,.1,3.62],[-3.7,.87,-.6],timber,'bindery');
  for(const z of [-2.2,1])for(const x of [-3.94,-3.45])c.leg(x,z,.84,joinery,'bindery');
  BINDERY_MACHINES.forEach((machine,i)=>{
    const z=-2+i*.7,id=`bindery:${machine.id}`;
    c.box([.48,.055,.48],[-3.7,.96,z],dark,id);
    if(i===0){ for(let j=0;j<3;j++)c.cylinder(.045,.065,.12+j*.05,[-3.7,.99+( .12+j*.05)/2,z-.12+j*.12],trim,id); }
    else if(i===1){ c.ring(.17,.022,[-3.7,1.22,z],trim,id,[0,Math.PI/2,0]); c.cylinder(.035,.035,.31,[-3.7,1.14,z],joinery,id); }
    else if(i===2){for(const j of [-1,1]){c.cylinder(.01,.01,.35,[-3.7,1.18,z+j*.12],trim,id);c.box([.37,.055,.39],[-3.7,1.35,z],joinery,id);}}
    else if(i===3){c.plant(-3.7,.97,z,.48,trim,id);c.box([.34,.02,.34],[-3.7,.985,z],joinery,id);}
    else{for(let j=0;j<3;j++)c.box([.37,.04,.27],[-3.7,1.01+j*.042,z],j%2?paper:trim,id);}
  });
  // Brass archive dial; drawer fronts and a ladder that belongs to the shelves.
  c.box([.91,.12,1.1],[3.5,.82,-.3],timber,'time-machine');
  for(const z of [-.74,.14])for(const x of [3.15,3.85])c.leg(x,z,.76,timber,'time-machine');
  c.ring(.25,.045,[3.5,1.13,-.3],trim,'time-machine',[0,-.3,0]);
  c.cylinder(.018,.018,.48,[3.5,1.13,-.3],dark,'time-machine',[0,0,.42]);
  for(let i=0;i<4;i++)c.box([.37,.045,.3],[3.5,.93+i*.047,.1],i%2?paper:joinery,'time-machine');
  for(const x of [2.15,2.57])c.box([.065,2.8,.065],[x,1.43,-2.05],timber,undefined,[-.1,0,0]);
  for(let i=0;i<9;i++)c.box([.49,.038,.065],[2.36,.22+i*.29,-1.91-i*.029],trim);
  c.plant(1.48,.06,1.47,.98,nf?'#688c8a':album?'#b4a794':'#b78859');
  c.plant(-1.5,.06,-2.18,1.15);
  // A reading balcony that really looks built, not a floating handrail.
  for(const side of [-1,1]) {
    c.box([.75,.13,5.7],[side*3.85,2.58,0],timber);
    c.box([.06,.07,5.7],[side*3.49,3.07,0],trim);
    for(let i=0;i<15;i++)c.cylinder(.012,.015,.45,[side*3.49,2.82,-2.65+i*.38],joinery);
  }
  c.box([2.9,.08,.06],[2.6,3.08,-2.53],trim,'balcony');
  for(let i=0;i<8;i++)c.box([.21,.17,.012],[1.38+i*.35,2.97,-2.49],paper,'balcony');
  for(const z of [-2.9,2.85])c.box([8.6,.19,.18],[0,3.78,z],timber);
  for(const side of [-1,1])c.box([.15,.14,6.6],[side*3.45,3.76,0],timber);
  // Door handles are the same navigation targets as the older room.
  for(const [x,z,id] of [[1.8,3.15,'court-door'],[-2.6,-3.15,'glasshouse-way']] as const) {
    for(const side of [-1,1])c.box([.13,2.2,.16],[x+side*.57,1.1,z],joinery,id);
    c.box([1.27,.13,.16],[x,2.25,z],trim,id);
  }
  // Each world has its own fittings as well as its own materials.
  if(album){
    // A manuscript archive: oversized folio boxes, pinned leaves and a ribbon rail.
    c.box([.06,1.35,2.5],[-4.07,2.02,.55],'#aaa18e');
    for(let i=0;i<5;i++){
      const z=-.42+i*.45;
      c.box([.035,.69,.34],[-4.01,2.01,z],i%2?'#ded5c2':'#c9c1ae');
      c.box([.04,.035,.1],[-3.98,2.36,z],'#716c5f');
      for(let j=0;j<5;j++)c.box([.043,.012,.21],[-3.98,2.2-j*.08,z],'#8d8677');
    }
    for(let i=0;i<3;i++){c.box([.63,.22,.49],[2.6,.19+i*.225,1.15],'#b1a790');c.box([.16,.045,.016],[2.6,.19+i*.225,1.401],'#393b33');}
  }
  if(nf){
    // Merchant's reading room: shiplap, a ship's wheel and oilcloth chart chest.
    for(let i=0;i<11;i++)c.box([8.65,.012,.025],[0,1.2+i*.235,-3.265],'#b0b6a1');
    c.ring(.39,.045,[4.04,2.13,1.35],timber,undefined,[0,Math.PI/2,0]);
    for(let i=0;i<8;i++)c.box([.055,.055,.97],[4.04,2.13,1.35],trim,undefined,[i*Math.PI/4,0,0]);
    c.box([1.15,.56,.65],[2.65,.3,1.55],joinery);
    c.box([1.2,.035,.7],[2.65,.6,1.55],'#c2bd97');
    for(let i=0;i<7;i++)c.box([.02,.004,.62],[2.1+i*.18,.621,1.55],'#8b9d91');
  }
  const light=new THREE.HemisphereLight('#ffedcb','#574733',.7);root.add(light);
  return c.finish();
}
