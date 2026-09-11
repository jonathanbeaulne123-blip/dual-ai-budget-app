import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { KittyGlaze, KittyPaintV1, KittyPart, KittyPieceV1, KittyStrokeV1 } from "../core/types.ts";
import { defaultKittyPaint, defaultKittySculpt } from "../core/kittyStudio.ts";
import { KittyFlat } from "./studio/flat.tsx";

export type KittyHit = { part: KittyPart; uv: { u: number; v: number } };
export type KittyStageApi = {
  paintStroke: (stroke: KittyStrokeV1, fromIndex: number) => void;
  replayPaint: (paint: KittyPaintV1) => void;
  rotate: (radians: number) => void;
};
export type KittyStageMode = "view" | "wheel" | "paint" | "kiln";
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The canvas is decorative. Every interaction has a normal DOM control. */
export function KittyStage({
  piece,
  glaze,
  open,
  name,
  step = 0,
  celebrate = false,
  fired,
  mode = "view",
  spin = false,
  apiRef,
  onPaint,
  onThrow,
  onFlatChange,
}: {
  piece: KittyPieceV1 | null;
  glaze: KittyGlaze;
  open: boolean;
  name: string;
  /** 0..10 backing step; the cat's resting size. */
  step?: number;
  /** Animate step changes (a visible deposit receipt). */
  celebrate?: boolean;
  /** Override the piece's own fired state (kiln preview). */
  fired?: boolean;
  mode?: KittyStageMode;
  spin?: boolean;
  apiRef?: MutableRefObject<KittyStageApi | null>;
  onPaint?: (hit: KittyHit | null, phase: "down" | "move" | "up") => void;
  onThrow?: (deltaY: number) => void;
  onFlatChange?: (flat: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<(KittyStageApi & { open: (v: boolean) => void; sculpt: (p: KittyPieceV1 | null) => void; fill: (n: number, animate: boolean) => void; fired: (v: boolean) => void; spin: (v: boolean) => void; idle: (v: boolean) => void; hit: (x: number, y: number) => KittyHit | null }) | null>(null);
  const [flat, setFlat] = useState(false), [failed, setFailed] = useState(false);
  const latest = useRef({ piece, glaze, open, step, fired, mode, spin, celebrate });
  latest.current = { piece, glaze, open, step, fired, mode, spin, celebrate };
  const drag = useRef<{ x: number; y: number; id: number; painting: boolean } | null>(null);
  const firedState = fired ?? (piece ? Boolean(piece.firedAt) : true);
  useEffect(() => { onFlatChange?.(flat || failed); }, [flat, failed, onFlatChange]);
  useEffect(() => { api.current?.open(open); }, [open]);
  useEffect(() => { api.current?.sculpt(piece); }, [piece?.sculpt, piece?.id, glaze]);
  useEffect(() => { if (piece) api.current?.replayPaint(piece.paint); }, [piece?.paint]);
  useEffect(() => { api.current?.fill(step, celebrate); }, [step, celebrate]);
  useEffect(() => { api.current?.fired(firedState); }, [firedState]);
  useEffect(() => { api.current?.spin(spin); }, [spin]);
  useEffect(() => {
    const element = host.current;
    if (!element || flat) return;
    setFailed(false);
    let dead = false;
    const cleanup: Array<() => void> = [];
    const dispose = () => {
      api.current = null;
      if (apiRef) apiRef.current = null;
      for (const release of cleanup.splice(0).reverse())
        try { release(); } catch { /* Continue releasing other owned resources. */ }
    };
    Promise.all([import("three"), import("./sculpture.ts"), import("three/examples/jsm/environments/RoomEnvironment.js")])
      .then(([T, { createKittySculpture }, { RoomEnvironment }]) => {
        if (dead) return;
        let renderer: InstanceType<typeof T.WebGLRenderer>;
        try {
          renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true });
        } catch {
          setFailed(true);
          return;
        }
        cleanup.push(() => { renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;
        renderer.domElement.setAttribute("aria-hidden", "true");
        element.appendChild(renderer.domElement);
        const scene = new T.Scene(), camera = new T.PerspectiveCamera(34, 1, 0.1, 40);
        camera.position.set(0.25, 3.1, 7.1);
        camera.lookAt(0, 1.55, 0);
        const pmrem = new T.PMREMGenerator(renderer);
        try {
          const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
          scene.environment = env.texture;
          cleanup.push(() => { env.dispose(); pmrem.dispose(); });
        } catch { pmrem.dispose(); }
        scene.add(new T.HemisphereLight("#fff1d9", "#77767c", 2.4));
        const key = new T.DirectionalLight("#ffe9ca", 3.4);
        key.position.set(-3, 5, 4);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        scene.add(key);
        const rim = new T.DirectionalLight("#d9ecfa", 1.8);
        rim.position.set(3, 3, -3);
        scene.add(rim);
        const reduced = reducedMotion();
        let raf = 0;
        const render = () => { if (!dead) renderer.render(scene, camera); };
        const loop = () => {
          raf = 0;
          if (dead || document.hidden) return;
          const more = cat.update();
          render();
          if (more) raf = requestAnimationFrame(loop);
        };
        const kick = () => { if (!raf && !dead && !document.hidden) raf = requestAnimationFrame(loop); };
        cleanup.push(() => { if (raf) cancelAnimationFrame(raf); raf = 0; });
        const cat = createKittySculpture(latest.current.piece, {
          brass: "#bda375",
          wood: "#62412b",
          fired: latest.current.fired ?? (latest.current.piece ? Boolean(latest.current.piece.firedAt) : true),
          reducedMotion: reduced,
          onAnimate: kick,
        });
        cleanup.push(() => cat.dispose());
        if (!latest.current.piece) cat.setPaint(defaultKittyPaint(latest.current.glaze));
        cat.group.rotation.y = -0.22;
        cat.setOpen(latest.current.open);
        cat.setFill(latest.current.step, false);
        cat.setSpin(latest.current.spin ? 0.5 : 0);
        scene.add(cat.group);
        const floorGeo = new T.PlaneGeometry(30, 30), floorMat = new T.ShadowMaterial({ opacity: 0.22 });
        cleanup.push(() => { floorGeo.dispose(); floorMat.dispose(); });
        const floor = new T.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.005;
        floor.receiveShadow = true;
        scene.add(floor);
        const raycaster = new T.Raycaster(), pointer = new T.Vector2();
        const resize = () => {
          const box = element.getBoundingClientRect();
          if (!box.width || !box.height) return;
          camera.aspect = box.width / box.height;
          camera.updateProjectionMatrix();
          renderer.setSize(box.width, box.height);
          render();
        };
        let currentSculpt = latest.current.piece?.sculpt;
        api.current = {
          rotate(n) { cat.group.rotation.y += n; render(); },
          open(v) { cat.setOpen(v); render(); },
          sculpt(p) {
            const sculptNext = p?.sculpt ?? defaultKittySculpt();
            if (sculptNext !== currentSculpt) { cat.setSculpt(sculptNext); currentSculpt = sculptNext; }
            if (!p) cat.setPaint(defaultKittyPaint(latest.current.glaze));
            render();
          },
          replayPaint(paint) { cat.replayPaint(paint); render(); },
          paintStroke(stroke, from) { cat.paintStroke(stroke, from); render(); },
          fill(n, animate) { cat.setFill(n, animate); render(); },
          fired(v) { cat.setFired(v); render(); },
          spin(v) { cat.setSpin(v ? 0.5 : 0); render(); },
          idle(v) { cat.setIdle(v); render(); },
          hit(x, y) {
            const box = renderer.domElement.getBoundingClientRect();
            pointer.set(((x - box.left) / box.width) * 2 - 1, -((y - box.top) / box.height) * 2 + 1);
            raycaster.setFromCamera(pointer, camera);
            return cat.raycastPart(raycaster);
          },
        };
        if (apiRef) apiRef.current = api.current;
        const observer = new ResizeObserver(resize);
        cleanup.push(() => observer.disconnect());
        observer.observe(element);
        resize();
        // Idle breathe only while the stage is actually on screen and the tab is visible.
        const visibility = new IntersectionObserver((entries) => {
          const on = entries.some((entry) => entry.isIntersecting);
          cat.setIdle(on && !document.hidden);
          if (on) render();
        });
        visibility.observe(element);
        cleanup.push(() => visibility.disconnect());
        const onHidden = () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; cat.setIdle(false); } else { cat.setIdle(true); kick(); } };
        document.addEventListener("visibilitychange", onHidden);
        cleanup.push(() => document.removeEventListener("visibilitychange", onHidden));
        const lost = (e: Event) => { e.preventDefault(); dispose(); setFailed(true); };
        renderer.domElement.addEventListener("webglcontextlost", lost);
        cleanup.push(() => renderer.domElement.removeEventListener("webglcontextlost", lost));
      })
      .catch(() => { dispose(); if (!dead) setFailed(true); });
    return () => { dead = true; dispose(); };
  }, [flat]);
  const live = !flat && !failed;
  return (
    <div className="kitty-stage-wrap" data-mode={mode} data-fired={firedState ? "true" : "false"}>
      <div className="kitty-window" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="kitty-lamp" aria-hidden="true" />
      <div className="kitty-table" aria-hidden="true" />
      <div
        className="kitty-stage"
        ref={host}
        aria-hidden="true"
        data-painting={mode === "paint" ? "true" : undefined}
        onPointerDown={(event) => {
          if (!live || !api.current) return;
          const painting = mode === "paint" && event.button === 0;
          drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId, painting };
          event.currentTarget.setPointerCapture(event.pointerId);
          if (painting) onPaint?.(api.current.hit(event.clientX, event.clientY), "down");
        }}
        onPointerMove={(event) => {
          if (!drag.current || !api.current) return;
          if (drag.current.painting) {
            onPaint?.(api.current.hit(event.clientX, event.clientY), "move");
            return;
          }
          const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y;
          if (mode === "wheel" && onThrow && Math.abs(dy) > Math.abs(dx)) onThrow(dy);
          else api.current.rotate(dx * 0.009);
          drag.current.x = event.clientX;
          drag.current.y = event.clientY;
        }}
        onPointerUp={(event) => {
          if (drag.current?.painting && api.current) onPaint?.(api.current.hit(event.clientX, event.clientY), "up");
          drag.current = null;
        }}
        onPointerCancel={() => {
          if (drag.current?.painting) onPaint?.(null, "up");
          drag.current = null;
        }}
      >
        {!live && <KittyFlat className="kitty-flat" piece={piece} glaze={glaze} step={step} open={open} fired={firedState} />}
      </div>
      <div className="kitty-stage-controls">
        <button type="button" aria-label={`Rotate ${name} left`} disabled={!live} onClick={() => api.current?.rotate(-0.45)}>↶</button>
        <span>{mode === "paint" ? "Paint straight onto the clay." : mode === "wheel" ? "Drag up and down to throw." : "Turn it. Make it yours."}</span>
        <button type="button" aria-label={`Rotate ${name} right`} disabled={!live} onClick={() => api.current?.rotate(0.45)}>↷</button>
        <button type="button" aria-pressed={flat} onClick={() => setFlat(!flat)}>{flat ? "3D view" : "Simple view"}</button>
      </div>
      {failed && !flat && (
        <p className="kitty-render-note" role="status">Simple view is ready. All bank controls work here.</p>
      )}
    </div>
  );
}
