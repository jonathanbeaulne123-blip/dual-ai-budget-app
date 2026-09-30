import type {DynamicGeography,HorizonSurface} from '../runtime/geography.ts';
import {AIRPORT_BOXES,AIRPORT_DECKS,deckAt} from './layout.ts';
/** Rendered slabs supply support. Baked terrain and road collision are never replaced. */
export function airportGeography():DynamicGeography{
 const inside=(x:number,z:number,b:typeof AIRPORT_BOXES[number],r=0)=>Math.abs(x-b.x)<=b.w/2+r+1e-6&&Math.abs(z-b.z)<=b.d/2+r+1e-6;
 return{
  surface(x,z,y,step=.48){let best:HorizonSurface|null=null;const take=(id:string,h:number,slope=0)=>{if((y===undefined||h<=y+step)&&(!best||h>best.y))best={id:'airport.'+id,y:h,nx:0,ny:1,nz:0,material:'paved',slope};};for(const d of AIRPORT_DECKS){const h=deckAt(d,x,z);if(h)take(d.id,h.y,h.slope);}for(const b of AIRPORT_BOXES)if(b.solid&&inside(x,z,b))take(b.id,b.y+b.h/2);return best;},
  ceiling(x,z,y){let h=Infinity;for(const b of AIRPORT_BOXES)if(b.solid&&inside(x,z,b)&&b.y-b.h/2>y+.1)h=Math.min(h,b.y-b.h/2);return h;},
  contact(x,z,y,r=.3){for(const b of AIRPORT_BOXES){if(!b.solid||b.y+b.h/2<=y+.48||b.y-b.h/2>y+1.25||!inside(x,z,b,r))continue;const dx=x-b.x,dz=z-b.z;return Math.abs(dx)/(b.w/2+r)>Math.abs(dz)/(b.d/2+r)?{id:'airport.'+b.id,nx:Math.sign(dx)||1,nz:0}:{id:'airport.'+b.id,nx:0,nz:Math.sign(dz)||1};}return null;},
 };
}
