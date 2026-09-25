import { housePath, parseHouseRoute, type HouseRoute } from "../hearthside/houseRoutes.ts";
import type { Environment, LedgerView } from "../core/types.ts";
import type { AppTab } from "../core/ledgerExperience.ts";
import type { HearthsideRoute } from "../hearthside/routes.ts";

export const HOUSE_WORLD_ENABLED = import.meta.env.VITE_HEARTH_HOUSE_WORLD === "1";
export type HouseIdentity = { environment: Environment; householdId: string; memberId: string; scope: LedgerView };
/** `geo`: the mountain geography revision the position was saved against (the harbour re-validates others). */
export type HouseBodyReturn={place:string;x:number;z:number;yaw:number;y?:number;world?:string;geo?:string};
export function validHouseBody(value:unknown):value is HouseBodyReturn {if(!value||typeof value!=="object")return false;const b=value as HouseBodyReturn;return typeof b.place==="string"&&[b.x,b.z,b.yaw].every(Number.isFinite)&&Math.abs(b.x)<=180&&b.z>=-310&&b.z<=84&&Math.abs(b.yaw)<=100&&(b.y===undefined||Number.isFinite(b.y)&&b.y>=-8&&b.y<=150)&&(b.world===undefined||b.world==="hearth-mountain-1"||b.world==="hearth-mountain-2");}
export type HouseReturn = { version: 1; identity: string; route: HouseRoute; focus: string; scroll: number; camera?: [number, number, number]; cameraComposition?: "phone" | "desktop"; body?:HouseBodyReturn; at: string };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const houseIdentity = (identity: HouseIdentity) => [identity.environment, identity.householdId, identity.memberId, identity.scope].map(encodeURIComponent).join(":");
const key = (identity: HouseIdentity, object = "arrival") => `hearth:house:v1:${houseIdentity(identity)}:${encodeURIComponent(object)}`;
/** A URL may deliberately name another space in the same household. Keep its
 * address intact while the app changes the active read scope before rendering it. */
