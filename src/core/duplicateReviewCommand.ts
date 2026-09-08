import { markDuplicate } from "./commands.ts";
import { prepareDuplicateReview, type DuplicateReview } from "./duplicateReview.ts";
import type { Household, CommitResult } from "./types.ts";
export function applyDuplicateReview(h:Household,review:Extract<DuplicateReview,{kind:"ready"}>):CommitResult {
  const current=prepareDuplicateReview(h,review.request);
  if(current.kind!=="ready" || current.basis!==review.basis)throw new Error("These entries or their linked sources changed. Review them again before confirming.");
  return markDuplicate(h,review.request.targetId,review.request.isDuplicate,{request:review.request});
}
