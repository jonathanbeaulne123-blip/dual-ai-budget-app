import * as THREE from "three";

export type WorldRendererOptions = {
  parameters?: THREE.WebGLRendererParameters;
  /** Foreground tools default to 1; the persistent whole-house scene uses 0. */
  priority?: number;
  /** Reapplied whenever this lease returns to the foreground. */
  configure?: (renderer: THREE.WebGLRenderer) => void;
  onSuspend?: () => void;
  onResume?: () => void;
  /** Test seam. Production ownership is controlled by VITE_HEARTH_HOUSE_WORLD. */
  shared?: boolean;
  rendererFactory?: (parameters?: THREE.WebGLRendererParameters) => THREE.WebGLRenderer;
};

export type WorldFrameCallback = (time: number) => void;

export type WorldRendererLease = {
  renderer: THREE.WebGLRenderer;
  readonly active: boolean;
  /** Queues one render callback on the shared world frame. */
  requestFrame(callback: WorldFrameCallback): number;
  cancelFrame(id: number): void;
  listenCanvas<E extends Event>(type: string, listener: (event: E) => void, options?: boolean | AddEventListenerOptions): () => void;
  release(): void;
};

type CanvasListener = { type: string; listener: EventListener; options?: boolean | AddEventListenerOptions };
type LeaseState = {
  host: HTMLElement;
  options: WorldRendererOptions;
  priority: number;
  proxy: THREE.WebGLRenderer;
  listeners: CanvasListener[];
  active: boolean;
  released: boolean;
};
type SharedState = { renderer: THREE.WebGLRenderer; leases: LeaseState[] };

type FrameOwner = Pick<LeaseState, "active" | "released">;
type NativeFrames = { request(callback: FrameRequestCallback): number; cancel(id: number): void };

/**
 * One browser animation frame feeds every runnable renderer lease. A lease may
 * still ask for another frame from its callback, but an old, suspended, or
 * released scene can never keep the native loop alive.
 */
export function createWorldFrameScheduler(native: NativeFrames = {
  request: callback => requestAnimationFrame(callback),
  cancel: id => cancelAnimationFrame(id),
}) {
  let nativeId = 0, nextId = 1;
  const queued = new Map<number, { owner: FrameOwner; callback: WorldFrameCallback }>();
  const schedule = () => {
    if (!nativeId && queued.size) nativeId = native.request(flush);
  };
  const flush = (time: number) => {
    nativeId = 0;
    const batch = [...queued];
    for (const [id] of batch) queued.delete(id);
    for (const [, job] of batch) {
      if (job.owner.active && !job.owner.released) job.callback(time);
    }
    schedule();
  };
  return {
    request(owner: FrameOwner, callback: WorldFrameCallback) {
      if (!owner.active || owner.released) return 0;
      const id = nextId++;
      queued.set(id, { owner, callback });
      schedule();
      return id;
    },
    cancel(id: number) {
      if (!id) return;
      queued.delete(id);
      if (!queued.size && nativeId) { native.cancel(nativeId); nativeId = 0; }
    },
    cancelOwner(owner: FrameOwner) {
      for (const [id, job] of queued) if (job.owner === owner) queued.delete(id);
      if (!queued.size && nativeId) { native.cancel(nativeId); nativeId = 0; }
    },
  };
}

const worldFrames = createWorldFrameScheduler();
let sharedState: SharedState | null = null;

const worldEnabled = () => import.meta.env.VITE_HEARTH_HOUSE_WORLD === "1";
const makeRenderer = (options: WorldRendererOptions) => (options.rendererFactory ?? ((parameters) => new THREE.WebGLRenderer(parameters)))(options.parameters);

function attachListeners(state: LeaseState, canvas: HTMLCanvasElement) {
  for (const row of state.listeners) canvas.addEventListener(row.type, row.listener, row.options);
}

function detachListeners(state: LeaseState, canvas: HTMLCanvasElement) {
  for (const row of state.listeners) canvas.removeEventListener(row.type, row.listener, row.options);
}

function activate(state: LeaseState, renderer: THREE.WebGLRenderer, resume: boolean) {
  state.active = true;
  state.host.appendChild(renderer.domElement);
  // Render targets and scissor state belong to the scene that set them. A
  // shared canvas must return to the default framebuffer before another tool
  // configures its own clear colour and alpha.
  renderer.setRenderTarget(null);
  renderer.setScissorTest(false);
  renderer.autoClear = true;
  state.options.configure?.(renderer);
  attachListeners(state, renderer.domElement);
  if (resume) state.options.onResume?.();
}