export function resolveHouseRouteScope(route: HouseRoute, currentScope: LedgerView): { route: HouseRoute; scope: LedgerView; changesScope: boolean } {
  const scope = route.scope ?? currentScope;
  return { route: route.scope === scope ? route : { ...route, scope }, scope, changesScope: scope !== currentScope };
}
export function saveHouseReturn(storage: Store, identity: HouseIdentity, route: HouseRoute, options: Partial<Pick<HouseReturn, "focus" | "scroll" | "camera" | "cameraComposition" | "body">> = {}, object = "arrival"): void {
  if (route.householdId !== identity.householdId || route.scope && route.scope !== identity.scope) return;
  const record: HouseReturn = {version: 1, identity: houseIdentity(identity), route: {...route, scope: identity.scope}, focus: options.focus?.slice(0, 180) ?? "house-world-title", scroll: Math.max(0, Math.min(1e7, options.scroll ?? 0)), ...(options.camera?.every(Number.isFinite) ? {camera: options.camera, cameraComposition:options.cameraComposition} : {}), ...(validHouseBody(options.body)?{body:options.body}:{}), at: new Date().toISOString()};
  try { storage.setItem(key(identity, object), JSON.stringify(record)); } catch { /* Navigation still works when device storage is unavailable. */ }
}
export function readHouseReturn(storage: Store, identity: HouseIdentity, object = "arrival"): HouseReturn | null {
  try {
    const value = JSON.parse(storage.getItem(key(identity, object)) ?? "null") as HouseReturn | null;
    if (!value || value.version !== 1 || value.identity !== houseIdentity(identity) || value.route.scope !== identity.scope) return null;
    const route = parseHouseRoute(housePath(value.route), identity.householdId);
    if (!route || typeof value.focus !== "string" || !Number.isFinite(value.scroll)) return null;
    return {...value, body:validHouseBody(value.body)&&(value.body.world==="hearth-mountain-1"||value.body.world==="hearth-mountain-2")?value.body:undefined, route, scroll: Math.max(0, Math.min(1e7, value.scroll))};
  } catch { return null; }
}
export function houseSurfaceRoute(route: HouseRoute, surface: string, object?: string): HouseRoute {
  return {...route, surface, ...(object ? {object} : {}), ...(!["pottery", "wardrobe"].includes(surface) ? {studioSelection: undefined} : {}), ...(surface !== "pottery" ? {studioTab: undefined} : {})};
}
const HOUSE_TARGET_PLACES:Record<string,[HouseRoute['room'],HouseRoute['level']]>= {
    queen:['home','middle'],'loft-banks':['home','above'],'cellar-bills':['home','below'],
    planner:['study','above'],books:['study','middle'],calendar:['study','below'],
    journey:['kitchen-table','above'],conversation:['kitchen-table','middle'],'plan-studio':['kitchen-table','below'],
    wishes:['together','above'],'personal-experience':['together','above'],letters:['together','middle'],encounters:['together','middle'],memories:['together','below'],projector:['together','below'],
    // Making: the Pottery Studio's own building is the Kiln (`making/above`,
    // the slot `HOUSE_PLACES.making.above` has always named "The Kiln"), so the
    // `pottery` target opens where the studio actually stands. Together keeps
    // every one of its own levels; only pottery moved.
    pottery:['making','above'],wardrobe:['making','middle'],life:['together','middle'],together:['together','middle'],practical:['together','middle'],history:['together','middle'],occasions:['together','middle'],worktable:['together','middle'],guests:['together','middle'],restore:['together','middle'],
};
/** Tools select content independently of the physical room that opened them. */
export function houseToolPlace(route: HouseRoute): Pick<HouseRoute,'room'|'level'> {
  const target=HOUSE_TARGET_PLACES[route.surface??''];
  return target?{room:target[0],level:target[1]}:{room:route.room,level:route.level};
}
export function houseTabForRoute(route: HouseRoute): AppTab {
  if(route.surface==='conversation'||route.surface==='hercules')return 'hercules';
  if(route.surface==='more'||route.surface==='status')return 'more';
  // Shifts is not a house object: it opens the Shifts page wherever you stand (the personal Desk's plates and the quick sheet).
  if(route.surface==='shift')return 'shift';
  const {room,level}=houseToolPlace(route);
  if(room==='home')return 'home';
  if(room==='study')return level==='above'?'planner':level==='middle'?'ledger':'calendar';
  if(room==='kitchen-table')return 'plan';
  return 'play';
}
/** Furniture has one address; collections are browsable even while carrying a folio. */
export function houseTargetRoute(route:HouseRoute,target:string,object?:string):HouseRoute {

  const place=HOUSE_TARGET_PLACES[target];
  // A Village address names the room the person is actually standing in. A
  // tool selects its surface without teleporting that origin to the tool's
  // older furniture address, so its return record remains physical and exact.
  const targetPlace=route.village?undefined:place;
  const station=target==='pottery'&&['wheel','paint','kiln'].includes(object??'');
  const carried=route.object&&!['wheel','paint','kiln'].includes(route.object)?route.object:undefined;
  return {...route,...(targetPlace?{room:targetPlace[0],level:targetPlace[1]}:{}),surface:target,object:station?carried:object??(['wishes','memories','projector'].includes(target)?undefined:route.object),studioSelection:target==='pottery'&&!object?.startsWith('piece/')?route.studioSelection:undefined,studioTab:target==='pottery'?(object==='wheel'?'shape':object==='paint'?'paint':object==='kiln'?'kiln':route.studioTab):undefined};
}
export function houseRoomRoute(route: HouseRoute): HouseRoute { const {surface: _surface, studioSelection: _studioSelection, studioTab: _studioTab, ...room} = route; return room; }
export function houseLifeRoute(route: HouseRoute): HearthsideRoute {
  const tool=houseToolPlace(route);
  const room=route.surface==="pottery"||route.surface==="wardrobe"?"studio":tool.level==="above"?"conservatory":tool.level==="below"?"theatre":"common";
  const surface=route.surface==="pottery"?"studio":(["letters","projector","encounters","wardrobe","practical","history","occasions","worktable","guests","restore"].includes(route.surface??"")?route.surface:undefined) as HearthsideRoute["surface"];
  const [kind,id,designId]=route.object?.split("/")??[];
  const object=(kind==="experience"||kind==="memory"||kind==="note"||kind==="encounter")&&id?{kind,id}:kind==="piece"&&id&&designId?{kind,id,designId}:undefined;
  const studioSelection=object?.kind!=="piece"&&route.studioSelection&&(surface==="studio"||surface==="wardrobe")?route.studioSelection:undefined;
  const studioTab=surface==='studio'?(route.studioTab??(route.object==='paint'?'paint':route.object==='kiln'?'kiln':route.object==='wheel'?'shape':undefined)):undefined;
  return {version:1,...(studioTab?{studioTab}:{}),householdId:route.householdId,room,mode:room==="conservatory"?"imagine":room==="theatre"?"remember":"present",...(surface?{surface}:{}),...(object?{object:object as HearthsideRoute["object"]}:{}),...(studioSelection?{studioSelection}: {})};
}
export function houseRouteFromLife(next: HearthsideRoute, scope: LedgerView): HouseRoute {
  const surface=next.surface==="studio"?"pottery":next.surface??(next.room==="theatre"?"memories":next.room==="conservatory"?"wishes":"life");
  const studioSelection=next.studioSelection&&(next.surface==="studio"||next.surface==="wardrobe")?next.studioSelection:undefined;
  return {householdId:next.householdId,scope,room:next.surface==="studio"?"making":"together",level:next.surface==="studio"?"above":next.surface==="wardrobe"?"middle":next.room==="conservatory"?"above":next.room==="theatre"?"below":"middle",surface,...(next.surface==="studio"&&next.studioTab?{studioTab:next.studioTab}:{}),...(next.object?{object:[next.object.kind,next.object.id,...("designId" in next.object?[next.object.designId]:[])].join("/")}:{}) ,...(studioSelection?{studioSelection}:{})};
}

