import { partStyle } from "./transform.ts";
import type { RigPartId, RigSnapshot } from "./types.ts";

export function snapshotToDomStyles(snapshot: RigSnapshot): Record<RigPartId, Record<string, string | number | undefined>> {
  const styles = {} as Record<RigPartId, Record<string, string | number | undefined>>;
  for (const part of Object.keys(snapshot) as RigPartId[]) {
    styles[part] = partStyle(part, snapshot[part]);
  }
  return styles;
}

export function rigRootClassName(mood: string, rigDriven = true): string {
  return ["herc", rigDriven ? "herc-rig-driven" : "", `herc-mood-${mood}`].filter(Boolean).join(" ");
}
