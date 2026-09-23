import { holdAshore, holdInRoom, pushOut } from "./obstacles.ts";
import { RUN_SPEED, WALK_SPEED, wrapAngle, type BodyWorld, type EmoteId } from "./bodyModel.ts";

/**
 * Little Harbour · how Hercules moves.
 *
 * Pure, exactly as `bodyModel.ts` is pure: a state, what the person is doing,
 * a `dt`, and the world he is standing in go in; the next state comes out.
 * No three.js, no DOM, no clock, no money. `body/cat.ts` gives it meshes and
 * `scene/runtime.ts` gives it the frame the renderer lease already owns.
 *
 * ## Scale
 *
 * The travelling cat is **0.28** units tall beside a 1.25-unit playable
 * person. His compact procedural figure shares the movement runtime:
 * there is a rigged cat
 * in `models/hercules.source.glb` and it belongs in the Cottage, where you
 * look at him. Out here he is one of forty things on screen at fifty metres
 * and a downloaded skeleton would buy nothing you could see.
 *
 * ## The heel
 *
 * He does not chase your position; he walks to a **heel point** — a stride
 * behind your shoulder and a little to one side. That one indirection is the
 * whole feel of it: the spacing is deliberate rather than emergent, he is
 * never underfoot because the point he wants is not the point you occupy, and
 * the lag is real lag rather than a delay line, because he has mass and has to
 * accelerate into it like anything else.
 *
 * ## Rest
 *
 * A cat that grooms forever keeps the world awake. Every mood here either is
 * terminal (`sit`, `flop`, `wait`) or falls to one that is, on a clock; and
 * `life` — the amplitude every flourish is multiplied by — eases to exactly
 * zero and is snapped there. `stepCat` returns `moving: false` after that, the
 * frame policy asks for nothing, and the island sleeps with a cat asleep on
 * it. `test/harbour-hercules.test.ts` is the promise that this is kept.
 */

/** Compact travelling scale beside the playable person. */
export const CAT_HEIGHT = 0.28;
/** What he cannot be pushed inside of. A cat threads gaps a person does not. */
export const CAT_RADIUS = 0.1;

/**
 * A trot, and a run. The trot is a shade quicker than your walk (2.1) so he
 * can close the lag a walk opens; the run is a shade quicker than your run
 * (4.0) for the same reason. Neither is a speed he holds for its own sake: the
 * top speed he is allowed on any frame is read off *yours*.
 */
export const CAT_TROT = 2.45, CAT_RUN = 4.7;
/** Quick off the mark even for his size, and he stops like a cat: at once. */
export const CAT_ACCELERATION = 17, CAT_BRAKING = 11;
export const CAT_TURN_RATE = 13;
/** One diagonal pair per π of phase, at this stride. A short cat has a short step. */
export const CAT_STRIDE = 0.3;

/**
 * Where the heel point sits: this far behind your shoulder, this far to your
 * left. He walks at your **flank** rather than in your shadow, and that is a
 * framing decision as much as a feel one: the follow camera stands 3.4 behind
 * you, so a cat directly behind you is between it and you and spends the walk
 * under the bottom edge of the screen. Out to the side he is beside you in
 * frame, where you can actually watch him — which is the entire point of him.
 */
export const HEEL_BACK = 0.52, HEEL_SIDE = 0.62;
/** Inside this of the heel point he simply stops. This is why he is never underfoot. */
export const HEEL_CLOSE = 0.26;
/** Further than this from the heel point and he breaks into a run to close it. */
export const CATCH_UP = 1.55;
/** A wave brings him in to this, right at your feet, for as long as the answer lasts. */
export const COME_CLOSE = 0.36, COME_SECONDS = 3.2;

/**
 * The small-scene fallback. The island supplies its larger dry shoreline
 * through BodyWorld.shore so he follows across the whole landscape.
 */
export const CAT_SHORE = 18.4;

/**
 * How near the door counts as arrived — for him — and how near **you** must
 * come before the errand counts as having been shown to you. The second is a
 * placed building's own `doorRadius` (1.4–1.5): the distance at which the
 * threshold machinery already says you are at a door, and not a step further.
 */
export const DOOR_REACH = 0.34, ERRAND_MET = 1.45;
/** Offer a nearby door; a distant task must not pull him away from an exploring person. */
export const GUIDE_REACH = 12;

