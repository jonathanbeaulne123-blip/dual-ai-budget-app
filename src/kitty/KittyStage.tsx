import { useEffect, useRef, useState } from "react";
import { KITTY_GLAZES } from "../core/goalEnvelopes.ts";
import type { KittyGlaze } from "../core/types.ts";

/** The canvas is decorative. Every interaction has a normal DOM control. */
export function KittyStage({
  glaze,
  open,
  name,
}: {
  glaze: KittyGlaze;
  open: boolean;
  name: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    api = useRef<{
      rotate: (n: number) => void;
      open: (v: boolean) => void;
      glaze: (v: string) => void;
    } | null>(null);
  const [flat, setFlat] = useState(false),
    [failed, setFailed] = useState(false);
  const latest = useRef({ glaze, open });
  latest.current = { glaze, open };
  const drag = useRef<{ x: number; id: number } | null>(null);
  useEffect(() => {
    api.current?.open(open);
  }, [open]);
  useEffect(() => {
    api.current?.glaze(KITTY_GLAZES[glaze]);
  }, [glaze]);
  useEffect(() => {
    const element = host.current;
    if (!element || flat) return;
    setFailed(false);
    let dead = false;
    const cleanup: Array<() => void> = [];
    const dispose = () => {
      api.current = null;
      for (const release of cleanup.splice(0).reverse())
        try {
          release();
        } catch {
          /* Continue releasing other owned resources. */
        }
    };
    Promise.all([import("three"), import("./sculpture.ts")])
      .then(([T, { createKittySculpture }]) => {
        if (dead) return;
        let renderer: InstanceType<typeof T.WebGLRenderer>;
        try {
          renderer = new T.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: "low-power",
          });
        } catch {
          setFailed(true);
          return;
        }
        cleanup.push(() => {
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.35;
        renderer.domElement.setAttribute("aria-hidden", "true");
        element.appendChild(renderer.domElement);
        const scene = new T.Scene(),
          camera = new T.PerspectiveCamera(34, 1, 0.1, 40);
        camera.position.set(0.25, 2.9, 6.65);
        camera.lookAt(0, 1.38, 0);
        scene.add(new T.HemisphereLight("#fff1d9", "#77767c", 3));
        const key = new T.DirectionalLight("#ffe9ca", 4);
        key.position.set(-3, 5, 4);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        scene.add(key);
        const rim = new T.DirectionalLight("#d9ecfa", 2);
        rim.position.set(3, 3, -3);
        scene.add(rim);
        const cat = createKittySculpture({
          glaze: KITTY_GLAZES[latest.current.glaze],
          brass: "#bda375",
          wood: "#62412b",
        });
        cleanup.push(() => cat.dispose());
        cat.group.rotation.y = -0.22;
        cat.setOpen(latest.current.open);
        scene.add(cat.group);
        const floorGeo = new T.PlaneGeometry(30, 30),
          floorMat = new T.ShadowMaterial({ opacity: 0.22 });
        cleanup.push(() => {
          floorGeo.dispose();
          floorMat.dispose();
        });
        const floor = new T.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.005;
        floor.receiveShadow = true;
        scene.add(floor);
        const render = () => {
          if (!dead) renderer.render(scene, camera);
        };
        const resize = () => {
          const box = element.getBoundingClientRect();
          if (!box.width || !box.height) return;
          camera.aspect = box.width / box.height;
          camera.updateProjectionMatrix();
          renderer.setSize(box.width, box.height);
          render();
        };
        api.current = {
          rotate(n) {
            cat.group.rotation.y += n;
            render();
          },
          open(v) {
            cat.setOpen(v);
            render();
          },
          glaze(v) {
            cat.setGlaze(v);
            render();
          },
        };
        const observer = new ResizeObserver(resize);
        cleanup.push(() => observer.disconnect());
        observer.observe(element);
        resize();
        const lost = (e: Event) => {
          e.preventDefault();
          dispose();
          setFailed(true);
        };
        renderer.domElement.addEventListener("webglcontextlost", lost);
        cleanup.push(() =>
          renderer.domElement.removeEventListener("webglcontextlost", lost),
        );
      })
      .catch(() => {
        dispose();
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
      dispose();
    };
  }, [flat]);
  return (
    <div className="kitty-stage-wrap">
      <div className="kitty-window" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="kitty-lamp" aria-hidden="true" />
      <div className="kitty-table" aria-hidden="true" />
      <div
        className="kitty-stage"
        ref={host}
        aria-hidden="true"
        onPointerDown={(event) => {
          if (flat || failed) return;
          drag.current = { x: event.clientX, id: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          api.current?.rotate((event.clientX - drag.current.x) * 0.009);
          drag.current.x = event.clientX;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {(flat || failed) && (
          <svg
            className="kitty-flat"
            viewBox="0 0 300 360"
            style={{ color: KITTY_GLAZES[glaze] }}
          >
            <ellipse cx="150" cy="333" rx="105" ry="15" fill="#694b32" />
            <path
              d="M80 154Q36 306 94 325Q150 347 208 325Q264 306 220 154L210 63L172 103Q150 94 128 103L88 63Z"
              fill="currentColor"
              stroke="#43392f"
              strokeWidth="3"
            />
            <path
              d="M104 147q12 12 23 0m46 0q12 12 23 0m-50 19 5 5 5-5"
              fill="none"
              stroke="#43392f"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <rect
              x="110"
              y="208"
              width="80"
              height="74"
              rx="12"
              fill={open ? "#5a4431" : "currentColor"}
              stroke="#a88451"
              strokeWidth="4"
            />
            {open && (
              <>
                <path d="M118 228h62v37h-62Z" fill="#fff0d0" />
                <path d="m118 228 31 22 31-22" fill="none" stroke="#b89665" />
              </>
            )}
          </svg>
        )}
      </div>
      <div className="kitty-stage-controls">
        <button
          type="button"
          aria-label={`Rotate ${name} left`}
          disabled={flat || failed}
          onClick={() => api.current?.rotate(-0.45)}
        >
          ↶
        </button>
        <span>Turn it. Make it yours.</span>
        <button
          type="button"
          aria-label={`Rotate ${name} right`}
          disabled={flat || failed}
          onClick={() => api.current?.rotate(0.45)}
        >
          ↷
        </button>
        <button
          type="button"
          aria-pressed={flat}
          onClick={() => setFlat(!flat)}
        >
          {flat ? "3D view" : "Simple view"}
        </button>
      </div>
      {failed && !flat && (
        <p className="kitty-render-note" role="status">
          Simple view is ready. All bank controls work here.
        </p>
      )}
    </div>
  );
}