export const ROOM_NAMES = {home:"Home", study:"Study", "kitchen-table":"Kitchen Table", together:"Together", making:"Making"} as const;
export const HOUSE_PLACES = {
  home: {above: {title:"Loft", subtitle:"Little banks, growing at their own pace", target:"loft-banks"}, middle: {title:"Queen’s Bay", subtitle:"A living presence at the heart of your home", target:"queen"}, below: {title:"Cellar", subtitle:"What is protected, what is due, what is paid", target:"cellar-bills"}},
  study: {above: {title:"Master Planner", subtitle:"A place to pick up where you left off", target:"planner"}, middle: {title:"The Standing Book", subtitle:"Every figure has a source. Every page has a place.", target:"books"}, below: {title:"Calendar", subtitle:"The same intentions, seen through time", target:"calendar"}},
  "kitchen-table": {above: {title:"Journey", subtitle:"Open the atlas. Step into the life you are making.", target:"journey"}, middle: {title:"One Conversation", subtitle:"One intention, a private note, room to think", target:"conversation"}, below: {title:"Plan Studio", subtitle:"Pull out a proposal. Read the exact agreement.", target:"plan-studio"}},
  together: {above: {title:"Conservatory", subtitle:"Give an idea a little light", target:"wishes"}, middle: {title:"Common room", subtitle:"Make something. Leave a letter. Be here together.", target:"pottery"}, below: {title:"Theatre", subtitle:"Keep the parts of life you choose to remember", target:"memories"}},
  making: {above: {title:"The Kiln", subtitle:"Wheel, bench and a shelf of fired pieces", target:"pottery"}, middle: {title:"Hercules’s Cottage", subtitle:"Wardrobe, mirror, cabinet of wonders, and the bell by the door", target:"wardrobe"}, below: {title:"The cabinet of wonders", subtitle:"The looks and keepsakes he keeps on his shelves", target:"wardrobe"}},
} as const;
export const TARGET_NAMES: Record<string,string> = {queen:"Meet the Queen", "loft-banks":"Open Kitty Banks", "cellar-bills":"Read the bill jars", books:"Open the Standing Book", planner:"Open the Master Planner", calendar:"Unfold the Calendar", journey:"Step into Journey", conversation:"Open the conversation folio", "plan-studio":"Pull out the Plan Studio", wishes:"Tend a wish", pottery:"Enter the Pottery Studio", memories:"Open a memory", letters:"Open the writing desk", projector:"Choose three memories", hercules:"Talk with Hercules", encounters:"Spend a moment together", wardrobe:"Open the dressing room", shift:"Open Shifts",
  // Tool Atlas targets (`src/core/toolAtlas.ts` `AtlasHouseTarget`): the `fund` alias (App opens the Books' Fund pane) and Mine's private folio.
  fund:"Open the Fund", "personal-experience":"Open my private folio"};
