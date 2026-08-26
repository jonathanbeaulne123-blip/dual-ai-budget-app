import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

type HerculesMood = "idle" | "curious" | "teaching" | "concerned" | "celebrating";

type CompanionResult = {
  mood?: HerculesMood;
  message?: string;
  headline?: string;
  ledger?: "personal" | "household";
};

type OpenAiBridge = {
  toolOutput?: CompanionResult;
  displayMode?: string;
  requestDisplayMode?: (options: { mode: "pip" | "inline" | "fullscreen" }) => Promise<unknown>;
  notifyIntrinsicHeight?: (height: number) => void;
};

declare global {
  interface Window {
    openai?: OpenAiBridge;
  }
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Hercules companion markup is missing ${selector}.`);
  return element;
}

const host = requiredElement<HTMLElement>("#hercules-companion");
const canvas = requiredElement<HTMLCanvasElement>("#hercules-canvas");
const messageEl = requiredElement<HTMLElement>("#hercules-message");
const headlineEl = requiredElement<HTMLElement>("#hercules-headline");
const ledgerEl = requiredElement<HTMLElement>("#hercules-ledger");
const statusEl = requiredElement<HTMLElement>("#hercules-status");
const pipButton = requiredElement<HTMLButtonElement>("#hercules-pip");
const motionButton = requiredElement<HTMLButtonElement>("#hercules-motion");
const fallbackImage = requiredElement<HTMLImageElement>("#hercules-fallback");

// Signals to the tiny inline watchdog that the cross-origin module loaded.
host.dataset.runtime = "booted";
canvas.hidden = false;
fallbackImage.hidden = true;

const modelUrl = host.dataset.modelUrl;
const fallbackUrl = host.dataset.fallbackUrl;
if (!modelUrl) throw new Error("Hercules model URL is missing.");

const moods = new Set<HerculesMood>(["idle", "curious", "teaching", "concerned", "celebrating"]);
let mood: HerculesMood = "idle";
let motionEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let companionResult: CompanionResult = {};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function applyResult(value: unknown): void {
  const next = value && typeof value === "object" ? value as CompanionResult : {};
  companionResult = next;
  mood = moods.has(next.mood as HerculesMood) ? next.mood as HerculesMood : "idle";
  host.dataset.mood = mood;
  messageEl.textContent = cleanText(next.message, 180) || "Mrrp. I’m watching the books.";
  headlineEl.textContent = cleanText(next.headline, 72) || "Hercules Pro";
  const ledger = next.ledger === "household" ? "Household ledger" : next.ledger === "personal" ? "Personal ledger" : "Hearth books";
  ledgerEl.textContent = ledger;
}

function toolResultFromMessage(event: MessageEvent): CompanionResult | undefined {
  if (event.source !== window.parent) return undefined;
  const payload = event.data as { jsonrpc?: string; method?: string; params?: { structuredContent?: CompanionResult } } | undefined;
  if (!payload || payload.jsonrpc !== "2.0" || payload.method !== "ui/notifications/tool-result") return undefined;
  return payload.params?.structuredContent;
}

window.addEventListener("message", (event) => {
  const next = toolResultFromMessage(event);
  if (next) applyResult(next);
}, { passive: true });

window.addEventListener("openai:set_globals", () => {
  if (window.openai?.toolOutput) applyResult(window.openai.toolOutput);
}, { passive: true });

applyResult(window.openai?.toolOutput);
if (!motionEnabled) {
  motionButton.textContent = "Play";
  motionButton.setAttribute("aria-pressed", "true");
  statusEl.textContent = "Animation paused by your motion preference";
}

async function requestPictureInPicture(): Promise<void> {
  if (!window.openai?.requestDisplayMode) {
    statusEl.textContent = "Animated inline";
    pipButton.hidden = true;
    return;
  }
  try {
    await window.openai.requestDisplayMode({ mode: "pip" });
    statusEl.textContent = "Beside your chat";
    pipButton.hidden = true;
  } catch {
    statusEl.textContent = "Tap to keep Hercules beside the chat";
    pipButton.hidden = false;
  }
}

pipButton.addEventListener("click", () => void requestPictureInPicture());
motionButton.addEventListener("click", () => {
  motionEnabled = !motionEnabled;
  motionButton.textContent = motionEnabled ? "Pause" : "Play";
  motionButton.setAttribute("aria-pressed", String(!motionEnabled));
});

function showFallback(): void {
  host.dataset.runtime = "failed";
  canvas.hidden = true;
  if (fallbackUrl && fallbackImage.src !== fallbackUrl) fallbackImage.src = fallbackUrl;
  fallbackImage.hidden = false;
  statusEl.textContent = "3D unavailable — Hercules is still listening";
}

let renderer: THREE.WebGLRenderer | undefined;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
} catch {
  showFallback();
  setTimeout(() => void requestPictureInPicture(), 180);
}

if (renderer) {
const activeRenderer = renderer;
activeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
activeRenderer.outputColorSpace = THREE.SRGBColorSpace;
activeRenderer.shadowMap.enabled = true;
activeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
camera.position.set(0, 0.18, 3.25);
camera.lookAt(0, 0.05, 0);

scene.add(new THREE.HemisphereLight(0xfff7e7, 0x654834, 2.5));
const keyLight = new THREE.DirectionalLight(0xffefd1, 4.2);
keyLight.position.set(2.5, 4, 3);
keyLight.castShadow = true;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xd5e8ff, 2.2);
rimLight.position.set(-3, 2, -2);
scene.add(rimLight);

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.72, 48),
  new THREE.MeshBasicMaterial({ color: 0x35281f, transparent: true, opacity: 0.18, depthWrite: false }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0, -0.96, 0.08);
scene.add(shadow);

const stage = new THREE.Group();
scene.add(stage);

type RigPart = { object: THREE.Object3D; rotation: THREE.Euler; scale: THREE.Vector3 };
let head: RigPart | undefined;
let chest: RigPart | undefined;
let ears: RigPart[] = [];
let eyelids: RigPart[] = [];
let tail: RigPart[] = [];
let modelReady = false;

function rigPart(object: THREE.Object3D | null | undefined): RigPart | undefined {
  return object ? { object, rotation: object.rotation.clone(), scale: object.scale.clone() } : undefined;
}

function findRig(root: THREE.Object3D): void {
  head = rigPart(root.getObjectByName("rig_head"));
  chest = rigPart(root.getObjectByName("rig_chest"));
  ears = ["rig_ear_L", "rig_ear_R"].map((name) => rigPart(root.getObjectByName(name))).filter((part): part is RigPart => Boolean(part));
  eyelids = ["rig_eyelid_L", "rig_eyelid_R"].map((name) => rigPart(root.getObjectByName(name))).filter((part): part is RigPart => Boolean(part));
  tail = ["rig_tailBase", ...Array.from({ length: 10 }, (_, index) => `rig_tail_${String(index + 1).padStart(2, "0")}`)]
    .map((name) => rigPart(root.getObjectByName(name))).filter((part): part is RigPart => Boolean(part));
}

function fitModel(model: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(center);
  const height = Math.max(size.y, 0.001);
  model.scale.multiplyScalar(1.9 / height);
  model.rotation.y = -0.3;
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = true;
    }
  });
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const modelLoadTimeout = window.setTimeout(showFallback, 12000);
loader.load(modelUrl, (gltf) => {
  window.clearTimeout(modelLoadTimeout);
  const model = gltf.scene;
  findRig(model);
  fitModel(model);
  stage.add(model);
  modelReady = true;
  host.dataset.runtime = "ready";
  statusEl.textContent = "Hercules is awake";
  setTimeout(() => void requestPictureInPicture(), 180);
}, undefined, () => {
  window.clearTimeout(modelLoadTimeout);
  showFallback();
});

let dragStart: { x: number; rotation: number } | undefined;
canvas.addEventListener("pointerdown", (event) => {
  dragStart = { x: event.clientX, rotation: stage.rotation.y };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!dragStart) return;
  stage.rotation.y = dragStart.rotation + (event.clientX - dragStart.x) * 0.009;
});
canvas.addEventListener("pointerup", () => { dragStart = undefined; });
canvas.addEventListener("pointercancel", () => { dragStart = undefined; });

function resize(): void {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  activeRenderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  window.openai?.notifyIntrinsicHeight?.(Math.ceil(host.getBoundingClientRect().height));
}

new ResizeObserver(resize).observe(host);
resize();

function moodValue(values: Record<HerculesMood, number>): number {
  return values[mood];
}

function animateRig(seconds: number): void {
  if (!modelReady || !motionEnabled) return;
  const breath = Math.sin(seconds * 2.05);
  const curiosity = moodValue({ idle: 0, curious: 1, teaching: 0.35, concerned: -0.6, celebrating: 0.45 });
  const celebration = mood === "celebrating" ? Math.abs(Math.sin(seconds * 5.4)) : 0;
  stage.position.y = breath * 0.008 + celebration * 0.13;
  stage.rotation.z = mood === "concerned" ? -0.045 : Math.sin(seconds * 0.65) * 0.012;

  if (chest) {
    chest.object.scale.set(chest.scale.x * (1 + breath * 0.012), chest.scale.y * (1 + breath * 0.018), chest.scale.z * (1 + breath * 0.012));
  }
  if (head) {
    head.object.rotation.set(
      head.rotation.x + Math.sin(seconds * 0.8) * 0.025,
      head.rotation.y + Math.sin(seconds * 0.48) * 0.08 + curiosity * 0.045,
      head.rotation.z + curiosity * 0.075 + (mood === "teaching" ? Math.sin(seconds * 2.8) * 0.035 : 0),
    );
  }
  const blinkPhase = seconds % 5.7;
  const blink = blinkPhase > 5.43 ? Math.max(0.08, Math.abs(blinkPhase - 5.565) / 0.135) : 1;
  eyelids.forEach((part) => part.object.scale.set(part.scale.x, part.scale.y * blink, part.scale.z));
  ears.forEach((part, index) => {
    const direction = index === 0 ? 1 : -1;
    part.object.rotation.z = part.rotation.z + direction * (mood === "concerned" ? 0.18 : Math.sin(seconds * 1.45 + index) * 0.025);
  });
  tail.forEach((part, index) => {
    const wave = Math.sin(seconds * moodValue({ idle: 1.4, curious: 2.1, teaching: 1.7, concerned: 0.9, celebrating: 3.4 }) - index * 0.42);
    part.object.rotation.y = part.rotation.y + wave * (0.035 + index * 0.006);
    part.object.rotation.z = part.rotation.z + Math.cos(seconds * 1.15 - index * 0.36) * (0.02 + index * 0.004);
  });
}

const clock = new THREE.Clock();
function frame(): void {
  const seconds = clock.getElapsedTime();
  animateRig(seconds);
  if (!motionEnabled) statusEl.textContent = "Animation paused";
  else if (modelReady && companionResult.message) statusEl.textContent = window.openai?.displayMode === "pip" ? "Beside your chat" : "Hercules is listening";
  activeRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
}
