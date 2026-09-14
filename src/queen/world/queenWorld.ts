import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { KittyPaintV1, KittyPieceV1 } from "../../core/types.ts";
import type { QueenStone } from "../../core/queenPresentation.ts";
import { createKittySculpture, type KittySculpture } from "../../kitty/sculpture.ts";
import { createQueenSculpture, QUEEN_HEIGHT, type QueenSculpture } from "./queenSculpture.ts";
import type { QueenGlazeAxis, QueenPose } from "./queenAuthoring.ts";

/**
 * The Home world: one renderer, one scene, one still camera. A diorama you
 * look into. Everything is placed on the z = 0 plane where the DOM says it
 * is, so the real controls (buttons over the canvas) and the sculptures never
 * drift apart. Frames are rendered on demand — after a state change, a layout
 * change or a breath frame — never on an unconditional loop.
 */
export type WorldRect = { x: number; y: number; w: number; h: number };
export type WorldBankInput = { id: string; piece: KittyPieceV1; fired: boolean; step: number };
export type WorldQueenInput = {
  pose: QueenPose;
  fill: number;
  axis: QueenGlazeAxis;
  crown: boolean;
  seams: number;
  vine: { chapter: boolean; growth: number; buds: number };
  feet: QueenStone["size"][];
  paint: KittyPaintV1 | null;
};
export type WorldLayout = { host: WorldRect; queen: WorldRect; banks: Record<string, WorldRect> };
export type WorldStats = { frames: number; lastFrameMs: number; maxFrameMs: number; sculptures: number; breathing: boolean };

const VISIBLE_HEIGHT = 10;
const FOV = 34;
const BREATH_MS = 6000;
const BREATH_PX = 14;