/** How long you must stand still before he stops being a dog about it and settles. */
export const MOOD_AFTER = 0.9;

/**
 * Rounding a corner. A cat walking straight at the heel point walks straight
 * into whatever is between him and it — the stairhead, the Queen's pot, a
 * tree — and a push-out alone will hold him against it for ever, which is a
 * jam *and* a world that can never sleep. So on a frame where the direct line
 * got him nowhere he tries the same step turned this far to either side and
 * takes whichever one actually gains ground. Two extra push-outs, and only on
 * the frames where he is against something.
 */
export const DETOUR = 1.15;
/**
 * And he **commits** to the side he picked for this long. A greedy choice made
 * fresh every frame is how a follower ends up jittering against a wall: the
 * lateral step gains no ground on the target, so a "which gets me closer"
 * test picks neither and he stands there. Skirting is a decision that has to
 * outlive the frame that made it, and this is how long it does.
 */
export const SKIRT_SECONDS = 0.9;
/**
 * And if even that gets him nowhere for this long, he gives up and settles
 * where he is. A cat wedged behind a plant pot sits down; he does not run on
 * the spot for the rest of the afternoon, and the island is allowed to sleep.
 * He tries again the moment the gap to what he wanted has changed — which is
 * the moment you walk on, and is almost always what frees him.
 */
export const CAT_STUCK = 1.5, CAT_UNSTICK = 0.5;

/**
 * A perch — the Queen's own flagstone, warm and in the light — that he will
 * take *instead of* your heel when you stop near enough to it. This far from
 * the heel point and no further: a cat crosses a terrace for a warm stone, he
 * does not cross an island for one, and he certainly does not leave you.
 */
export const PERCH_REACH = 2.4;

export const CAT_MOODS = ["trot", "watch", "sit", "groom", "flop", "look-up", "bounce", "wait"] as const;
export type CatMood = (typeof CAT_MOODS)[number];

/**
 * How long a mood lasts and what it falls to. `null` is terminal: he stays
 * there, `life` eases to nothing, and the frame policy reaches rest. Every
 * chain in this table ends at a terminal mood in at most two hops, which is
 * the whole of the promise above.
 */
export const MOOD_AFTER_SECONDS: Readonly<Record<CatMood, number | null>> = Object.freeze({
  trot: null, watch: 1.2, sit: null, groom: 2.6, flop: null, "look-up": 1.2, bounce: 1.8, wait: null,
});
export const MOOD_FALLS_TO: Readonly<Record<CatMood, CatMood>> = Object.freeze({
  trot: "trot", watch: "sit", sit: "sit", groom: "sit", flop: "flop", "look-up": "watch", bounce: "watch", wait: "wait",
});
/** Which moods are a cat sitting down, for the figure's one pose blend. */
export const MOOD_SEATED: Readonly<Record<CatMood, number>> = Object.freeze({
  trot: 0, watch: 0, sit: 1, groom: 1, flop: 1, "look-up": 0, bounce: 0, wait: 1,
});
/** And which ones are still performing, so `life` knows to stay up. */
const MOOD_LIVE: ReadonlySet<CatMood> = new Set<CatMood>(["watch", "groom", "look-up", "bounce"]);

/** The door he has been sent to, and the reading key that sent him. */
export type CatErrand = { key: string; x: number; z: number; yaw: number };

/** What the person is doing, as the cat reads it. Position, facing, speed, feet off the ground, and anything said. */
export type CatSubject = { x: number; z: number; yaw: number; speed: number; air: number; emote: EmoteId | null };