function suspend(state: LeaseState, renderer: THREE.WebGLRenderer) {
  if (!state.active) return;
  state.active = false;
  worldFrames.cancelOwner(state);
  detachListeners(state, renderer.domElement);
  state.options.onSuspend?.();
}

function foreground(leases: LeaseState[]): LeaseState | undefined {
  let selected: LeaseState | undefined;
  for (const lease of leases) {
    if (lease.released) continue;
    if (!selected || lease.priority >= selected.priority) selected = lease;
  }
  return selected;
}

function rendererProxy(renderer: THREE.WebGLRenderer, state: LeaseState) {
  const methods = new Map<PropertyKey, (...args: unknown[]) => unknown>();
  return new Proxy(renderer, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== "function") return value;
      let wrapped = methods.get(property);
      if (!wrapped) {
        wrapped = (...args: unknown[]) => {
          if (!state.active || state.released) return undefined;
          return (value as (...callArgs: unknown[]) => unknown).apply(target, args);
        };
        methods.set(property, wrapped);
      }
      return wrapped;
    },
    set(target, property, value) {
      if (!state.active || state.released) return true;
      return Reflect.set(target, property, value, target);
    },
  });
}

/**
 * Owns a Three renderer for a world host. With the whole-house flag enabled,
 * leases form a foreground stack around one real renderer and one canvas.
 * Calls made through a suspended lease are inert, so an old animation loop can
 * never render its scene into the canvas currently owned by another tool.
 */
export function acquireWorldRenderer(host: HTMLElement, options: WorldRendererOptions = {}): WorldRendererLease {
  const shared = options.shared ?? worldEnabled();
  if (!shared) {
    const renderer = makeRenderer(options);
    const state: LeaseState = { host, options, priority: options.priority ?? 1, proxy: renderer, listeners: [], active: true, released: false };
    state.proxy = rendererProxy(renderer, state);
    host.appendChild(renderer.domElement);
    options.configure?.(renderer);
    return {
      renderer: state.proxy,
      get active() { return state.active && !state.released; },
      requestFrame(callback) { return worldFrames.request(state, callback); },
      cancelFrame(id) { worldFrames.cancel(id); },
      listenCanvas(type, listener, listenerOptions) {
        const row = { type, listener: listener as EventListener, options: listenerOptions };
        state.listeners.push(row);
        renderer.domElement.addEventListener(type, row.listener, listenerOptions);
        return () => {
          renderer.domElement.removeEventListener(type, row.listener, listenerOptions);
          const index = state.listeners.indexOf(row);
          if (index >= 0) state.listeners.splice(index, 1);
        };
      },
      release() {
        if (state.released) return;
        state.released = true;
        worldFrames.cancelOwner(state);
        detachListeners(state, renderer.domElement);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      },
    };
  }

  if (!sharedState) {
    // The context attributes cannot change after construction. Use the common
    // superset so the same context can serve opaque Journey scenes, transparent
    // pottery captures and every room that needs an immediate still image.
    sharedState = { renderer: makeRenderer({ ...options, parameters: { ...options.parameters, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "low-power" } }), leases: [] };
  }
  const renderer = sharedState.renderer;
  const previous = foreground(sharedState.leases);
  const state: LeaseState = { host, options, priority: options.priority ?? 1, proxy: renderer, listeners: [], active: false, released: false };
  state.proxy = rendererProxy(renderer, state);
  sharedState.leases.push(state);
  const selected = foreground(sharedState.leases);
  if (selected !== previous) {
    if (previous) suspend(previous, renderer);
    if (selected) activate(selected, renderer, false);
  }

  return {
    renderer: state.proxy,
    get active() { return state.active && !state.released; },
    requestFrame(callback) { return worldFrames.request(state, callback); },
    cancelFrame(id) { worldFrames.cancel(id); },
    listenCanvas(type, listener, listenerOptions) {
      const row = { type, listener: listener as EventListener, options: listenerOptions };
      state.listeners.push(row);
      if (state.active) renderer.domElement.addEventListener(type, row.listener, listenerOptions);
      return () => {
        renderer.domElement.removeEventListener(type, row.listener, listenerOptions);
        const index = state.listeners.indexOf(row);
        if (index >= 0) state.listeners.splice(index, 1);
      };
    },
    release() {
      if (state.released) return;
      state.released = true;
      worldFrames.cancelOwner(state);
      const owner = sharedState;
      if (!owner || owner.renderer !== renderer) return;
      const index = owner.leases.indexOf(state);
      if (index < 0) return;
      const wasActive = state.active;
      if (wasActive) suspend(state, renderer);
      owner.leases.splice(index, 1);
      const next = foreground(owner.leases);
      if (wasActive && next) activate(next, renderer, true);
      if (!owner.leases.length) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        sharedState = null;
      }
    },
  };
}
