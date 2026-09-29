/**
 * Memory stops (P6): only what every active member chose to keep —
 * - hearthside memories kept by everyone (`memoryKeptByEveryone`), dated by the memory's own date;
 * - Wins in `memories(h)` (kept by every active member), dated by the Toronto day they were shown, unless the Win
 *   was already adopted as a hearthside memory (`winMemoryId`) that is itself kept by everyone, which then speaks for it.
 * Never `timeMachine.monthMemories` (auto-derived "goal filled" items are not memories); never a done task.
 */
import { dateKeyInZone, monthKeyFromDateKey, type DateKey } from "../../core/calendar.ts";
import { memories as keptWins } from "../../core/chapters.ts";
import { memoryKeptByEveryone } from "../../hearthside/contracts.ts";
import { winMemoryId } from "../../hearthside/winMemory.ts";
import { journeyIds, type MemoryStop } from "../contracts.ts";
import { action, relationOf } from "./stopKit.ts";
import type { DeriveContext } from "./window.ts";

const isDateKey = (value: unknown): value is DateKey => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export type MemoryRead = { stops: MemoryStop[]; undated: MemoryStop[]; older: MemoryStop[] };

export function memoryStops(ctx: DeriveContext): MemoryRead {
  const out: MemoryRead = { stops: [], undated: [], older: [] };
  if (!ctx.viewerActive) return out;
  const place = (stop: MemoryStop) => {
    if (ctx.monthSet.has(stop.chapterId)) out.stops.push(stop);
    else if (stop.chapterId < ctx.months[0]!) out.older.push(stop);
  };
  const stored = ctx.household.hearthside?.memories ?? [];
  for (const memory of stored) {
    if (!memoryKeptByEveryone(memory, ctx.activeMemberIds)) continue;
    const id = journeyIds.memory(memory.id);
    const date = isDateKey(memory.date) ? memory.date : null;
    const stop: MemoryStop = {
      kind: "memory", id, date: date ?? ctx.today, chapterId: date ? monthKeyFromDateKey(date) : ctx.current, label: memory.title,
      sourceRefs: [{ kind: "hearthsideMemory", id: memory.id }], major: true, relation: date ? relationOf(date, ctx.today) : "today",
      actions: [action(id, "open", "Open the memory", { name: "openPlace", target: "memories", object: `memory/${memory.id}` }, true)],
      status: "kept-by-everyone", memoryKind: "hearthside", hideAmounts: memory.hideAmounts,
    };
    if (date) place(stop); else out.undated.push(stop);
  }
  // Only an adopted memory that the board places speaks for its Win (PR #567 review): while the adoption waits on the
  // other member, or after it is withdrawn, the kept Win stays on the board.
  const adopted = new Set(stored.filter(memory => memoryKeptByEveryone(memory, ctx.activeMemberIds)).map(memory => memory.id));
  for (const win of keptWins(ctx.household)) {
    let adoptedId: string | null = null;
    try { adoptedId = winMemoryId(ctx.household, win.id); } catch { adoptedId = null; }
    if (adoptedId && adopted.has(adoptedId)) continue;
    const shown = new Date(win.shownAt);
    if (!Number.isFinite(shown.getTime()) || shown.getTime() <= 0) continue;
    const date = dateKeyInZone(shown);
    const id = journeyIds.memoryWin(win.id);
    place({
      kind: "memory", id, date, chapterId: monthKeyFromDateKey(date), label: win.title,
      sourceRefs: [{ kind: "win", id: win.id }], major: true, relation: relationOf(date, ctx.today),
      actions: [action(id, "open", "Open our memories", { name: "openPlace", target: "memories" }, true)],
      status: "kept-by-everyone", memoryKind: "win", hideAmounts: win.hideAmounts,
    });
  }
  return out;
}