export type CatState = {
  x: number;
  z: number;
  /** The ground under his paws, from the same `groundHeightAt` the person walks on. */
  y: number;
  yaw: number;
  speed: number;
  /** The gait's phase; one diagonal pair per π. */
  phase: number;
  /** 0 a trot, 1 a bound: which of the two gaits the legs are playing. */
  bound: number;
  mood: CatMood;
  moodAt: number;
  /** How long the person has been standing still, in seconds. */
  still: number;
  /** 0 on his feet, 1 sitting — eased, so standing up is a movement and not a cut. */
  seated: number;
  /** The amplitude every flourish is multiplied by. Reaches exactly zero; that is why the world can sleep. */
  life: number;
  /** Ears: 0 laid back, 1 pricked. Pricked at a run, at a door and at you. */
  ears: number;
  /** Seconds left of coming when you waved. */
  come: number;
  /**
   * Seconds left of something he is *saying* — the bounce you danced for, the
   * look up at your jump, the glance when you laughed. While this is running
   * and you are standing still he says it **where he stands**: a cat answering
   * you does not also shuffle a hand's breadth sideways to tidy up his
   * spacing. Anything you do ends it.
   */
  saying: number;
  errand: CatErrand | null;
  /**
   * The errand he has already shown you, by key — **not** a boolean, because
   * an errand comes and goes as you cross a threshold (indoors there are no
   * doors of his to lead you to) and a boolean would re-arm the same bill
   * every time you stepped out of a building. He has shown you this thing;
   * he will not walk you to it twice.
   */
  shownKey: string | null;
  /**
   * You have moved at least once since this errand turned up. A cat does not
   * bolt across the Court while you are still standing in the gate: he gets
   * up when you do. It is also what lets a place that has only just been
   * mounted be at rest on its very first frame, which is a promise the whole
   * scene is built on (`scene/framePolicy.ts`).
   */
  roused: boolean;
  /** The emote he has already answered, so one wave is one answer. */
  answered: EmoteId | null;
  /** What he was last pushed out of. */
  contact: string | null;
  /** How long he has been getting nowhere, in seconds. */
  stalled: number;
  /** Seconds left of skirting whatever is in the way, and which way round. */
  skirt: number;
  skirtSide: 1 | -1;
  /** The gap he gave up at, or null when he has not. */
  gaveUp: number | null;
};

export type CatStep = {
  state: CatState;
  /** True while anything of his is still moving — what the frame policy is told. */
  moving: boolean;
  /** A paw landed: where, and which diagonal. */
  pawfall: { x: number; y: number; z: number; yaw: number; left: boolean; force: number } | null;
  /** He is standing at the door he led you to. */
  waiting: boolean;
};

