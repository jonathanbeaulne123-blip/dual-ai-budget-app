import type { StructureSolid, XYZ } from '../interfaces';
export type BridgeFamily = 'suspension'|'arch'|'bascule'|'ribbon'|'covered'|'masonry'|'cantilever'|'trestle'|'garden'|'boardwalk';
export interface BridgePassage {
  id:string; mode:string; relation:'over'|'under'|'through'|'beside'; route:string;
  width:number|null; headroom:number|null; status:'measured'|'blocked'|'unverified'|'unsupported';
  reason:string;
  envelope?:{offset:number;height:number;radius:number;sampleStep:number;samples:number;blocked:number;missing:number;maximumSurfaceError:number;witness:XYZ|null};
}
/** One baked bridge record. Members are the identical indexed solids used by collision and theme art. */
export interface BridgeDefinition {
  id:string; name:string; family:BridgeFamily; route:string; width:number; path:XYZ[];
  members:{id:string;role:StructureSolid['role'];surface:string}[];
  meeting:{id:string;name:string;at:XYZ;size:[number,number];status:'built'|'unverified'};
  lights:{id:string;at:XYZ;kind:'necklace'|'lantern'|'rib'|'window'|'footlight'}[];
  map:{at:XYZ;glyph:BridgeFamily};
  passages:BridgePassage[];
  districtIds:string[];
  budget:{fullTriangles:number;liteTriangles:number;maxDraws:number};
  operation?:{kind:'twin-bascule';state:'seated';reason:string};
}
