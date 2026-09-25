import data from './generated/map.json';
export type MapLine={id:string;d:string;kind:string;label?:string};
export type MapPoint={id:string;x:number;z:number;kind:string;label:string};
/** Generated from the exact authored geography; instant in the reading edition. */
export function mountainMap():{viewBox:string;lines:MapLine[];points:MapPoint[]}{return data;}
