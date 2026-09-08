/** Session-only navigation preferences; never household data or write authority. */
export type SharedBoard = "notes" | "photos" | "tasks" | "goals" | "ask";
export type SharedBoardScope = { environment: string; householdId: string; memberId: string };
export const SHARED_BOARD_EVENT = "hearth:shared-board";
export const SHARED_BOARD_REQUEST_EVENT = SHARED_BOARD_EVENT;
const selections = new Map<string, SharedBoard>();
const pending = new Map<string, SharedBoard>();
export const sharedBoardScopeKey = (scope: SharedBoardScope) => JSON.stringify([scope.environment,scope.householdId,scope.memberId]);
export const isSharedBoard = (value: unknown): value is SharedBoard => typeof value === "string" && ["notes","photos","tasks","goals","ask"].includes(value);
function keep(map: Map<string,SharedBoard>,key:string,value:SharedBoard) {
  map.delete(key);map.set(key,value);
  if(map.size>24) map.delete(map.keys().next().value!);
}
export function rememberSharedBoard(scope:SharedBoardScope,board:SharedBoard) {
  const key=sharedBoardScopeKey(scope);keep(selections,key,board);
  try { sessionStorage.setItem(`hearth:shared-board:${key}`,board); } catch { /* Bounded memory works in private mode. */ }
}
export function readSharedBoardSelection(scope:SharedBoardScope):SharedBoard {
  const key=sharedBoardScopeKey(scope);
  try { const saved=sessionStorage.getItem(`hearth:shared-board:${key}`);if(isSharedBoard(saved))return saved; } catch { /* Use session memory. */ }
  return selections.get(key)??"notes";
}
export function requestSharedBoard(scope:SharedBoardScope,board:SharedBoard) {
  if(!isSharedBoard(board))return;
  rememberSharedBoard(scope,board);keep(pending,sharedBoardScopeKey(scope),board);
  try { sessionStorage.setItem(`hearth:shared-board-open:${scope.environment}:${scope.householdId}:${scope.memberId}`,board); } catch { /* Pending memory survives a deferred Home mount. */ }
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(SHARED_BOARD_EVENT,{detail:{scope,board}}));
}
export function takeSharedBoardRequest(scope:SharedBoardScope):SharedBoard|null {
  const key=sharedBoardScopeKey(scope),storageKey=`hearth:shared-board-open:${scope.environment}:${scope.householdId}:${scope.memberId}`;
  let board=pending.get(key)??null;pending.delete(key);
  try { const saved=sessionStorage.getItem(storageKey);sessionStorage.removeItem(storageKey);if(!board&&isSharedBoard(saved))board=saved; } catch { /* Memory request already consumed. */ }
  return board;
}
