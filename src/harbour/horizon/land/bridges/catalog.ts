import type { BridgeFamily } from './types';
/** Approved cast, 30 September: names live here and are baked into both scales. */
export const BRIDGE_CAST:readonly {id:string;name:string;family:BridgeFamily;meeting:string}[]=[
  {id:'bightBridge',name:'Suspension Bridge',family:'suspension',meeting:'Gateway Terrace'},
  {id:'highSpan',name:'The Arch',family:'arch',meeting:'Gorge Balcony'},
  {id:'quayBridge',name:'Drawbridge',family:'bascule',meeting:'Bell House'},
  {id:'apronBridge',name:'Ribbon',family:'ribbon',meeting:'Ribbon Landing'},
  {id:'hollowBridge',name:'Covered Bridge',family:'covered',meeting:'Lantern Shelter'},
  {id:'mountainRoadCanalBridge',name:'Stone Bridge',family:'masonry',meeting:'Keystone Landing'},
  {id:'prowLoopFootbridge',name:'Cantilever Walk',family:'cantilever',meeting:'Lookout Knot'},
  {id:'bightSpurTrestle',name:'Trestle',family:'trestle',meeting:'Bight Railwatch'},
  {id:'gardenWalkBridge',name:'Garden Bridge',family:'garden',meeting:'Garden Seat'},
  {id:'reachBoardwalk',name:'Boardwalk',family:'boardwalk',meeting:'Regatta Landing'},
];
export const bridgeOwner=(id:string)=>BRIDGE_CAST.find(b=>id.startsWith(b.id+'.'));