export function createQueenWorld(host: HTMLElement, options: { reducedMotion: boolean; onLost?: () => void; brass?: string; wood?: string }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 1.5));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.className = "queen-world__canvas";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
  const distance = (VISIBLE_HEIGHT / 2) / Math.tan((FOV / 2) * (Math.PI / 180));
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);

  const cleanup: Array<() => void> = [];
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    cleanup.push(() => { env.dispose(); pmrem.dispose(); });
  } catch { pmrem.dispose(); }
  scene.add(new THREE.HemisphereLight("#fff1d9", "#8a8276", 1.1));
  const key = new THREE.DirectionalLight("#ffe9ca", 1.9);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#d9ecfa", 0.9);
  rim.position.set(4, 4, -4);
  scene.add(rim);

  const queen: QueenSculpture = createQueenSculpture({ reducedMotion: options.reducedMotion });
  scene.add(queen.group);
  const banks = new Map<string, { sculpture: KittySculpture; height: number; fired: boolean; pieceId: string; paintKey: string }>();

  let dead = false;
  let pending = 0;
  let unitsPerPx = VISIBLE_HEIGHT / Math.max(1, host.clientHeight);
  let lastLayoutKey = "";
  const stats: WorldStats = { frames: 0, lastFrameMs: 0, maxFrameMs: 0, sculptures: 1, breathing: false };
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const render = () => {
    if (dead) return;
    const t0 = now();
    renderer.render(scene, camera);
    const ms = now() - t0;
    stats.frames += 1;
    stats.lastFrameMs = ms;
    stats.maxFrameMs = Math.max(stats.maxFrameMs, ms);
  };
  /** One frame, coalesced. */
  const invalidate = () => {
    if (dead || pending) return;
    pending = requestAnimationFrame(() => { pending = 0; render(); });
  };

  // ---- breath: the only ambient motion, and only while asked ----
  let breathRaf = 0;
  let breathStart = 0;
  const breathFrame = (t: number) => {
    breathRaf = 0;
    if (dead || !stats.breathing) return;
    if (!breathStart) breathStart = t;
    const phase = ((t - breathStart) / BREATH_MS) * Math.PI * 2;
    queen.setBreath(Math.sin(phase) * BREATH_PX * unitsPerPx);
    render();
    breathRaf = requestAnimationFrame(breathFrame);
  };
  const setBreathing = (on: boolean) => {
    const next = on && !options.reducedMotion;
    if (next === stats.breathing) return;
    stats.breathing = next;
    if (next) { breathStart = 0; if (!breathRaf) breathRaf = requestAnimationFrame(breathFrame); }
    else { if (breathRaf) cancelAnimationFrame(breathRaf); breathRaf = 0; queen.setBreath(0); invalidate(); }
  };
  const onHidden = () => { if (document.hidden) { if (breathRaf) cancelAnimationFrame(breathRaf); breathRaf = 0; } else if (stats.breathing && !breathRaf) { breathStart = 0; breathRaf = requestAnimationFrame(breathFrame); } };
  document.addEventListener("visibilitychange", onHidden);
  cleanup.push(() => document.removeEventListener("visibilitychange", onHidden));

  const lost = (event: Event) => { event.preventDefault(); options.onLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  cleanup.push(() => renderer.domElement.removeEventListener("webglcontextlost", lost));

  /** Screen px (relative to the viewport) → the z = 0 plane. */
  const toWorld = (hostRect: WorldRect, px: number, py: number): [number, number] => [
    (px - (hostRect.x + hostRect.w / 2)) * unitsPerPx,
    ((hostRect.y + hostRect.h / 2) - py) * unitsPerPx,
  ];

  return {
    scene,
    camera,
    renderer,
    queen,
    stats: () => ({ ...stats, sculptures: 1 + banks.size }),
    invalidate,
    render,
    setBreathing,
    setQueen(input: WorldQueenInput) {
      queen.setPose(input.pose);
      queen.setFill(input.fill);
      queen.setGlaze(input.axis);
      queen.setCrown(input.crown);
      queen.setSeams(input.seams);
      queen.setVine(input.vine.chapter, input.vine.growth, input.vine.buds);
      queen.setFeet(input.feet);
      queen.setPaint(input.paint);
      invalidate();
    },
    /** Banks are studio sculptures. Rebuilt only when the piece or its firing changes; disposed when they leave. */
    setBanks(inputs: WorldBankInput[]) {
      const seen = new Set<string>();
      for (const input of inputs) {
        seen.add(input.id);
        const paintKey = JSON.stringify(input.piece.paint);
        const existing = banks.get(input.id);
        if (existing && existing.pieceId === input.piece.id && existing.fired === input.fired && existing.paintKey === paintKey) {
          existing.sculpture.setFill(input.step, false);
          continue;
        }
        if (existing) { existing.sculpture.group.removeFromParent(); existing.sculpture.dispose(); banks.delete(input.id); }
        const sculpture = createKittySculpture(input.piece, { brass: options.brass ?? "#bda375", wood: options.wood ?? "#62412b", fired: input.fired, reducedMotion: true });
        sculpture.setOpen(false);
        sculpture.setSpin(0);
        sculpture.setIdle(false);
        sculpture.setFill(input.step, false);
        sculpture.group.visible = false;
        scene.add(sculpture.group);
        const box = new THREE.Box3().setFromObject(sculpture.group);
        banks.set(input.id, { sculpture, height: Math.max(0.5, box.max.y - box.min.y), fired: input.fired, pieceId: input.piece.id, paintKey });
      }
      for (const [id, bank] of banks) if (!seen.has(id)) { bank.sculpture.group.removeFromParent(); bank.sculpture.dispose(); banks.delete(id); }
      lastLayoutKey = "";
      invalidate();
    },
    /** Put her and the banks exactly where the DOM keeps their controls. */
    layout(next: WorldLayout) {
      const { host: hostRect } = next;
      if (!hostRect.w || !hostRect.h) return;
      // Measured often (through CSS transitions); rendered only when something actually moved.
      const key = JSON.stringify([hostRect, next.queen, next.banks, [...banks.keys()]]);
      if (key === lastLayoutKey) return;
      lastLayoutKey = key;
      unitsPerPx = VISIBLE_HEIGHT / hostRect.h;
      camera.aspect = hostRect.w / hostRect.h;
      camera.updateProjectionMatrix();
      renderer.setSize(hostRect.w, hostRect.h, false);
      renderer.domElement.style.width = `${hostRect.w}px`;
      renderer.domElement.style.height = `${hostRect.h}px`;
      const [qx, qy] = toWorld(hostRect, next.queen.x + next.queen.w / 2, next.queen.y + next.queen.h);
      const queenScale = (next.queen.h * unitsPerPx) / QUEEN_HEIGHT;
      queen.group.position.set(qx, qy, 0);
      queen.group.scale.setScalar(queenScale);
      for (const [id, bank] of banks) {
        const rect = next.banks[id];
        bank.sculpture.group.visible = Boolean(rect);
        if (!rect) continue;
        const [bx, by] = toWorld(hostRect, rect.x + rect.w / 2, rect.y + rect.h);
        bank.sculpture.group.position.set(bx, by, 0);
        bank.sculpture.group.scale.setScalar((rect.h * unitsPerPx) / bank.height);
      }
      invalidate();
    },
    dispose() {
      if (dead) return;
      dead = true;
      if (pending) cancelAnimationFrame(pending);
      if (breathRaf) cancelAnimationFrame(breathRaf);
      for (const bank of banks.values()) { bank.sculpture.group.removeFromParent(); bank.sculpture.dispose(); }
      banks.clear();
      queen.dispose();
      for (const release of cleanup.splice(0).reverse()) { try { release(); } catch { /* keep releasing */ } }
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
export type QueenWorld = ReturnType<typeof createQueenWorld>;
