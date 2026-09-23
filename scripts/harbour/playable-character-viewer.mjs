import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { createBodyFigure } from "../../src/harbour/body/figure.ts";
import { PLAYABLE_AVATARS } from "../../src/harbour/body/avatarDefinition.ts";
import { attachPlayableSurface } from "../../src/harbour/body/playableSurface.ts";

// Replaced at bundle time. The offline reviewer has no fetches: its two
// compact game GLBs are data URLs in this viewer-only configuration.
const manifest = __HEARTH_PLAYERS__;
const canvas = document.querySelector("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0xdce8e8);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x4f6570, 2.3), new THREE.DirectionalLight(0xffffff, 2));
scene.children.at(-1).position.set(2, 4, 3);
const camera = new THREE.PerspectiveCamera(35, 1, .01, 20); let rear = false;
const frameCamera = () => { camera.position.set(1.6, 1.15, rear ? -2.7 : 2.7); camera.lookAt(0, .64, 0); };
frameCamera();
scene.add(new THREE.Mesh(new THREE.CircleGeometry(.75, 40), new THREE.MeshStandardMaterial({ color: 0x7b9b91, roughness: 1 })).rotateX(-Math.PI / 2));
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
let figure = null, surface = null, selection = 0, phase = 0, move = "idle", jumping = 0, moveAt = 0;
const resize = () => { const { width, height } = canvas.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
addEventListener("resize", resize); resize();
function disposeSurface(root) {
  if (!root) return;
  const owned = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    owned.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) owned.add(material);
  });
  root.removeFromParent();
  for (const item of owned) item.dispose();
}
async function select(avatar) {
  const request = ++selection;
  const row = manifest.characters.find(item => item.avatar === avatar);
  const gltf = await loader.loadAsync(row.dataUrl);
  if (request !== selection) { disposeSurface(gltf.scene); return; }
  disposeSurface(surface); figure?.dispose();
  figure = createBodyFigure(PLAYABLE_AVATARS[avatar].colours, PLAYABLE_AVATARS[avatar].anatomy);
  surface = attachPlayableSurface(figure, avatar, gltf.scene);
  scene.add(figure.group);
}
for (const button of document.querySelectorAll("[data-avatar]")) button.onclick = () => select(button.dataset.avatar);
for (const button of document.querySelectorAll("[data-move]")) button.onclick = () => { move = button.dataset.move; moveAt = performance.now() / 1000; jumping = move === "jump" ? .55 : 0; };
for (const button of document.querySelectorAll("[data-view]")) button.onclick = () => { rear = button.dataset.view === "rear"; frameCamera(); };
await select("bianca");
let before = performance.now(), animation = 0;
function frame(now) {
  const dt = Math.min(.05, (now - before) / 1000); before = now;
  const walking = move === "walk" || move === "run";
  phase += dt * (move === "run" ? 9 : walking ? 5 : 0);
  jumping = Math.max(0, jumping - dt);
  if (figure) {
    const air = Math.sin(jumping / .55 * Math.PI) * .26;
    figure.group.position.y = air;
    figure.pose(phase, walking ? 1 : 0, now / 1000, {
      lean: 0, bank: 0, run: move === "run" ? 1 : 0, air,
      emote: move === "wave" || move === "dance" ? move : null,
      emoteAt: now / 1000 - moveAt,
    });
  }
  renderer.render(scene, camera); animation = requestAnimationFrame(frame);
}
animation = requestAnimationFrame(frame);
addEventListener("pagehide", () => { ++selection; cancelAnimationFrame(animation); disposeSurface(surface); figure?.dispose(); renderer.dispose(); });
