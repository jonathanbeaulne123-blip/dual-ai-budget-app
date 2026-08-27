/**
 * Route-plan abstraction — later adapters map to Hercules / OfficeIntent.
 * Slice A keeps pure plans without embedding scene sequence in pages.
 */

import type { HerculesRouteSegment, OnboardingScene } from "./types.ts";

export type ResolvedRoutePlan = {
  sceneId: string;
  segments: HerculesRouteSegment[];
  endsAt: "target" | "nav" | "point";
};

export function planForScene(scene: OnboardingScene): ResolvedRoutePlan {
  const last = scene.routePlan[scene.routePlan.length - 1];
  let endsAt: ResolvedRoutePlan["endsAt"] = "target";
  if (last) {
    if (last.to === "nav") endsAt = "nav";
    else if (typeof last.to === "object") endsAt = "point";
    else endsAt = "target";
  }
  return {
    sceneId: scene.id,
    segments: scene.routePlan,
    endsAt,
  };
}

/** Nav control is the continuous page-transition anchor (D-129). */
export function navAnchorTargetId(tab: string): string {
  switch (tab) {
    case "home":
      return "nav.home";
    case "calendar":
      return "nav.calendar";
    case "plan":
      return "nav.plan";
    case "ledger":
      return "nav.ledger";
    case "more":
      return "nav.more";
    case "add":
      return "nav.add";
    default:
      return "nav.home";
  }
}
