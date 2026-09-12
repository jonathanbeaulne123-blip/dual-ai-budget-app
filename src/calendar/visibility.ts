import type { BoardItem } from "../core/board.ts";
import { KIND_LAYERS, kindLayerFor, type KindLayer } from "./semantics.ts";

/** The filter list is the registry's layer list: one enumeration for kinds, legend and toggles. */
export const calendarLayers = KIND_LAYERS;
export type CalendarVisibility = Record<string, boolean>;
export function calendarItemVisible(item: BoardItem, visibility: CalendarVisibility): boolean {
  const layer: KindLayer = kindLayerFor(item);
  return visibility[layer] !== false && (item.source !== "google" || !item.calendarId || visibility[`google:${item.calendarId}`] !== false);
}
export function loadCalendarVisibility(key: string): CalendarVisibility {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, setting]) => typeof setting === "boolean"));
  } catch { return {}; }
}
