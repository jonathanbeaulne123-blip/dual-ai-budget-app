import * as THREE from "three";
import {createSkaterLook,poseFromLegacyAct,type SkaterLook} from '../skate/look/index.ts';
import {blankPresent} from '../skate/look/legacy.ts';
import { createBodyFigure, DEFAULT_FIGURE_COLOURS, type BodyMotion } from "./figure.ts";
import {createPlayableFigure,type PlayableAvatar} from './playableFigure.ts';
import {
  EMOTE_SECONDS, GRAVITY, JUMP_RUN_BONUS, JUMP_SPEED, isEmoteId, type EmoteId,
} from "./bodyModel.ts";
import { useWalkerFactory, type Walker, type WalkerOptions } from "../presence/walker.ts";

/**
 * The real character, standing in the partner's place.
 *
 * `presence/walker.ts` owns the `Walker` interface and shipped a capsule
 * behind it because the character lived on another branch. This is the
 * integration it described: the same body the reader walks
 * (`body/figure.ts`), wrapped so that a peer's position off the wire moves it.
 *
 * The contract the seam states is honoured exactly, and it is the reason a yaw
 * from the wire means the same thing for both bodies:
 *
 * - **Origin at the feet.** `BodyFigure.group`'s position *is* the feet on the
 *   ground, which is what `setPose` sets.
 * - **Facing +z at yaw 0.** The body model's own convention is that a body
 *   "looks along (sin yaw, 0, cos yaw)" (`body/bodyModel.ts`), which is
 *   `(0, 0, 1)` at yaw 0. The local walker and the partner therefore read a
 *   yaw identically; neither needs an offset.
 *
 * What this wrapper does *not* do is decide whether the partner is walking.
 * `setMoving` is the lane's call, made from the freshness of the feed, never
 * inferred from a position that may be a guess — so a stale peer stands still
 * rather than moonwalking on interpolated samples.
 */

/** A partner is the same size as you unless the place asks for a different one. */
const DEFAULT_WALKER_HEIGHT = 0.46;

