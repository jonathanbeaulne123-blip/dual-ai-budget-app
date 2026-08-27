import type { PostWorkShiftInput } from "./core/index.ts";

export type DuplicateConfirmCode = "duplicate" | "sameShiftDay" | "settingsChanged" | "closedMonth";

export type DuplicateRetryPlan = {
  kind: "work-shift" | "add-form";
  openAdd: boolean;
  setShiftMode: boolean;
};

/** Shift Confirm retry must stay on postWorkShift even when Add is still in expense/income/transfer. */
export function resolveDuplicateRetry(args: {
  pendingWorkShift: PostWorkShiftInput | null;
  confirmCode: DuplicateConfirmCode | null;
  tab: string;
}): DuplicateRetryPlan {
  const shiftRetry = Boolean(
    args.pendingWorkShift
    && (args.confirmCode === "sameShiftDay" || args.confirmCode === "settingsChanged"),
  );
  if (shiftRetry) {
    return {
      kind: "work-shift",
      openAdd: args.tab !== "shift",
      setShiftMode: true,
    };
  }
  return { kind: "add-form", openAdd: true, setShiftMode: false };
}
