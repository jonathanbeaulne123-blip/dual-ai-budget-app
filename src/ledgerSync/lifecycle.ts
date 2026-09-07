import type { Household, CommitResult } from "../core/types.ts";
import { eraseDevelopmentData } from "../core/stressSeed.ts";
import { applyRestorePoint } from "../core/restorePoints.ts";
import { captureCommand } from "./capture.ts";
export const eraseDevelopmentActivity = captureCommand(
  "eraseDevelopmentActivity",
  (household: Household, memberId: string): CommitResult => ({
    household: eraseDevelopmentData(household),
    postedIds: [],
    warnings: [],
    undo: {
      id: crypto.randomUUID(),
      label: "Erase Development activity",
      snapshot: household,
      postedIds: [],
      actorMemberId: memberId,
      commandKind: "eraseDevelopmentActivity",
    },
  }),
);
export const restoreSharedPoint = captureCommand(
  "restoreSharedPoint",
  (household: Household, pointId: string, memberId: string): CommitResult => {
    const point = household.restorePoints?.find(
      (point) => point.id === pointId,
    );
    if (!point) throw new Error("RESTORE_POINT_MISSING");
    return {
      household: applyRestorePoint(household, point, memberId, {
        isOwner: true,
      }),
      postedIds: [],
      warnings: [],
      undo: {
        id: crypto.randomUUID(),
        label: "Restore shared books",
        snapshot: household,
        postedIds: [],
        actorMemberId: memberId,
        commandKind: "restoreSharedPoint",
      },
    };
  },
);
