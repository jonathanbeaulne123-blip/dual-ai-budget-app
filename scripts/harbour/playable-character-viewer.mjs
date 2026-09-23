import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";

const manifest = await fetch("./manifest.json").then((response) => response.json());
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
let figure = null, phase = 0, move = "idle", jumping = 0;
const resize = () => { const { width, height } = canvas.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
addEventListener("resize", resize); resize();
function limbs(avatar) {
  const palette = avatar === "bianca" ? { coat: 0xa86c3d, trouser: 0x3e709e, shoe: 0x342d32, shoulder: .075 } : { coat: 0x302d30, trouser: 0x3e709e, shoe: 0x302a28, shoulder: .08 };
  const g = new THREE.Group(), coat = new THREE.MeshStandardMaterial({ color: palette.coat, roughness: .9 }), trouser = new THREE.MeshStandardMaterial({ color: palette.trouser, roughness: 1 }), shoe = new THREE.MeshStandardMaterial({ color: palette.shoe, roughness: 1 });
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(.061, .052, 4, 8), trouser); pelvis.position.y = .258; g.add(pelvis);
  for (const side of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(side * .048, .235, 0); const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.042, .145, 4, 8), trouser); leg.position.y = -.1145; const foot = new THREE.Mesh(new THREE.BoxGeometry(.072, .034, .108), shoe); foot.position.set(0, -.212, .018); hip.add(leg, foot); g.add(hip); const shoulder = new THREE.Group(); shoulder.position.set(side * palette.shoulder, .402, 0); const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.031, .118, 4, 8), coat); arm.position.y = -.09; shoulder.add(arm); g.add(shoulder); }
  return g;
}
async function select(avatar) { figure?.removeFromParent(); const row = manifest.characters.find((item) => item.avatar === avatar); const gltf = await loader.loadAsync(row.url); const g = new THREE.Group(), shell = gltf.scene; shell.scale.setScalar(.58 / row.sourceFullBounds.max[1]); shell.position.y = -.58 * row.sourceFullBounds.min[1] / row.sourceFullBounds.max[1]; g.scale.setScalar(1.25 / .58); g.add(limbs(avatar), shell); scene.add(g); figure = g; }
for (const button of document.querySelectorAll("[data-avatar]")) button.onclick = () => select(button.dataset.avatar);
for (const button of document.querySelectorAll("[data-move]")) button.onclick = () => { move = button.dataset.move; jumping = move === "jump" ? .55 : 0; };
for (const button of document.querySelectorAll("[data-view]")) button.onclick = () => { rear = button.dataset.view === "rear"; frameCamera(); };
await select("bianca");
let before = performance.now(); function frame(now) { const dt = Math.min(.05, (now - before) / 1000); before = now; phase += dt * (move === "run" ? 9 : move === "walk" ? 5 : 0); if (figure) { const arms = figure.children[0].children; const swing = Math.sin(phase) * (move === "run" ? .95 : .58); if (move === "walk" || move === "run") { arms[0].rotation.x = -swing; arms[1].rotation.x = swing; arms[2].rotation.x = swing; arms[3].rotation.x = -swing; } else if (move === "wave") { arms[3].rotation.x = -2.45; } else if (move === "dance") { figure.rotation.z = Math.sin(now / 180) * .2; } else { for (const limb of arms) limb.rotation.x *= .85; } if (jumping > 0) { jumping -= dt; figure.position.y = Math.sin(Math.max(0, jumping) / .55 * Math.PI) * .26; } else figure.position.y = 0; }
renderer.render(scene, camera); requestAnimationFrame(frame); } requestAnimationFrame(frame);
