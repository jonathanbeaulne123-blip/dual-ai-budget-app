/**
 * Little Harbour · where the Court's camera stands (BUILD_PLAN #18).
 *
 * Everything here is pure: the layout of the Court on the ground, the poses
 * the camera flies to, and the maths that says what a pose can see. Nothing
 * reads three.js, the DOM, time or money. `courtCamera.ts` drives a real
 * camera through these; `test/harbour-camera-poses.test.ts` checks the one
 * invariant that matters on a phone — the Everyday flagstone, the number you
 * came for, is inside the frame in every phone pose.
 *
 * ## The layout (world units; the Queen is 2.05 tall)
 *
 * The Queen stands at the origin on a terrace of radius 6. +z is the gate
 * side, toward the camera in the diorama pose; -z is behind her.
 *
 * ```
 *          knight (-4.2, -3.0)        rook (+4.2, -3.0)
 *                        Queen (0, 0)
 *                    flagstone (0, +1.6)
 *        mailbox (-1.2, +5.4)   bishop (0, +4.6)   sundial (+4.0, +3.2)
 *                          gate (0, +6.2)
 * ```
 *
 * ## The camera model
 *
 * A pose is a `RoamCam` with a lifted target: the eye sits at distance `r`
 * from `target`, `phi` radians from vertical (0 = straight overhead), swung
 * `theta` radians from +z. `theta = 0` looks at the Queen's face from the
 * gate. This is the island's camera (`roamCamera.ts` `roamEye`) with the
 * target allowed off the ground, so the same drag and zoom feel carry over.
 */

export type CourtMode = "sky" | "court" | "object";
export type CourtAnchor = "queen" | "rook" | "bishop" | "knight" | "sundial" | "mailbox" | "gate";
export type Composition = "phone" | "desktop";
export type Vec3 = readonly [number, number, number];

export type CourtPose = {
  /** What the camera looks at, in world units (y may be above the ground). */
  target: Vec3;
  /** Distance from the target to the eye. */
  r: number;
  /** Heading around the target, radians from +z (0 = the gate side, facing the Queen). */
  theta: number;
  /** Tilt from vertical, radians (0 = overhead, π/2 = horizon). */
  phi: number;
};

/** The vertical field of view the Court's camera uses, in degrees (three.js `fov`). */
export const COURT_FOV = 42;
export const TERRACE_RADIUS = 6;

/** Where each anchor stands on the ground. */
export const COURT_ANCHORS: Readonly<Record<CourtAnchor, Vec3>> = Object.freeze({
  queen: [0, 0, 0],
  rook: [4.2, 0, -3.0],
  knight: [-4.2, 0, -3.0],
  bishop: [0, 0, 4.6],
  sundial: [4.0, 0, 3.2],
  mailbox: [-1.2, 0, 5.4],
  gate: [0, 0, 6.2],
});

export const COURT_ANCHOR_IDS: readonly CourtAnchor[] = Object.freeze(["queen", "rook", "bishop", "knight", "sundial", "mailbox", "gate"]);

/** The Everyday flagstone: the stone at the Queen's feet that carries the household's "now" number. A square on the ground. */
export const FLAGSTONE = Object.freeze({ x: 0, z: 1.6, size: 0.9 });

/** How far the camera may go: distance, tilt and how far the target may wander from the Queen. */
/**
 * How far the camera may go. `maxPhi` is a tilt from vertical: slice 1's Court
 * never needed below 1.2, but the Tower is six units tall and the Cellar is a
 * room with a ceiling, and both are read from nearly eye level — so the limit
 * is 1.38 (about 11° above the horizon). `minR` is 2 for the same reason: a
 * room six units across has to be able to bring one bank or one jar close, and
 * three was already most of the way to the far wall. Every Court pose is
 * unchanged; the bounds only say how far a hand may take the camera.
 */
export const COURT_BOUNDS = Object.freeze({ minR: 2, maxR: 22, minPhi: 0.25, maxPhi: 1.38, targetRadius: 9 });

/** How high on each anchor the "object" pose looks (about mid-height of what stands there). */
const ANCHOR_LOOK_HEIGHT: Readonly<Record<CourtAnchor, number>> = Object.freeze({
  queen: 1.0, rook: 1.05, knight: 1.0, bishop: 1.1, sundial: 0.7, mailbox: 0.9, gate: 1.0,
});

/**
 * How close the "object" pose comes. Pieces and props are framed at 3.2; the
 * Queen is 2.05 tall and the flagstone lies at her feet, so her portrait
 * stands back far enough to keep both in a phone's frame.
 */
const ANCHOR_OBJECT_R: Readonly<Record<CourtAnchor, { phone: number; desktop: number }>> = Object.freeze({
  queen: { phone: 5.4, desktop: 5.4 },
  rook: { phone: 3.2, desktop: 3.2 },
  knight: { phone: 3.2, desktop: 3.2 },
  bishop: { phone: 3.2, desktop: 3.2 },
  sundial: { phone: 3.2, desktop: 3.2 },
  mailbox: { phone: 3.2, desktop: 3.2 },
  gate: { phone: 3.4, desktop: 3.4 },
});

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (theta: number) => Math.atan2(Math.sin(theta), Math.cos(theta));

