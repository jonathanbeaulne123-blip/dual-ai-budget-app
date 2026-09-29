import { journeyIds, type Stop, type StopCluster } from "../contracts.ts";
import { compareStops } from "./stopKit.ts";
import { shortDate } from "./words.ts";

/** Two or more stops on one date become one expandable cluster tile (never overlapping tiles or branches). */
export function clusterStops(stops: readonly Stop[]): StopCluster[] {
  const byDate = new Map<string, Stop[]>();
  for (const stop of stops) byDate.set(stop.date, [...(byDate.get(stop.date) ?? []), stop]);
  const out: StopCluster[] = [];
  for (const [date, rows] of byDate) {
    if (rows.length < 2) continue;
    const ordered = [...rows].sort(compareStops);
    out.push({
      id: journeyIds.cluster(date), date, chapterId: ordered[0]!.chapterId,
      stopIds: ordered.map(stop => stop.id), label: `${ordered.length} on ${shortDate(date)}`,
      major: ordered.some(stop => stop.major),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