export function createCharacterWalker(options: WalkerOptions): Walker {
  const generic = () => createBodyFigure({
    // The place's dressing decides the two colours a body is told apart by;
    // everything else stays the house's own palette.
    coat: options.tint || DEFAULT_FIGURE_COLOURS.coat,
    skin: options.skin || DEFAULT_FIGURE_COLOURS.skin,
  });
  let figure = generic();
  const group = new THREE.Group();group.name='Live partner';group.add(figure.group);
  // The figure is authored at the reader's own height; a place may want its
  // people smaller. Scaling the group keeps the feet at the origin.
  const height = options.height ?? DEFAULT_WALKER_HEIGHT;
  const scale = figure.height > 0 ? height / figure.height : 1;
  figure.group.scale.multiplyScalar(scale);
  /**
   * Their board: the same v2 look your own rider uses, drawn from the coarse
   * act + progress the lane carries (`poseFromLegacyAct`), in the group's own
   * frame (the group already stands where they are and faces their yaw).
   * Built on the first skate act; the figure is handed back when they walk.
   */
  let look:SkaterLook|null=null;
  const ride=blankPresent();

  // Every material on this figure belongs to this figure (`createBodyFigure`
  // builds its own), so fading one body never fades the other.
  let materials: THREE.MeshStandardMaterial[] = [];
  let moving = false, phase = 0, opacity = 1, selectedAvatar:PlayableAvatar|null=null;
  const refreshMaterials = () => {
    materials = [];
    group.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const standard = material as THREE.MeshStandardMaterial;
        if (standard && !materials.includes(standard)) materials.push(standard);
      }
    });
    for (const material of materials) {material.transparent=opacity<1;material.opacity=opacity;material.needsUpdate=true;}
  };
  refreshMaterials();
  /**
   * What the partner is doing, off the wire, and how far through it.
   *
   * The arc is **replayed from the progress**, not received as a height. The
   * lane carries twelve samples a second and a jump is over in six of them,
   * so a height on the wire would be a staircase; a progress and the same
   * constants both ends is a parabola. It is the same trick the stride has
   * always used here — the lane says *what*, the body draws *how*.
   */
  let act: string | null = null, progress = 0, groundY = 0, altitude:number|null=null;
  /** The pose handed to the figure. One object, written in place, exactly as your own body does it. */
  const motion: BodyMotion = { lean: 0, bank: 0, run: 0, air: 0, rise: 0, crouch: 0, slide: 0, emote: null, emoteAt: 0, flourish: 1 };
  /** How high the biggest hop there is goes at its top: what `p` is drawn against. */
  const APEX = (JUMP_SPEED * (1 + JUMP_RUN_BONUS)) ** 2 / (2 * GRAVITY);
  // One step per π of phase, two steps a second at a walk — the same rate the
  // placeholder used, so the lane's smoothing reads the same either way.
  const STEP_RATE = Math.PI * 4;

  figure.pose(0, 0, 0);

  return {
    group,
    setPose(x, z, yaw) {
      groundY = options.groundHeightAt?.(x, z) ?? 0;
      // The partner's jump is drawn from the ground *under them*, sampled
      // here — so a partner who jumps on the hump lands on the hump, exactly
      // as your own body does.
      group.position.set(x, groundY + (motion.air ?? 0), z);
      group.rotation.y = yaw;
    },
    setHeight(y){altitude=typeof y==='number'&&Number.isFinite(y)?y:null;},
    setMoving(next) {
      if (moving === next) return;
      moving = next;
      if (!next) phase = 0;
    },
    setAction(next, p) {
      act = next;if(!act?.startsWith("skate"))altitude=null;
      progress = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
    },
    setAvatar(next) {
      if(next===selectedAvatar)return;
      selectedAvatar=next;
      figure.group.removeFromParent();figure.dispose();
      figure=next?createPlayableFigure(next,'lite',{onStatus:(_,status)=>{if(status==='ready')refreshMaterials();}}):generic();
      figure.group.scale.multiplyScalar(scale);
      group.add(figure.group);
      figure.pose(phase,moving?1:0,0,motion);
      refreshMaterials();
    },
    setOpacity(next) {
      const clamped = Math.max(0, Math.min(1, Number.isFinite(next) ? next : 0));
      if (clamped === opacity) return;
      opacity = clamped;
      const shown = clamped > 0.01;
      for (const material of materials) { material.transparent = clamped < 1; material.opacity = clamped; material.needsUpdate=true; }
      group.visible = shown;
    },
    animate(t, dt) {
      // A body in the air or on its side is not taking strides, which is the
      // same rule your own body obeys (`bodyModel.ts`).
      const skating=act?.startsWith("skate")===true;
      const busy = skating || act === "jump" || act === "slide";
      if (moving && !busy) phase += dt * STEP_RATE;
      motion.air = 0; motion.rise = 0; motion.crouch = 0; motion.slide = 0; motion.emote = null; motion.emoteAt = 0;
      if (act === "jump") {
        // Height is the parabola through the progress; the rise is its slope,
        // which is what the figure reads to tuck on the way up and reach on
        // the way down.
        const k = progress;
        motion.air = 4 * k * (1 - k) * APEX;
        motion.rise = Math.max(-1, Math.min(1, 1 - 2 * k));
        // The dip before the push, replayed at the front of the arc.
        motion.crouch = k < 0.12 ? 1 - k / 0.12 : 0;
      } else if (act === "slide") {
        motion.slide = Math.max(0, 1 - progress);
        motion.crouch = 0;
      } else if (isEmoteId(act)) {
        const id: EmoteId = act;
        motion.emote = id;
        motion.emoteAt = progress * EMOTE_SECONDS[id];
      }
      // The body rides its own jump: the group's origin is the feet, so the
      // feet are the ground plus whatever of the arc is left.
      // A skater's altitude on the wire is the board's origin (the ground or the
      // rail's top line under it): the group stands there.
      group.position.y = skating&&altitude!==null?altitude:groundY + (motion.air ?? 0);
      if(skating){
        if(!look){
          look=createSkaterLook({figure,deckId:'afterglow',tier:'lite',scale});group.add(look.root);
          // The board fades with the body (stale feed): its materials join the list.
          look.board.group.traverse(node=>{const mesh=node as THREE.Mesh;if(!mesh.isMesh)return;
            for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){const m=material as THREE.MeshStandardMaterial;if(m&&!materials.includes(m)){materials.push(m);m.transparent=opacity<1;m.opacity=opacity;}}});
        }
        look.root.visible=true;
        poseFromLegacyAct(act,progress,ride,moving);
        ride.x=0;ride.y=0;ride.z=0;ride.heading=0;ride.boardYaw=0;
        look.update(ride,null,dt,false);
        return;
      }
      if(look?.root.visible){look.release();look.root.visible=false;figure.group.position.set(0,0,0);figure.group.rotation.set(0,0,0);}
      // The idle breath runs whether or not the feet do, so a standing partner
      // is alive rather than a statue.
      figure.pose(phase, moving && !busy ? 1 : 0, t, motion);
    },
    dispose() {
      group.removeFromParent();
      look?.dispose();figure.dispose();
    },
  };
}

/**
 * The whole integration, exactly as `presence/walker.ts` specified it: one
 * line, run once at import time by the character module. `body/walker.ts`
 * imports this file so that any surface standing a body — the runtime imports
 * it before it can build a place — has the real character registered before
 * the first `createWalker()` call.
 */
export const stopUsingCharacterWalker = useWalkerFactory(createCharacterWalker);
