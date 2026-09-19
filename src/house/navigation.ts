import { housePath, parseHouseRoute, type HouseRoute } from "../hearthside/houseRoutes.ts";
import type { Environment, LedgerView } from "../core/types.ts";
import type { HearthsideRoute } from "../hearthside/routes.ts";

export const HOUSE_WORLD_ENABLED = import.meta.env.VITE_HEARTH_HOUSE_WORLD === "1";
export type HouseIdentity = { environment: Environment; householdId: string; memberId: string; scope: LedgerView };
export type HouseReturn = { version: 1; identity: string; route: HouseRoute; focus: string; scroll: number; camera?: [number, number, number]; at: string };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const houseIdentity = (identity: HouseIdentity) => [identity.environment, identity.householdId, identity.memberId, identity.scope].map(encodeURIComponent).join(":");
const key = (identity: HouseIdentity, object = "arrival") => `hearth:house:v1:${houseIdentity(identity)}:${encodeURIComponent(object)}`;
export function saveHouseReturn(storage: Store, identity: HouseIdentity, route: HouseRoute, options: Partial<Pick<HouseReturn, "focus" | "scroll" | "camera">> = {}, object = "arrival"): void {
  if (route.householdId !== identity.householdId || route.scope && route.scope !== identity.scope) return;
  const record: HouseReturn = {version: 1, identity: houseIdentity(identity), route: {...route, scope: identity.scope}, focus: options.focus?.slice(0, 180) ?? "house-world-title", scroll: Math.max(0, Math.min(1e7, options.scroll ?? 0)), ...(options.camera?.every(Number.isFinite) ? {camera: options.camera} : {}), at: new Date().toISOString()};
  try { storage.setItem(key(identity, object), JSON.stringify(record)); } catch { /* Navigation still works when device storage is unavailable. */ }
}
export function readHouseReturn(storage: Store, identity: HouseIdentity, object = "arrival"): HouseReturn | null {
  try {
    const value = JSON.parse(storage.getItem(key(identity, object)) ?? "null") as HouseReturn | null;
    if (!value || value.version !== 1 || value.identity !== houseIdentity(identity) || value.route.scope !== identity.scope) return null;
    const route = parseHouseRoute(housePath(value.route), identity.householdId);
    if (!route || typeof value.focus !== "string" || !Number.isFinite(value.scroll)) return null;
    return {...value, route, scroll: Math.max(0, Math.min(1e7, value.scroll))};
  } catch { return null; }
}
export function houseSurfaceRoute(route: HouseRoute, surface: string, object?: string): HouseRoute {
  return {...route, surface, ...(object ? {object} : {})};
}
export function houseRoomRoute(route: HouseRoute): HouseRoute { const {surface: _surface, ...room} = route; return room; }
export function houseLifeRoute(route: HouseRoute): HearthsideRoute {
  const room=route.surface==="pottery"||route.surface==="wardrobe"?"studio":route.level==="above"?"conservatory":route.level==="below"?"theatre":"common";
  const surface=route.surface==="pottery"?"studio":(["letters","projector","encounters","wardrobe","practical","history","occasions","worktable","guests","restore"].includes(route.surface??"")?route.surface:undefined) as HearthsideRoute["surface"];
  const [kind,id,designId]=route.object?.split("/")??[];
  const object=(kind==="experience"||kind==="memory"||kind==="note"||kind==="encounter")&&id?{kind,id}:kind==="piece"&&id&&designId?{kind,id,designId}:undefined;
  return {version:1,householdId:route.householdId,room,mode:room==="conservatory"?"imagine":room==="theatre"?"remember":"present",...(surface?{surface}:{}),...(object?{object:object as HearthsideRoute["object"]}:{})};
}
export function houseRouteFromLife(next: HearthsideRoute, scope: LedgerView): HouseRoute {
  return {householdId:next.householdId,scope,room:"together",level:next.room==="conservatory"?"above":next.room==="theatre"?"below":"middle",surface:next.surface==="studio"?"pottery":next.surface??(next.room==="theatre"?"memories":next.room==="conservatory"?"wishes":"life"),...(next.object?{object:[next.object.kind,next.object.id,...("designId" in next.object?[next.object.designId]:[])].join("/")}:{})};
}

export const ROOM_NAMES = {home:"Home", study:"Study", "kitchen-table":"Kitchen Table", together:"Together"} as const;
export const HOUSE_PLACES = {
  home: {above: {title:"Loft", subtitle:"Little banks, growing at their own pace", target:"loft-banks"}, middle: {title:"Queen’s Bay", subtitle:"A living presence at the heart of your home", target:"queen"}, below: {title:"Cellar", subtitle:"What is protected, what is due, what is paid", target:"cellar-bills"}},
  study: {above: {title:"Master Planner", subtitle:"A place to pick up where you left off", target:"planner"}, middle: {title:"The Standing Book", subtitle:"Every figure has a source. Every page has a place.", target:"books"}, below: {title:"Calendar", subtitle:"The same intentions, seen through time", target:"calendar"}},
  "kitchen-table": {above: {title:"Journey", subtitle:"Open the atlas. Step into the life you are making.", target:"journey"}, middle: {title:"One Conversation", subtitle:"One intention, a private note, room to think", target:"conversation"}, below: {title:"Plan Studio", subtitle:"Pull out a proposal. Read the exact agreement.", target:"plan-studio"}},
  together: {above: {title:"Conservatory", subtitle:"Give an idea a little light", target:"wishes"}, middle: {title:"Common room", subtitle:"Make something. Leave a letter. Be here together.", target:"pottery"}, below: {title:"Theatre", subtitle:"Keep the parts of life you choose to remember", target:"memories"}},
} as const;
export const TARGET_NAMES: Record<string,string> = {queen:"Meet the Queen", "loft-banks":"Open Kitty Banks", "cellar-bills":"Read the bill jars", books:"Open the Standing Book", planner:"Open the Master Planner", calendar:"Unfold the Calendar", journey:"Step into Journey", conversation:"Open the conversation folio", "plan-studio":"Pull out the Plan Studio", wishes:"Tend a wish", pottery:"Enter the Pottery Studio", memories:"Open a memory", letters:"Open the writing desk", projector:"Choose three memories", hercules:"Talk with Hercules", encounters:"Spend a moment together"};
