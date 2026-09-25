import type { ReactElement } from "react";
import type { MarkerKind } from "./dayLedger.ts";

/**
 * The strip's small silhouettes (Tool Atlas §4.1, A25): a pennant for a
 * payday, a paper slip on a post for a bill, two chairs for the weekly
 * Sitdown, a coin for a posted entry, a gate for the Chapter's station. Each
 * is a different *shape* — they read apart in grayscale — drawn in
 * `currentColor` so forced colours paint them. They are decoration: every
 * day's accessible name says its markers in words.
 */
const PATHS: Record<MarkerKind, ReactElement> = {
  pennant: <><path d="M3 1.5 V11" /><path d="M3 2 L10 4.25 L3 6.5 Z" className="glass-mark__fill" /></>,
  slip: <><path d="M6 8 V11.5" /><path d="M2.5 1.5 H9.5 V8 H2.5 Z" /><circle cx="6" cy="3.6" r=".9" /></>,
  sitdown: <><path d="M1.5 2.5 V11 M1.5 7 H5 V11" /><path d="M10.5 2.5 V11 M10.5 7 H7 V11" /></>,
  coin: <><circle cx="6" cy="6.5" r="4.5" /><circle cx="6" cy="6.5" r="2" /></>,
  gate: <><path d="M2 11 V4 M10 11 V4" /><path d="M2 4 Q6 0.5 10 4" /><path d="M2 7 H10" /></>,
};

export function Marker({ kind, className = "" }: { kind: MarkerKind; className?: string }) {
  return <svg className={`glass-mark glass-mark--${kind} ${className}`.trim()} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" data-mark={kind}>
    {PATHS[kind]}
  </svg>;
}

/** Today's stone: a diamond, so today differs from other days by shape, not colour. */
export function TodayMark() {
  return <svg className="glass-mark glass-mark--today" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" data-mark="today">
    <path d="M6 1 L11 6 L6 11 L1 6 Z" className="glass-mark__fill" />
  </svg>;
}