/** The heading that puts the eye on the far side of `anchor` from the flagstone, looking over it toward the stone. */
function headingOverShoulder(anchor: CourtAnchor): number {
  const [ax, , az] = COURT_ANCHORS[anchor];
  const dx = ax - FLAGSTONE.x, dz = az - FLAGSTONE.z;
  // The eye sits at (+sin θ, +cos θ) from the target: put it along the flagstone→anchor line, beyond the anchor.
  return Math.atan2(dx, dz);
}

/**
 * The camera pose for a mode. `aspect` is the stage's width ÷ height and
 * `fov` the camera's vertical field in degrees. On desktop the diorama pulls
 * back until the plinths (x = ±4.2) fit the width. A portrait phone cannot
 * hold that width at any legal distance (it would need r ≈ 26 at 42°), so
 * the phone diorama keeps the Queen, the flagstone and the bishop large
 * instead and the rook and knight are one swipe to either side; the sky pose
 * is where a phone sees the whole Court.
 */
export function courtPose(mode: CourtMode, anchor: CourtAnchor | undefined, composition: Composition, aspect: number, fov = COURT_FOV): CourtPose {
  const phone = composition === "phone";
  const safeAspect = clamp(Number.isFinite(aspect) && aspect > 0 ? aspect : phone ? 0.5 : 1.6, 0.3, 4);
  if (mode === "sky") {
    return { target: [0, 0.4, 0.8], r: COURT_BOUNDS.maxR, theta: phone ? 0.12 : 0.18, phi: phone ? 0.55 : 0.62 };
  }
  if (mode === "court") {
    // Fit the plinths (x = ±4.2, plus a shoulder) inside the horizontal field at the pieces' depth. The desktop
    // diorama is a true three-quarter: swung half a radian from the gate so the gate and the sundial stand at the
    // frame's edge instead of looming in front of her, and low enough that the plinth plates read.
    const halfH = Math.tan((fov * Math.PI) / 360) * safeAspect;
    // A portrait tablet is a wide phone: the plinths cannot fit its column either, so she stays large.
    const column = phone || safeAspect < 1.05;
    const phi = column ? 0.9 : 1.04;
    const wanted = (4.2 + 1.2) / halfH / Math.sin(phi);
    const r = phone ? 8.6 : column ? 9.8 : clamp(wanted, 11.5, COURT_BOUNDS.maxR - 2);
    // The desktop target sits a little right of and in front of her so the sundial clears the compass pill.
    // The phone target sits a little toward the gate so the Bishop's head and plate are inside the column.
    return { target: column ? [0.15, 0.8, 1.7] : [0.5, 0.9, 0.9], r, theta: column ? 0.06 : 0.5, phi };
  }
  const id: CourtAnchor = anchor ?? "queen";
  const [ax, , az] = COURT_ANCHORS[id];
  const r = ANCHOR_OBJECT_R[id][composition];
  if (id === "queen") {
    // Her portrait: from the gate, a little to her left so the crown reads, the flagstone at her feet in the frame.
    return phone
      ? { target: [0, 0.98, 0.55], r, theta: 0.14, phi: 1.02 }
      : { target: [0, 0.95, 0.5], r, theta: 0.38, phi: 1.02 };
  }
  // Stand beyond the piece and look over its shoulder at the flagstone and the Queen, swung toward the gate side so
  // the face reads in profile. A phone's frame is a narrow column, so its swing is small; a desktop can take a
  // three-quarter view and still keep the stone.
  const swing = (phone ? 0.09 : 0.5) * (ax > 0 ? -1 : 1);
  return { target: [ax, ANCHOR_LOOK_HEIGHT[id], az], r, theta: wrap(headingOverShoulder(id) + swing), phi: phone ? 1.0 : 1.05 };
}

/** Where the eye stands for a pose. */
export function poseEye(pose: CourtPose): Vec3 {
  const h = pose.r * Math.sin(pose.phi);
  return [pose.target[0] + h * Math.sin(pose.theta), pose.target[1] + pose.r * Math.cos(pose.phi), pose.target[2] + h * Math.cos(pose.theta)];
}

/**
 * A world point in the pose's normalised device space: x and y in -1…1 are
 * inside the frame, `depth` is the distance along the view axis (behind the
 * eye when ≤ 0, in which case x and y are meaningless).
 */
