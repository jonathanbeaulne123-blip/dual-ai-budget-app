import * as THREE from 'three';
import { Craft } from './craft.ts';
import type { KilnDressing } from '../kiln/dressing.ts';

/** The studio's original workshop architecture; station identities stay in KilnScene. */
export function studioInterior(root:THREE.Group,d:KilnDressing) {
  const c=new Craft(root),sea=d.theme==='newfoundland',album=d.theme==='taylor';
  const wood=sea?'#718f87':album?'#595449':'#806047',ink=sea?'#36565a':album?'#373933':'#365348';
  const wall=sea?'#d7ded3':album?'#e0d6c5':'#ead2ab',clay=sea?'#9b957e':album?'#c2ad94':'#b77655';
  // Laid terracotta, with an intentionally irregular brick border.
  for(let x=0;x<17;x++)for(let z=0;z<13;z++) {
    const edge=x===0||z===0||x===16||z===12;
    c.box([.439,.055,.439],[-3.59+x*.448,.013,-2.68+z*.448],edge?ink:[clay,sea?'#b4b19a':album?'#ccbea6':'#c78b66',sea?'#8b9484':album?'#ab9985':'#b9815d'][(x*13+z*7)%3]!);
    if(!edge&&(x+z)%4===0)c.box([.035,.002,.035],[-3.59+x*.448,.044,-2.68+z*.448],wall,undefined,[0,Math.PI/4,0]);
  }
  c.box([7.6,2.85,.16],[0,1.425,-2.9],wall);
  c.box([.16,2.85,5.8],[-3.8,1.425,0],wall);
  c.box([.16,2.85,5.8],[3.8,1.425,0],wall);
  for(const side of [-1,1]) {
    c.box([.14,.72,5.65],[side*3.69,.38,0],wood);
    c.box([.19,.065,5.65],[side*3.68,.77,0],ink);
    for(let j=0;j<20;j++)c.box([.012,.69,.017],[side*3.60,.38,-2.64+j*.28],sea?'#b7c9be':album?'#988d77':'#a88666');
  }
  // Exposed trusses overhead, shaped rather than flat box walls.
  for(const z of [-2.65,-.5,1.9]){
    c.box([7.55,.13,.13],[0,2.82,z],wood);
    for(const side of [-1,1])c.box([4.03,.14,.14],[side*1.89,3.27,z],wood,undefined,[0,0,-side*.23]);
    c.box([.07,.85,.1],[0,3.22,z],ink);
  }
  c.box([.13,.16,5.8],[0,3.72,0],wood);
  // Two grand north lights; blue-green sea glass is physical framing.
  for(const centre of [-.05,1.85]) {
    c.arch(1.58,1.97,[centre,.75,-2.79],wood);
    c.arch(1.4,1.78,[centre,.83,-2.72],sea?'#9fbfbc':album?'#c6c3b3':'#c0cfb8');
    for(const x of [-.43,0,.43])c.box([.034,1.41,.05],[centre+x,1.57,-2.65],ink);
    for(const y of [1.22,1.78,2.2])c.box([1.35,.035,.05],[centre,y,-2.65],ink);
    c.box([1.71,.11,.4],[centre,.84,-2.59],wood);
  }
  // The glaze counter is a cabinet with inset drawers, not an anonymous table.
  c.box([.87,.69,2.49],[2.8,.43,-.3],ink,'bench');
  for(let i=0;i<4;i++) {
    const z=-1.2+i*.6;
    c.box([.024,.26,.52],[2.35,.63,z],wood,'bench');
    c.box([.02,.25,.52],[2.35,.3,z],wood,'bench');
    c.cylinder(.024,.024,.03,[2.32,.63,z],'#ba9a63','bench',[0,0,Math.PI/2]);
  }
  c.box([1.09,.09,2.73],[2.77,.88,-.3],sea?'#bdbca2':album?'#d2c8b6':'#dfc598','bench');
  // Swatch tiles, an apron on a hook, hanging herbs and small work-in-progress tools.
  for(let i=0;i<8;i++) {
    const z=-1.5+i*.43,colour=['#447d77','#d1b166','#cc9378','#647596'][i%4]!;
    c.box([.03,.24,.24],[3.66,1.65,z],colour,'bench');
    c.ring(.022,.008,[3.635,1.81,z],'#af9663',undefined,[0,Math.PI/2,0]);
  }
  c.box([.025,.55,.41],[3.6,1.8,1.98],sea?'#bac4af':album?'#a8868e':'#a7b28c');
  c.box([.024,.14,.24],[3.58,1.65,1.98],wall);
  c.box([1.34,.12,.88],[-1,.62,1.1],wood,'wheel');
  for(const x of [-1.48,-.52])for(const z of [.78,1.43])c.leg(x,z,.62,wood,'wheel');
  c.cylinder(.34,.34,.065,[-1,.73,1.1],d.wheelHead,'wheel');
  c.ring(.36,.025,[-1,.754,1.1],'#c5b795','wheel',[Math.PI/2,0,0]);
  // The clay vessel is a genuinely open profile and catches the raking light.
  c.vessel([-1,.76,1.1],.185,.29,d.clay,'wheel');
  for(let i=0;i<4;i++)c.box([.012,.018,.24],[-.48+i*.055,.696,1.16],ink,'wheel',[0,i*.07,0]);
  c.vessel([-2.02,.045,1.55],.17,.24,ink);
  c.vessel([-2.45,.045,1.82],.25,.36,clay);
  // Curved brick joints around the chimney; these belong to its solid form.
  for(let i=0;i<8;i++)c.ring(i<4?.87-i*.017:.81-(i-4)*.1,.012,[-2.45,.16+i*.25,-1.75],wood,'kiln',[Math.PI/2,0,0]);
  c.box([1.3,.04,1.03],[-2.35,.055,-.92],ink,'kiln');
  c.plant(-3.24,.06,1.8,.9,wood);
  c.plant(.34,.9,-2.45,.62,clay);
  // A drying rail with a linen drape; no invented finished user work on display.
  for(const x of [-3.5,-2.7])c.box([.04,.85,.05],[x,.425,2.12],wood);
  c.box([.9,.04,.05],[-3.1,.86,2.12],wood);
  c.box([.42,.65,.018],[-3.05,.51,2.15],album?'#b4a59b':'#d5c9a7');
  for(let i=0;i<6;i++)c.box([.002,.64,.003],[-3.2+i*.055,.51,2.161],wall);
  c.lamp(2.72,.94,-1.29,ink,'bench');
  // Hanging pendant and pottery-school marks on a small pinboard.
  c.cylinder(.009,.009,.52,[.25,2.65,.7],ink);
  c.piece(new THREE.ConeGeometry(.28,.19,24,1,true),ink,[.25,2.34,.7]);
  const glow=new THREE.PointLight('#ffdfac',.85,5,2);glow.position.set(.25,2.21,.7);root.add(glow);
  root.add(new THREE.HemisphereLight('#fff0cc','#706b58',.68));
  c.box([.03,.9,1.32],[-3.68,1.68,.25],wood);
  for(let i=0;i<4;i++)c.box([.04,.29,.38],[-3.65,1.48+(i%2)*.4,-.08+Math.floor(i/2)*.61],i%2?wall:'#b4b59a');
  if(sea){
    for(let i=0;i<12;i++)c.box([7.4,.012,.035],[0,.15+i*.22,-2.79],'#a7b5a6');
    // A stone hearth and rope coils belong to an outport workshop.
    for(let x=0;x<4;x++)for(let z=0;z<3;z++)c.box([.43,.045,.39],[-3.15+x*.46,.052,-1.92+z*.42],(x+z)%2?'#777d71':'#969b85','kiln');
    for(let i=0;i<4;i++)c.ring(.22-i*.036,.017,[-2.88,.08,1.07],'#b9ad83',undefined,[Math.PI/2,0,0]);
    c.ring(.32,.045,[3.61,2.17,.2],ink,undefined,[0,Math.PI/2,0]);
  }else if(album){
    // The album atelier carries hanging swatches, proof leaves and wax seals.
    c.cylinder(.007,.007,3.1,[.9,2.6,-2.34],wood,undefined,[0,0,Math.PI/2]);
    for(let i=0;i<6;i++){
      const x=-.4+i*.48;
      c.box([.32,.39,.018],[x,2.35,-2.33],i%2?'#d9cdb8':'#939184',undefined,[0,0,(i%3-1)*.08]);
      c.box([.19,.17,.023],[x,2.38,-2.32],['#868b79','#beb1a0','#6b7469'][i%3]!);
      c.box([.025,.08,.034],[x,2.58,-2.32],wood);
    }
  }
  return c.finish();
}