export type CatOptions = {
  /**
   * Reduced motion. **He still follows** — the companion is the point — and
   * he still leads. What stops is the performance: no grooming, no bouncing,
   * no looking up, no bound. He walks, and when you stop he sits.
   */
  reduced?: boolean;
  /** Where something wants a person, or null. Presentation over a pure reading; see `data/attention.ts`. */
  errand?: CatErrand | null;
  /** The warm stone of this place, if it has one. He takes it when you stop within `PERCH_REACH` of it. */
  perch?: { x: number; z: number } | null;
  /**
   * A temporary, already-safe waypoint chosen by the wrapper's bounded
   * pathfinder. It changes only where his feet steer; errand completion and
   * every mood still read the final heel or door below.
   */
  steer?: { x: number; z: number } | null;
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
/** Below this, a flourish is off rather than nearly off. The same bargain `POSE_REST` makes for the body. */
const CAT_REST = 0.004;

/** Hold a point where this world lets a cat stand: short of the water, inside the walls, out of the solid things. */
function holdForCat(x: number, z: number, world: BodyWorld): { x: number; z: number; contact: string | null } {
  // His shore is his own and is always the nearer of the two: the person may
  // walk down to the waterline, and he will not.
  // A larger island supplies its own shore. `CAT_SHORE` remains the safe
  // fallback for small/legacy worlds, where Hercules waits short of the
  // person's waterline.
  const ashore = holdAshore(x, z, world.shore ?? CAT_SHORE);
  const inside = world.room ? holdInRoom(ashore.x, ashore.z, CAT_RADIUS, world.room) : null;
  const held = inside ?? { x: ashore.x, z: ashore.z, wall: null as string | null };
  const clear = pushOut(held.x, held.z, CAT_RADIUS, world.obstacles);
  return { x: clear.x, z: clear.z, contact: clear.hit ?? held.wall ?? (ashore.ashore ? null : "water") };
}

/**
 * A cat standing at a point, looking at `look` if he is given one.
 *
 * The hold may move him — a heel point in a small room is often inside a wall
 * — and a facing worked out for where he was *asked* to stand would then be
 * wrong by however far he was moved. So the facing is worked out **after** the
 * hold: he is stood down already looking at you, and the world owes nobody the
 * frames it would have taken him to turn round.
 */
export function createCatState(x: number, z: number, yaw: number, world: BodyWorld, look?: { x: number; z: number }): CatState {
  const held = holdForCat(x, z, world);
  const facing = look ? Math.atan2(look.x - held.x, look.z - held.z) : yaw;
  return {
    x: held.x, z: held.z, y: world.groundHeightAt(held.x, held.z), yaw: facing,
    speed: 0, phase: 0, bound: 0,
    mood: "sit", moodAt: 0, still: MOOD_AFTER, seated: 1, life: 0, ears: 0.5,
    come: 0, saying: 0, errand: null, shownKey: null, roused: false, answered: null, contact: null, stalled: 0, gaveUp: null, skirt: 0, skirtSide: 1,
  };
}

/**
 * Where he wants to be when he is following: a stride behind your shoulder,
 * a little to your left, in your own frame — so it swings round as you turn
 * and he ends up on the outside of the corner, which is where a cat walks.
 */
export function heelPoint(subject: Pick<CatSubject, "x" | "z" | "yaw">, back = HEEL_BACK, side = HEEL_SIDE): { x: number; z: number } {
  const fx = Math.sin(subject.yaw), fz = Math.cos(subject.yaw);
  // Right of the heading is (+z) → (+x); we want his left, so the sign is negative.
  return { x: subject.x - fx * back - fz * side, z: subject.z - fz * back + fx * side };
}

/**
 * The heel, and the way he is looking from it: at you. Raising him anywhere
 * else — or facing anywhere else — costs the world the frames it takes him to
 * turn round, which on a place's very first screen is frames it has not
 * earned. `scene/runtime.ts` stands him with this, everywhere.
 */
export function heelStand(subject: Pick<CatSubject, "x" | "z" | "yaw">): { x: number; z: number; yaw: number } {
  const heel = heelPoint(subject);
  return { ...heel, yaw: Math.atan2(subject.x - heel.x, subject.z - heel.z) };
}

/**
 * How he answers a thing you said. Six emotes, four answers, and the two that
 * are not answered are not answered — a cat that reacts to everything is a
 * dog. Nothing here is a claim about anything: it is a cat looking at you.
 */
export function answerTo(emote: EmoteId): CatMood | "come" | null {
  switch (emote) {
    // Wave, and he comes.
    case "wave": return "come";
    // Dance, and he bounces.
    case "dance": return "bounce";
    // Sit, and he sits beside you.
    case "sit": return "sit";
    // Cheer and laugh are noise: he looks round at you. Point is not his to follow.
    case "cheer": case "laugh": return "watch";
    default: return null;
  }
}

/** The one reading of "you are moving", so every branch above agrees on it. */
const youMovedNow = (subject: CatSubject): boolean => subject.speed > 0.02;

/** A steady, pure choice of idle from where he happens to be standing: no clock, no randomness, same spot same cat. */
function idleAt(x: number, z: number): CatMood {
  const seed = (Math.round(x * 13) * 73856093) ^ (Math.round(z * 13) * 19349663);
  const which = ((seed % 4) + 4) % 4;
  return which === 0 ? "groom" : which === 1 ? "watch" : which === 2 ? "flop" : "sit";
}

/** Navigation and animation agree on the same held destination, including an
 * answered errand, a wave, and a warm perch. A larger world keeps guidance local. */
export function catDestination(state: CatState, subject: CatSubject, world: BodyWorld, options: CatOptions = {}) {
  const errand = options.errand ?? null, perch = options.perch ?? null;
  const coming = state.come > 0 || (subject.emote === "wave" && subject.emote !== state.answered);
  const distance = errand ? Math.hypot(subject.x - errand.x, subject.z - errand.z) : Infinity;
  const leading = errand !== null && errand.key !== state.shownKey && distance > ERRAND_MET
    && distance <= GUIDE_REACH && (state.roused || youMovedNow(subject)) && !coming;
  const heel = coming ? heelPoint(subject, COME_CLOSE, 0) : heelPoint(subject);
  const perching = !leading && !coming && perch !== null && !youMovedNow(subject)
    && state.still >= MOOD_AFTER * .5 && Math.hypot(perch.x - heel.x, perch.z - heel.z) <= PERCH_REACH;
  const asked = leading ? errand! : perching ? perch! : heel;
  return { point: holdForCat(asked.x, asked.z, world), leading };
}

/**
 * One frame of the cat.
 *
 * Order matters and is the order a cat's attention works in: what you said,
 * then where he has been sent, then where you are, then his feet, then his
 * mood — so a wave beats an errand for the length of the answer, and an
 * errand beats your heel until you have come to the door.
 */
export function stepCat(state: CatState, subject: CatSubject, dt: number, world: BodyWorld, options: CatOptions = {}): CatStep {
  const step = Math.max(0, Math.min(dt, 0.08));
  const reduced = options.reduced === true;
  let { mood, moodAt, come, saying, shownKey, roused, answered, errand } = state;
  let seated = state.seated, life = state.life, ears = state.ears, bound = state.bound;

  // ── What you said ────────────────────────────────────────────────────────
  const said = subject.emote;
  if (said === null) answered = null;
  else if (said !== answered) {
    answered = said;
    const answer = reduced ? (said === "sit" ? "sit" : said === "wave" ? "come" : null) : answerTo(said);
    if (answer === "come") { come = COME_SECONDS; saying = 0; mood = "trot"; moodAt = 0; }
    else if (answer) { mood = answer; moodAt = 0; saying = MOOD_AFTER_SECONDS[answer] ?? 0; }
  }
  if (come > 0) come = Math.max(0, come - step);
  if (saying > 0) saying = Math.max(0, saying - step);

  // ── Where he has been sent ───────────────────────────────────────────────
  const asked = options.errand ?? null;
  if ((asked?.key ?? null) !== (errand?.key ?? null) && asked && asked.key !== shownKey) { roused = false; }
  errand = asked;
  if (youMovedNow(subject)) roused = true;
  if (errand && Math.hypot(subject.x - errand.x, subject.z - errand.z) <= ERRAND_MET) shownKey = errand.key;
  const { point: finalWant, leading } = catDestination({ ...state, come, roused, shownKey, answered }, subject, world, { ...options, errand });
  if (leading && mood !== "trot" && state.speed <= 0.02 && MOOD_SEATED[mood] > 0) { mood = "trot"; moodAt = 0; }

  /**
   * And the point is **held where a cat may stand** before it is walked to,
   * exactly as `walkTo` holds a tap: in a small room your heel point is often
   * inside a wall, and a target that can never be reached is a cat who never
   * stops trying to reach it — which is a world that never sleeps. Held, the
   * heel is the nearest legal spot to your heel, and standing on it is being
   * at it.
   */
  const steer = options.steer ?? finalWant;
  const want = holdForCat(steer.x, steer.z, world);
  const dx = want.x - state.x, dz = want.z - state.z;
  const gap = Math.hypot(dx, dz);
  const finalGap = Math.hypot(finalWant.x - state.x, finalWant.z - state.z);
  /**
   * Once he has settled the heel gets a wider band, so a cat sitting a hand's
   * breadth off his spot stays sitting instead of creeping into it. Hysteresis,
   * for the same reason the streamer has it: without it the last centimetre
   * costs frames forever.
   */
  const settledIdle = MOOD_SEATED[state.mood] > 0 && MOOD_AFTER_SECONDS[state.mood] === null && !leading;
  const reach = leading ? DOOR_REACH : settledIdle ? HEEL_CLOSE * 3 : HEEL_CLOSE;
  /** He is in the middle of saying something and you have not moved: he says it where he is. */
  const rooted = saying > 0 && !youMovedNow(subject) && come <= 0;
  const atPlace = rooted || finalGap <= reach;

  // ── How fast ─────────────────────────────────────────────────────────────
  // The top speed he is allowed is read off *yours*: he matches a walk with a
  // trot and a sprint with a run, and only the gap he has let open — or a door
  // he has been sent to — lets him go faster than you are.
  const matched = clamp(subject.speed * 1.12 + 0.3, CAT_TROT * 0.5, CAT_RUN);
  const chasing = gap > CATCH_UP || (leading && gap > DOOR_REACH * 3) || come > 0;
  const top = chasing ? CAT_RUN : matched;
  // He has given up on this one and is sitting it out until the gap changes.
  let gaveUp = state.gaveUp;
  if (gaveUp !== null && Math.abs(gap - gaveUp) > CAT_UNSTICK) gaveUp = null;
  const wish = atPlace || gaveUp !== null ? 0 : Math.min(1, gap / (reach * 2.4));
  const wanted = wish * top;
  const rate = wanted > state.speed ? CAT_ACCELERATION : CAT_BRAKING;
  let speed = state.speed + (wanted - state.speed) * (1 - Math.exp(-rate * step));
  if (speed < 0.02 && wanted === 0) speed = 0;

  // ── Where that puts his paws ─────────────────────────────────────────────
  // Straight at it first; and if straight at it got him nowhere, the same step
  // turned either way, taking whichever gains ground. That is the whole of his
  // obstacle avoidance, and it is the *same* push-out the person walks on.
  let x = state.x, z = state.z, contact: string | null = null;
  let skirt = state.skirt, skirtSide = state.skirtSide;
  const travel = speed * step;
  if (travel > 1e-6 && gap > 1e-6) {
    const ux = dx / gap, uz = dz / gap;
    const turned = (u: number, v: number, a: number): readonly [number, number] =>
      [u * Math.cos(a) + v * Math.sin(a), v * Math.cos(a) - u * Math.sin(a)] as const;
    const tryStep = (ax: number, az: number) => {
      const held = holdForCat(state.x + ax * travel, state.z + az * travel, world);
      return { ...held, gained: gap - Math.hypot(want.x - held.x, want.z - held.z), went: Math.hypot(held.x - state.x, held.z - state.z) };
    };
    const direct = tryStep(ux, uz);
    let best = direct;
    if (direct.gained < travel * 0.5) {
      // Blocked. Pick a side once — the one that actually moves him — and keep
      // going round that way until he is past it or the clock runs out.
      if (skirt <= 0) {
        const right = tryStep(...turned(ux, uz, DETOUR));
        const left = tryStep(...turned(ux, uz, -DETOUR));
        skirtSide = left.went > right.went ? -1 : 1;
        skirt = SKIRT_SECONDS;
        best = skirtSide < 0 ? left : right;
      } else best = tryStep(...turned(ux, uz, skirtSide * DETOUR));
      skirt = Math.max(0, skirt - step);
    } else skirt = 0;
    x = best.x; z = best.z; contact = best.contact;
  }
  const walked = Math.hypot(x - state.x, z - state.z);
  // ── Getting nowhere ──────────────────────────────────────────────────────
  let stalled = state.stalled;
  if (travel > 1e-6 && gaveUp === null) {
    stalled = walked < travel * 0.35 ? stalled + step : 0;
    if (stalled >= CAT_STUCK) { stalled = 0; gaveUp = gap; speed = 0; }
  } else stalled = 0;

  // ── Facing ───────────────────────────────────────────────────────────────
  // Going somewhere, he faces the way he is going. Standing still he faces
  // what he is about: the door he brought you to, or you.
  let aim = state.yaw;
  if (speed > 0.05 && gap > 1e-6) aim = Math.atan2(dx / gap, dz / gap);
  else if (leading && atPlace) aim = errand!.yaw;
  else aim = Math.atan2(subject.x - x, subject.z - z);
  const yaw = wrapAngle(state.yaw + wrapAngle(aim - state.yaw) * (1 - Math.exp(-CAT_TURN_RATE * step)));

  // ── The gait, and the paws it leaves ─────────────────────────────────────
  // A trot is diagonal pairs; a bound is both fronts then both backs, and it
  // only comes out above a person's walking speed. Reduced motion keeps the
  // trot and never breaks into the other one.
  const wantBound = reduced ? 0 : clamp((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
  bound = bound + (wantBound - bound) * (1 - Math.exp(-6 * step));
  if (bound < CAT_REST && wantBound === 0) bound = 0;
  const before = state.phase;
  const phase = before + (walked / CAT_STRIDE) * Math.PI;
  let pawfall: CatStep["pawfall"] = null;
  if (Math.floor(phase / Math.PI) - Math.floor(before / Math.PI) > 0 && walked > 1e-4) {
    pawfall = { x, y: world.groundHeightAt(x, z), z, yaw, left: Math.floor(phase / Math.PI) % 2 === 0, force: bound };
  }

  // ── His mood ─────────────────────────────────────────────────────────────
  const youMoved = youMovedNow(subject);
  const still = youMoved ? 0 : state.still + step;
  // You moving, or him having somewhere to be, puts him back on his feet —
  // unless he is mid-sentence, which is the one thing that keeps him put.
  if (!rooted && gaveUp === null && (youMoved || !atPlace)) { if (mood !== "trot") { mood = "trot"; moodAt = 0; } }
  else {
    moodAt += step;
    const life_ = MOOD_AFTER_SECONDS[mood];
    if (life_ !== null && moodAt >= life_) { mood = MOOD_FALLS_TO[mood]; moodAt = 0; }
    // Standing at the door he led you to: he waits there, and waiting is sitting.
    if (leading && atPlace && mood === "trot") { mood = "wait"; moodAt = 0; }
    // Beside you, with you standing still long enough to mean it: he settles.
    else if (!leading && mood === "trot" && (atPlace || gaveUp !== null) && still >= MOOD_AFTER) {
      mood = reduced ? "sit" : idleAt(x, z);
      moodAt = 0;
    }
  }
  // Looking up at a jump. Only while he is near enough to have seen it, and
  // never instead of something he is in the middle of saying.
  if (!reduced && subject.air > 0.03 && !leading && mood !== "look-up" && mood !== "bounce" && gap < CATCH_UP) {
    mood = "look-up"; moodAt = 0; saying = MOOD_AFTER_SECONDS["look-up"] ?? 0;
  }

  // ── The two eased signals the figure reads ───────────────────────────────
  const wantSeated = MOOD_SEATED[mood];
  seated = seated + (wantSeated - seated) * (1 - Math.exp(-9 * step));
  if (Math.abs(seated - wantSeated) < CAT_REST) seated = wantSeated;
  // `life` is the whole of the rest promise: the moment there is nothing
  // moving and nothing being performed it eases to zero and is snapped there,
  // and every oscillation in `catFigure.ts` is multiplied by it.
  const performing = !reduced && MOOD_LIVE.has(mood);
  const wantLife = speed > 0.02 || performing ? 1 : 0;
  life = life + (wantLife - life) * (1 - Math.exp(-7 * step));
  if (Math.abs(life - wantLife) < CAT_REST) life = wantLife;
  const wantEars = reduced ? 0.5 : speed > WALK_SPEED ? 1 : leading && atPlace ? 1 : youMoved ? 0.75 : mood === "flop" ? 0.15 : 0.5;
  ears = ears + (wantEars - ears) * (1 - Math.exp(-6 * step));
  if (Math.abs(ears - wantEars) < CAT_REST) ears = wantEars;

  const next: CatState = {
    x, z, y: world.groundHeightAt(x, z), yaw, speed, phase, bound,
    mood, moodAt, still, seated, life, ears, come, saying, errand, shownKey, roused, answered, contact, stalled, gaveUp, skirt, skirtSide,
  };
  // A cat still standing up, still easing his ears back or still owed a mood
  // he has not yet fallen into is a cat that is changing pixels. Every one of
  // these reaches exactly zero or a terminal mood on its own.
  const pending = mood === "trot" && !youMoved && (atPlace || gaveUp !== null) && !leading && still < MOOD_AFTER;
  const moving = speed > 0.005
    || walked > 1e-5
    || Math.abs(wrapAngle(yaw - state.yaw)) > 1e-4
    || seated !== wantSeated
    || life !== 0
    || ears !== wantEars
    || come > 0
    || saying > 0
    || MOOD_AFTER_SECONDS[mood] !== null
    || pending;
  // Standing **at the door**, not merely standing: `atPlace` is true while he
  // is rooted saying something, and a cat mid-sentence is not a cat waiting.
  return { state: next, moving, pawfall, waiting: leading && finalGap <= reach };
}

/** Put him somewhere at once — you took a stair, or a journey flew you across the island. */
export function placeCat(state: CatState, x: number, z: number, world: BodyWorld, yaw = state.yaw, look?: { x: number; z: number }): CatState {
  const put = createCatState(x, z, yaw, world, look);
  return { ...put, errand: state.errand, shownKey: state.shownKey, roused: state.roused, answered: state.answered, phase: state.phase };
}

/** How much of a full trot this is, 0…1 — what the gait's amplitude is scaled by. */
export const catGaitOf = (state: CatState): number => Math.min(1, state.speed / CAT_TROT);