export function projectPoint(pose: CourtPose, point: Vec3, aspect: number, fov = COURT_FOV): { x: number; y: number; depth: number } {
  const eye = poseEye(pose);
  // Forward, right and up of a camera that looks from the eye at the target with world +y up.
  let fx = pose.target[0] - eye[0], fy = pose.target[1] - eye[1], fz = pose.target[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // right = forward × up(0,1,0)
  let rx = -fz, rz = fx;
  const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  // up = right × forward
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const vx = point[0] - eye[0], vy = point[1] - eye[1], vz = point[2] - eye[2];
  const depth = vx * fx + vy * fy + vz * fz;
  const tanV = Math.tan((fov * Math.PI) / 360), tanH = tanV * Math.max(aspect, 1e-3);
  if (depth <= 1e-6) return { x: Infinity, y: Infinity, depth };
  return { x: (vx * rx + vz * rz) / (depth * tanH), y: (vx * ux + vy * uy + vz * uz) / (depth * tanV), depth };
}

/**
 * Is the whole Everyday flagstone inside the frame? Every corner of the stone
 * must project within the frustum with a little margin, so the number is
 * readable and tappable, never clipped by the stage edge.
 */
export function flagstoneVisible(pose: CourtPose, aspect: number, fov = COURT_FOV, margin = 0.04): boolean {
  const half = FLAGSTONE.size / 2;
  const corners: Vec3[] = [
    [FLAGSTONE.x - half, 0, FLAGSTONE.z - half], [FLAGSTONE.x + half, 0, FLAGSTONE.z - half],
    [FLAGSTONE.x - half, 0, FLAGSTONE.z + half], [FLAGSTONE.x + half, 0, FLAGSTONE.z + half],
  ];
  const limit = 1 - margin;
  return corners.every((corner) => {
    const p = projectPoint(pose, corner, aspect, fov);
    return p.depth > 0.1 && Math.abs(p.x) <= limit && Math.abs(p.y) <= limit;
  });
}

/**
 * A room's hold on the camera (BUILD_PLAN_SLICE2 addendum): the box the **eye**
 * must stay inside, the smaller box the target may wander in, and the room's
 * own distance and tilt limits. The Court has no hold — it is open sky — but a
 * room six units across must not be seen from the lawn: with the ceiling
 * one-sided and the walls thin, an eye outside the shell shows a doll's box,
 * and a stale return slot written by an older build can put it there.
 */
export type RoomHold = {
  /** The eye stays inside this box, inclusive. */
  eye: { min: Vec3; max: Vec3 };
  /** The target stays inside this box. */
  target: { min: Vec3; max: Vec3 };
  minR: number;
  maxR: number;
  minPhi: number;
  maxPhi: number;
};

const held = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Hold a pose inside a room. Pure and total. The target is clamped into its
 * box first; then, with the pose's own direction kept, `r` is shortened until
 * the eye sits inside the eye box — never lengthened, and never below `minR`.
 * A pose already inside comes back identical.
 */
export function holdPoseInRoom(pose: CourtPose, hold: RoomHold | null): CourtPose {
  if (!hold) return pose;
  const target: [number, number, number] = [
    held(pose.target[0], hold.target.min[0], hold.target.max[0]),
    held(pose.target[1], hold.target.min[1], hold.target.max[1]),
    held(pose.target[2], hold.target.min[2], hold.target.max[2]),
  ];
  const phi = held(Number.isFinite(pose.phi) ? pose.phi : hold.maxPhi, hold.minPhi, hold.maxPhi);
  const theta = wrap(Number.isFinite(pose.theta) ? pose.theta : 0);
  let r = held(Number.isFinite(pose.r) ? pose.r : hold.maxR, hold.minR, hold.maxR);
  // The eye sits at target + r·direction; shorten r so every axis stays in its
  // box. Containment beats closeness: when the box demands it, r goes below
  // `minR` too — a floor that pushed the eye back through the wall would be a
  // floor on the wrong thing — with a hand's breadth left as the last resort.
  const direction: Vec3 = [Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)];
  let room = Number.POSITIVE_INFINITY;
  for (let axis = 0; axis < 3; axis++) {
    const d = direction[axis]!;
    if (Math.abs(d) < 1e-9) continue;
    const limit = ((d > 0 ? hold.eye.max[axis]! : hold.eye.min[axis]!) - target[axis]!) / d;
    if (limit < room) room = limit;
  }
  r = Math.min(r, Math.max(0.2, room));
  return { target, r, theta, phi };
}

/** Hold a pose inside the Court's bounds (the same rule `clampRoamCam` applies to the live camera). */
export function clampCourtPose(pose: CourtPose): CourtPose {
  const [tx, ty, tz] = pose.target;
  const d = Math.hypot(tx, tz);
  const k = d > COURT_BOUNDS.targetRadius && d > 0 ? COURT_BOUNDS.targetRadius / d : 1;
  return {
    target: [tx * k, ty, tz * k],
    r: clamp(pose.r, COURT_BOUNDS.minR, COURT_BOUNDS.maxR),
    theta: wrap(pose.theta),
    phi: clamp(pose.phi, COURT_BOUNDS.minPhi, COURT_BOUNDS.maxPhi),
  };
}

/** Are two poses the same to the eye? */
export function samePose(a: CourtPose, b: CourtPose, epsilon = 1e-3): boolean {
  return Math.abs(a.r - b.r) < epsilon && Math.abs(a.phi - b.phi) < epsilon && Math.abs(wrap(a.theta - b.theta)) < epsilon
    && a.target.every((v, i) => Math.abs(v - (b.target[i] ?? Number.NaN)) < epsilon);
}
