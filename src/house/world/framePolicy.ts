export type HouseFrameActivity = {
  reduced: boolean;
  moving: boolean;
  walking: boolean;
  movedWalker: boolean;
  settledCamera: boolean;
  projectionChanged: boolean;
};

/**
 * The house is an invalidation-driven scene. Camera and walking transitions
 * request another frame; settled scenes sleep until data, size or controls
 * invalidate them again.
 */
export function houseFramePolicy(activity: HouseFrameActivity) {
  const active = activity.moving || activity.walking;
  return {
    animate: !activity.reduced && active,
    render: active || activity.movedWalker || activity.settledCamera || activity.projectionChanged,
    schedule: active,
  };
}
