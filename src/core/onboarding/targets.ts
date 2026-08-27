/**
 * Stable target contract: data-onboarding-id resolution.
 * No querySelector-by-class/text guesses.
 */

export const ONBOARDING_TARGET_ATTR = "data-onboarding-id";

/** Minimum foundation anchors for Slice A proofs. */
export const FOUNDATION_TARGET_IDS = [
  "home.root",
  "nav.home",
  "nav.calendar",
  "nav.plan",
  "nav.ledger",
  "nav.more",
  "nav.add",
  "more.replay-tutorial",
  "onboarding.skip",
] as const;

export type FoundationTargetId = (typeof FOUNDATION_TARGET_IDS)[number];

export type TargetResolution =
  | { ok: true; targetId: string; element: Element }
  | { ok: false; targetId: string; reason: "missing" | "detached" };

export function targetSelector(targetId: string): string {
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(targetId)
      : targetId.replace(/"/g, '\\"');
  return `[${ONBOARDING_TARGET_ATTR}="${escaped}"]`;
}

export function resolveOnboardingTarget(
  root: ParentNode,
  targetId: string,
): TargetResolution {
  const el = root.querySelector(targetSelector(targetId));
  if (!el) return { ok: false, targetId, reason: "missing" };
  if (!el.isConnected) return { ok: false, targetId, reason: "detached" };
  return { ok: true, targetId, element: el };
}

export function listRegisteredTargetIds(root: ParentNode): string[] {
  const nodes = root.querySelectorAll(`[${ONBOARDING_TARGET_ATTR}]`);
  const ids: string[] = [];
  nodes.forEach((node) => {
    const id = node.getAttribute(ONBOARDING_TARGET_ATTR);
    if (id) ids.push(id);
  });
  return ids;
}

export function onboardingTargetProps(targetId: string): { "data-onboarding-id": string } {
  return { "data-onboarding-id": targetId };
}
