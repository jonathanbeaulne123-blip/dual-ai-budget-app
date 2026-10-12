import type {DynamicGeography,HorizonSurface} from '../runtime/geography.ts';
import {AIRPORT_BOXES,AIRPORT_DECKS,AIRPORT_VAULTS,deckAt,vaultTop} from './layout.ts';
/** Rendered slabs supply support. Baked terrain and road collision are never replaced. The Quonset's barrel (AIRPORT_VAULTS)
 * is a solid from its spring line to its arc: what is drawn is what is struck (D-WW160). */
export function airportGeography():DynamicGeography{
 const inside=(x:number,z:number,b:typeof AIRPORT_BOXES[number],r=0)=>Math.abs(x-b.x)<=b.w/2+r+1e-6&&Math.abs(z-b.z)<=b.d/2+r+1e-6;
 return{
  surface(x,z,y,step=.48){let best:HorizonSurface|null=null;const take=(id:string,h:number,slope=0)=>{if((y===undefined||h<=y+step)&&(!best||h>best.y))best={id:'airport.'+id,y:h,nx:0,ny:1,nz:0,material:'paved',slope};};for(const d of AIRPORT_DECKS){const h=deckAt(d,x,z);if(h)take(d.id,h.y,h.slope);}for(const b of AIRPORT_BOXES)if(b.solid&&inside(x,z,b))take(b.id,b.y+b.h/2);for(const v of AIRPORT_VAULTS){const h=vaultTop(v,x,z);if(h!==null){const e=.05,s=Math.abs((vaultTop(v,x,Math.min(v.z1,z+e))??h)-(vaultTop(v,x,Math.max(v.z0,z-e))??h))/(2*e);take(v.id,h,Math.atan(s)*180/Math.PI);}}return best;},
  ceiling(x,z,y){let h=Infinity;for(const b of AIRPORT_BOXES)if(b.solid&&inside(x,z,b)&&b.y-b.h/2>y+.1)h=Math.min(h,b.y-b.h/2);for(const v of AIRPORT_VAULTS)if(vaultTop(v,x,z)!==null&&v.spring>y+.1)h=Math.min(h,v.spring);return h;},
  contact(x,z,y,r=.3){for(const b of AIRPORT_BOXES){if(!b.solid||b.y+b.h/2<=y+.48||b.y-b.h/2>y+1.25||!inside(x,z,b,r))continue;const dx=x-b.x,dz=z-b.z;return Math.abs(dx)/(b.w/2+r)>Math.abs(dz)/(b.d/2+r)?{id:'airport.'+b.id,nx:Math.sign(dx)||1,nz:0}:{id:'airport.'+b.id,nx:0,nz:Math.sign(dz)||1};}
   for(const v of AIRPORT_VAULTS){if(x<v.x0-r||x>v.x1+r||z<v.z0-r||z>v.z1+r||v.spring>y+1.25)continue;const top=vaultTop(v,Math.min(v.x1,Math.max(v.x0,x)),Math.min(v.z1,Math.max(v.z0,z)))??v.spring;if(top<=y+.48)continue;const dx=x-(v.x0+v.x1)/2,dz=z-(v.z0+v.z1)/2;return Math.abs(dx)/((v.x1-v.x0)/2+r)>Math.abs(dz)/((v.z1-v.z0)/2+r)?{id:'airport.'+v.id,nx:Math.sign(dx)||1,nz:0}:{id:'airport.'+v.id,nx:0,nz:Math.sign(dz)||1};}
   return null;},
 };
}
