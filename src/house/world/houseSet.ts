import * as THREE from "three";
import { houseStairOffset } from "./walkPaths.ts";

export type HouseTheme = "classic" | "taylor" | "newfoundland";
export type HouseRoom = "home" | "study" | "kitchen-table" | "together";
export type HouseLevel = "above" | "middle" | "below";
export type HouseZoneKey = `${HouseRoom}:${HouseLevel}`;

export type HouseZone = {
  center: [number, number, number];
  camera: [number, number, number];
  phoneCamera: [number, number, number];
};

export type HouseAnchor = {
  id: string;
  zone: HouseZoneKey;
  position: [number, number, number];
  label: string;
};

export type HouseFocus = {
  center: [number, number, number];
  camera: [number, number, number];
  phoneCamera: [number, number, number];
};

export type HouseSet = {
  group: THREE.Group;
  zones: Record<HouseZoneKey, HouseZone>;
  anchors: HouseAnchor[];
  /** Close authored poses keyed by anchor id. Phone navigation should prefer these over a whole-wing zone pose. */
  focus: Record<string, HouseFocus>;
  animate(time: number): void;
  dispose(): void;
};

type ThemeKit = {
  wall: number;
  wallAlt: number;
  floor: number;
  wood: number;
  woodDark: number;
  trim: number;
  metal: number;
  paper: number;
  accent: number;
  accent2: number;
  water: number;
  roof: number;
  glass: number;
};

type MovingPart = {
  object: THREE.Object3D;
  baseY: number;
  baseScaleX?: number;
  baseScaleZ?: number;
  phase: number;
  amplitude: number;
  speed: number;
  pulse?: number;
};

const WING_WIDTH = 5.8;
const WING_DEPTH = 5.1;
const FLOOR_HEIGHT = 3.05;
const FLOOR_Y: Record<HouseLevel, number> = { below: 0, middle: FLOOR_HEIGHT, above: FLOOR_HEIGHT * 2 };
const WING_X: Record<HouseRoom, number> = { home: -9.3, study: -3.1, "kitchen-table": 3.1, together: 9.3 };
const ROOMS: readonly HouseRoom[] = ["home", "study", "kitchen-table", "together"];
const LEVELS: readonly HouseLevel[] = ["below", "middle", "above"];

const THEMES: Record<HouseTheme, ThemeKit> = {
  classic: {
    wall: 0xd7d8c2,
    wallAlt: 0xc7ccb1,
    floor: 0xc69b68,
    wood: 0x9a6845,
    woodDark: 0x513a2c,
    trim: 0xeee3c9,
    metal: 0xb28a45,
    paper: 0xf5eddb,
    accent: 0x647a5d,
    accent2: 0xac6651,
    water: 0x5f9292,
    roof: 0x4f5b49,
    glass: 0xc7ded8,
  },
  taylor: {
    wall: 0xe8d8d9,
    wallAlt: 0xd8c2cc,
    floor: 0xc69f91,
    wood: 0x916b73,
    woodDark: 0x563c4e,
    trim: 0xfff2df,
    metal: 0xc29a70,
    paper: 0xfff6e9,
    accent: 0x8b6f8e,
    accent2: 0xb75c6e,
    water: 0x839eaa,
    roof: 0x6b526a,
    glass: 0xe1ccd8,
  },
  newfoundland: {
    wall: 0xd9e3d8,
    wallAlt: 0xb8ceca,
    floor: 0xb99669,
    wood: 0x789290,
    woodDark: 0x294e58,
    trim: 0xf5e3bb,
    metal: 0xa88d59,
    paper: 0xf8edd4,
    accent: 0x3c7f8c,
    accent2: 0xd45e49,
    water: 0x327e8c,
    roof: 0x365a63,
    glass: 0xa7d2cf,
  },
};

function roofGeometry(width: number, depth: number, peakX: number, leftHeight: number, rightHeight: number) {
  const x0 = -width / 2;
  const x1 = width / 2;
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const positions = new Float32Array([
    x0, 0, z0, x1, 0, z0, peakX, leftHeight, z0,
    x0, 0, z1, x1, 0, z1, peakX, rightHeight, z1,
  ]);
  const indices = [
    0, 1, 2, 5, 4, 3,
    0, 3, 4, 0, 4, 1,
    1, 4, 5, 1, 5, 2,
    2, 5, 3, 2, 3, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createHouseSet(theme: HouseTheme): HouseSet {
  const resolvedTheme: HouseTheme = theme in THEMES ? theme : "classic";
  const kit = THEMES[resolvedTheme];
  const group = new THREE.Group();
  group.name = `whole-house-${resolvedTheme}`;

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const moving: MovingPart[] = [];
  let disposed = false;

  const trackGeometry = <T extends THREE.BufferGeometry>(value: T): T => {
    geometries.add(value);
    return value;
  };
  const trackMaterial = <T extends THREE.Material>(value: T): T => {
    materials.add(value);
    return value;
  };

  const unitBox = trackGeometry(new THREE.BoxGeometry(1, 1, 1));
  const unitCylinder = trackGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 14));
  const taperedCylinder = trackGeometry(new THREE.CylinderGeometry(0.38, 0.5, 1, 14));
  const unitSphere = trackGeometry(new THREE.SphereGeometry(0.5, 12, 8));
  const unitCone = trackGeometry(new THREE.ConeGeometry(0.5, 1, 12));
  const halfArch = trackGeometry(new THREE.TorusGeometry(0.5, 0.065, 8, 20, Math.PI));
  const catTail = trackGeometry(new THREE.TorusGeometry(0.42, 0.055, 7, 18, Math.PI * 1.35));
  const flameGeometry = trackGeometry(new THREE.ConeGeometry(0.5, 1, 9));

  const standard = (color: number, roughness = 0.82, metalness = 0) => trackMaterial(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  const wallMat = standard(kit.wall, 0.96);
  const wallAltMat = standard(kit.wallAlt, 0.94);
  const floorMat = standard(kit.floor, 0.88);
  const woodMat = standard(kit.wood, 0.84);
  const darkWoodMat = standard(kit.woodDark, 0.9);
  const trimMat = standard(kit.trim, 0.88);
  const metalMat = standard(kit.metal, 0.35, 0.48);
  const paperMat = standard(kit.paper, 0.97);
  const accentMat = standard(kit.accent, 0.8);
  const accent2Mat = standard(kit.accent2, 0.76);
  const roofMat = standard(kit.roof, 0.9);
  const blackMat = standard(0x252a27, 0.9);
  const glassMat = trackMaterial(new THREE.MeshPhysicalMaterial({ color: kit.glass, transparent: true, opacity: 0.32, roughness: 0.16, transmission: 0.35, depthWrite: false }));
  const waterMat = trackMaterial(new THREE.MeshPhysicalMaterial({ color: kit.water, transparent: true, opacity: 0.62, roughness: 0.24, metalness: 0.08, depthWrite: false }));
  const flameMat = trackMaterial(new THREE.MeshBasicMaterial({ color: 0xf28a4d, transparent: true, opacity: 0.86 }));
  const glowMat = trackMaterial(new THREE.MeshBasicMaterial({ color: 0xf6d08a, transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide }));
  const leafMat = standard(resolvedTheme === "taylor" ? 0x74705d : resolvedTheme === "newfoundland" ? 0x46776c : 0x55714f, 0.9);
  const clayMat = standard(resolvedTheme === "newfoundland" ? 0x467d89 : 0xb5684c, 0.75);

  function mesh(
    parent: THREE.Object3D,
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    rotation: [number, number, number] = [0, 0, 0],
  ) {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.position.set(...position);
    object.scale.set(...scale);
    object.rotation.set(...rotation);
    object.castShadow = !material.transparent;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  const box = (
    parent: THREE.Object3D,
    name: string,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ) => mesh(parent, name, unitBox, material, position, scale, rotation);

  function instances(
    parent: THREE.Object3D,
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    entries: readonly { position: [number, number, number]; scale: [number, number, number]; rotation?: [number, number, number] }[],
  ) {
    const object = new THREE.InstancedMesh(geometry, material, entries.length);
    object.name = name;
    object.castShadow = !material.transparent;
    object.receiveShadow = true;
    const dummy = new THREE.Object3D();
    entries.forEach((entry, index) => {
      dummy.position.set(...entry.position);
      dummy.scale.set(...entry.scale);
      dummy.rotation.set(...(entry.rotation ?? [0, 0, 0]));
      dummy.updateMatrix();
      object.setMatrixAt(index, dummy.matrix);
    });
    object.instanceMatrix.needsUpdate = true;
    parent.add(object);
    return object;
  }

  function makeShelf(parent: THREE.Object3D, name: string, x: number, y: number, z: number, width: number, levels: number) {
    box(parent, `${name}-left`, darkWoodMat, [x - width / 2, y + 0.72, z], [0.12, 1.55, 0.62]);
    box(parent, `${name}-right`, darkWoodMat, [x + width / 2, y + 0.72, z], [0.12, 1.55, 0.62]);
    for (let index = 0; index < levels; index += 1) {
      box(parent, `${name}-shelf-${index}`, woodMat, [x, y + index * (1.35 / Math.max(1, levels - 1)), z], [width, 0.12, 0.74]);
    }
  }

  function makeTable(parent: THREE.Object3D, name: string, x: number, y: number, z: number, width: number, depth: number, material = woodMat) {
    box(parent, `${name}-top`, material, [x, y + 0.86, z], [width, 0.16, depth]);
    for (const dx of [-width * 0.39, width * 0.39]) for (const dz of [-depth * 0.34, depth * 0.34]) {
      box(parent, `${name}-leg`, darkWoodMat, [x + dx, y + 0.41, z + dz], [0.14, 0.82, 0.14]);
    }
  }

  function makeChair(parent: THREE.Object3D, name: string, x: number, y: number, z: number, rotationY = 0) {
    const chair = new THREE.Group();
    chair.name = name;
    chair.position.set(x, y, z);
    chair.rotation.y = rotationY;
    parent.add(chair);
    box(chair, `${name}-seat`, woodMat, [0, 0.5, 0], [0.76, 0.12, 0.72]);
    box(chair, `${name}-back`, darkWoodMat, [0, 1.02, -0.32], [0.76, 0.92, 0.12]);
    for (const dx of [-0.28, 0.28]) for (const dz of [-0.25, 0.25]) box(chair, `${name}-leg`, darkWoodMat, [dx, 0.24, dz], [0.1, 0.5, 0.1]);
  }

  function makeBooks(parent: THREE.Object3D, name: string, x: number, y: number, z: number, count: number, horizontal = false) {
    const colors = [accentMat, accent2Mat, darkWoodMat, metalMat];
    for (let index = 0; index < count; index += 1) {
      const height = 0.6 + (index % 3) * 0.12;
      box(
        parent,
        `${name}-${index}`,
        colors[index % colors.length]!,
        horizontal ? [x, y + index * 0.14, z] : [x + (index - (count - 1) / 2) * 0.24, y + height / 2, z],
        horizontal ? [0.72 - index * 0.035, 0.12, 0.42] : [0.19, height, 0.48],
        horizontal ? [0, 0, index % 2 ? 0.04 : -0.03] : [0, 0, (index - count / 2) * 0.025],
      );
    }
  }

  function makePot(parent: THREE.Object3D, name: string, x: number, y: number, z: number, scale = 1) {
    mesh(parent, `${name}-pot`, taperedCylinder, clayMat, [x, y + 0.23 * scale, z], [0.5 * scale, 0.46 * scale, 0.5 * scale]);
    for (const [dx, dz, lean] of [[-0.18, 0, -0.2], [0.17, 0.03, 0.18], [0, -0.08, 0]] as const) {
      mesh(parent, `${name}-stem`, unitCylinder, leafMat, [x + dx * scale, y + 0.83 * scale, z + dz], [0.045 * scale, 0.85 * scale, 0.045 * scale], [0, 0, lean]);
      mesh(parent, `${name}-leaf`, unitSphere, leafMat, [x + (dx + lean) * scale, y + 1.16 * scale, z + dz], [0.34 * scale, 0.12 * scale, 0.19 * scale], [0, 0, lean]);
    }
  }

  function makeCat(parent: THREE.Object3D, x: number, y: number, z: number) {
    const cat = new THREE.Group();
    cat.name = "hercules-sculpture";
    cat.position.set(x, y, z);
    parent.add(cat);
    mesh(cat, "hercules-body", unitSphere, clayMat, [0, 0.48, 0], [0.54, 0.78, 0.46]);
    mesh(cat, "hercules-chest", unitSphere, trimMat, [0, 0.56, 0.35], [0.25, 0.42, 0.12]);
    mesh(cat, "hercules-head", unitSphere, clayMat, [0, 1.16, 0], [0.5, 0.47, 0.43]);
    mesh(cat, "hercules-ear-left", unitCone, clayMat, [-0.28, 1.57, 0], [0.22, 0.42, 0.18], [0, 0, -0.16]);
    mesh(cat, "hercules-ear-right", unitCone, clayMat, [0.28, 1.57, 0], [0.22, 0.42, 0.18], [0, 0, 0.16]);
    mesh(cat, "hercules-tail", catTail, clayMat, [0.43, 0.48, -0.05], [0.85, 0.85, 0.85], [Math.PI / 2, 0.2, -0.7]);
  }

  function makeWingArchitecture(room: HouseRoom, wingIndex: number) {
    const x = WING_X[room];
    const wing = new THREE.Group();
    wing.name = `house-wing-${room}`;
    wing.position.x = x;
    group.add(wing);

    for (const level of LEVELS) {
      const y = FLOOR_Y[level];
      box(wing, `${room}-${level}-floor`, floorMat, [0, y - 0.08, 0], [WING_WIDTH, 0.16, WING_DEPTH]);
      box(wing, `${room}-${level}-back-wall`, level === "middle" ? wallMat : wallAltMat, [0, y + 1.42, -WING_DEPTH / 2], [WING_WIDTH, 2.85, 0.14]);
      box(wing, `${room}-${level}-left-post`, darkWoodMat, [-WING_WIDTH / 2, y + 1.42, 0], [0.15, 2.85, WING_DEPTH]);
      box(wing, `${room}-${level}-right-post`, darkWoodMat, [WING_WIDTH / 2, y + 1.42, 0], [0.15, 2.85, WING_DEPTH]);
      box(wing, `${room}-${level}-front-beam`, darkWoodMat, [0, y + 2.82, WING_DEPTH / 2], [WING_WIDTH, 0.18, 0.18]);
      box(wing, `${room}-${level}-skirting`, trimMat, [0, y + 0.13, -WING_DEPTH / 2 + 0.09], [WING_WIDTH - 0.2, 0.18, 0.08]);
    }

    const roofY = FLOOR_Y.above + 2.78;
    const roof = resolvedTheme === "newfoundland"
      ? roofGeometry(WING_WIDTH + 0.5, WING_DEPTH + 0.55, -0.72, 1.1, 1.1)
      : resolvedTheme === "taylor"
        ? roofGeometry(WING_WIDTH + 0.7, WING_DEPTH + 0.6, 0, 0.86, 0.86)
        : roofGeometry(WING_WIDTH + 0.55, WING_DEPTH + 0.55, 0, 1.28, 1.28);
    trackGeometry(roof);
    mesh(wing, `${room}-roof`, roof, roofMat, [0, roofY, -0.02]);

    if (resolvedTheme === "classic") {
      box(wing, `${room}-ridge`, metalMat, [0, roofY + 1.27, 0], [0.11, 0.11, WING_DEPTH + 0.65]);
      instances(wing, `${room}-oak-quoins`, unitBox, woodMat, [-2.35, 2.35].map(px => ({
        position: [px, 4.53, -2.54] as [number, number, number],
        scale: [0.22, 8.9, 0.2] as [number, number, number],
      })));
    } else if (resolvedTheme === "taylor") {
      const beads = Array.from({ length: 8 }, (_, index) => ({
        position: [-2.55 + index * 0.73, roofY + 0.06 + Math.sin(index * 0.8) * 0.09, 2.68] as [number, number, number],
        scale: [0.19, 0.19, 0.19] as [number, number, number],
      }));
      instances(wing, `${room}-paper-eave-beads`, unitSphere, wingIndex % 2 ? accent2Mat : accentMat, beads);
      instances(wing, `${room}-album-panels`, unitBox, paperMat, LEVELS.map(level => {
        const y = FLOOR_Y[level];
        return {
          position: [0, y + 1.45, -2.49] as [number, number, number],
          scale: [4.78, 2.18, 0.035] as [number, number, number],
          rotation: [0, 0, wingIndex % 2 ? 0.012 : -0.012] as [number, number, number],
        };
      }));
    } else {
      const clapboards = LEVELS.flatMap(level => {
        const y = FLOOR_Y[level];
        return Array.from({ length: 6 }, (_, slat) => ({
          position: [0, y + 0.38 + slat * 0.43, -2.485] as [number, number, number],
          scale: [5.25, 0.06, 0.035] as [number, number, number],
        }));
      });
      instances(wing, `${room}-clapboards`, unitBox, trimMat, clapboards);
      box(wing, `${room}-chimney`, accent2Mat, [1.65, roofY + 1.15, -0.75], [0.48, 1.55, 0.58]);
      instances(wing, `${room}-wharf-pilings`, unitBox, darkWoodMat, [-2.15, 2.15].map(px => ({
        position: [px, -0.75, 0.8] as [number, number, number],
        scale: [0.27, 1.5, 0.27] as [number, number, number],
      })));
    }
  }

  function makeConnections() {
    const thresholdEntries: { position: [number, number, number]; scale: [number, number, number] }[] = [];
    const lintelEntries: { position: [number, number, number]; scale: [number, number, number] }[] = [];
    for (let index = 0; index < ROOMS.length - 1; index += 1) {
      const left = WING_X[ROOMS[index]!] + WING_WIDTH / 2;
      const right = WING_X[ROOMS[index + 1]!] - WING_WIDTH / 2;
      const x = (left + right) / 2;
      const width = right - left + 0.34;
      for (const level of LEVELS) {
        const y = FLOOR_Y[level];
        thresholdEntries.push({ position: [x, y, 0.45], scale: [width, 0.14, 1.4] });
        lintelEntries.push({ position: [x, y + 2.38, -0.45], scale: [width + 0.22, 0.14, 0.16] });
      }
    }
    instances(group, "connected-room-thresholds", unitBox, floorMat, thresholdEntries);
    instances(group, "connected-room-lintels", unitBox, darkWoodMat, lintelEntries);

    // Alternating compact stair flights keep the cutaway visibly traversable without blocking the front rooms.
    const stairEntries: { position: [number, number, number]; scale: [number, number, number] }[] = [];
    const railEntries: { position: [number, number, number]; scale: [number, number, number]; rotation: [number, number, number] }[] = [];
    ROOMS.forEach((room, roomIndex) => {
      const x = WING_X[room] + houseStairOffset(room);
      for (let floorIndex = 0; floorIndex < 2; floorIndex += 1) {
        const fromY = floorIndex * FLOOR_HEIGHT;
        for (let step = 0; step < 9; step += 1) {
          const z = -1.78 + step * 0.31;
          stairEntries.push({ position: [x, fromY + 0.15 + step * 0.31, z], scale: [0.9, 0.2, 0.38] });
        }
        railEntries.push({
          position: [x + (roomIndex % 2 ? -0.5 : 0.5), fromY + 1.55, -0.54],
          scale: [0.06, 2.55, 0.06],
          rotation: [0, 0, roomIndex % 2 ? 0.74 : -0.74],
        });
      }
    });
    instances(group, "whole-house-stair-treads", unitBox, woodMat, stairEntries);
    instances(group, "whole-house-stair-rails", unitBox, metalMat, railEntries);
  }

  function furnishHome() {
    const x = WING_X.home;

    // Cellar — translucent obligations on a real shelf above a shallow household water line.
    const cellarY = FLOOR_Y.below;
    box(group, "cellar-stone-plinth", darkWoodMat, [x, cellarY + 0.22, -0.6], [4.65, 0.44, 2.9]);
    const water = box(group, "cellar-water", waterMat, [x, cellarY + 0.5, -0.18], [4.25, 0.22, 2.18]);
    moving.push({ object: water, baseY: water.position.y, phase: 0.3, amplitude: 0.035, speed: 0.8, pulse: 0.018 });
    box(group, "cellar-jar-rail", metalMat, [x, cellarY + 1.05, -1.62], [4.45, 0.12, 0.18]);
    const jarEntries = [-1.55, -0.78, 0, 0.78, 1.55].map((dx, index) => ({
      position: [x + dx, cellarY + 1.43 + (index % 2) * 0.06, -1.48] as [number, number, number],
      scale: [0.58 + (index % 3) * 0.06, 0.92 + (index % 2) * 0.13, 0.58 + (index % 3) * 0.06] as [number, number, number],
    }));
    instances(group, "cellar-glass-jars", unitCylinder, glassMat, jarEntries);
    instances(group, "cellar-jar-lids", unitCylinder, metalMat, jarEntries.map(entry => ({ position: [entry.position[0], entry.position[1] + entry.scale[1] * 0.53, entry.position[2]], scale: [entry.scale[0] * 0.88, 0.1, entry.scale[2] * 0.88] })));

    // Doorway — a bowed Queen bay with a deliberately open centre for the full Bloom sculpture owned by the renderer.
    const middleY = FLOOR_Y.middle;
    box(group, "queen-bay-sill", trimMat, [x, middleY + 0.26, -1.55], [4.5, 0.3, 1.62]);
    box(group, "queen-bay-left", metalMat, [x - 2.12, middleY + 1.45, -1.72], [0.1, 2.48, 0.1]);
    box(group, "queen-bay-right", metalMat, [x + 2.12, middleY + 1.45, -1.72], [0.1, 2.48, 0.1]);
    const arch = mesh(group, "queen-bay-arch", halfArch, metalMat, [x, middleY + 2.55, -1.72], [4.25, 4.25, 1], [0, 0, 0]);
    arch.rotation.z = 0;
    box(group, "queen-trellis-upright", metalMat, [x, middleY + 1.38, -1.82], [0.08, 2.3, 0.08]);
    for (const px of [-1.5, -0.75, 0.75, 1.5]) box(group, "queen-trellis-fan", metalMat, [x + px * 0.58, middleY + 1.4, -1.82], [0.045, 2.2, 0.045], [0, 0, px * -0.24]);
    makePot(group, "queen-minion-left", x - 1.75, middleY + 0.42, -0.92, 0.58);
    makePot(group, "queen-minion-right", x + 1.72, middleY + 0.42, -1.03, 0.48);

    // Loft — three physical shelves and a small family of pottery banks.
    const loftY = FLOOR_Y.above;
    makeShelf(group, "loft-ceramic-shelf", x, loftY + 0.28, -1.68, 4.55, 3);
    const ceramicX = [-1.55, -0.78, 0, 0.78, 1.55];
    ceramicX.forEach((dx, index) => {
      const y = loftY + 0.5 + (index % 3) * 0.67;
      mesh(group, `loft-bank-${index}-body`, unitSphere, index % 2 ? accentMat : clayMat, [x + dx, y, -1.38], [0.33, 0.4, 0.29]);
      mesh(group, `loft-bank-${index}-head`, unitSphere, index % 2 ? accentMat : clayMat, [x + dx, y + 0.35, -1.38], [0.26, 0.24, 0.23]);
      mesh(group, `loft-bank-${index}-ear-left`, unitCone, index % 2 ? accentMat : clayMat, [x + dx - 0.14, y + 0.58, -1.38], [0.11, 0.23, 0.1]);
      mesh(group, `loft-bank-${index}-ear-right`, unitCone, index % 2 ? accentMat : clayMat, [x + dx + 0.14, y + 0.58, -1.38], [0.11, 0.23, 0.1]);
    });
  }

  function furnishStudy() {
    const x = WING_X.study;

    // Calendar drawer below: an apothecary cabinet whose open drawer is the month surface.
    const belowY = FLOOR_Y.below;
    box(group, "calendar-cabinet", woodMat, [x, belowY + 1.0, -1.58], [3.85, 1.82, 1.12]);
    for (const row of [0, 1]) for (const column of [-1, 0, 1]) {
      box(group, "calendar-small-drawer", paperMat, [x + column * 1.02, belowY + 0.67 + row * 0.62, -0.98], [0.87, 0.46, 0.12]);
      mesh(group, "calendar-drawer-pull", unitSphere, metalMat, [x + column * 1.02, belowY + 0.67 + row * 0.62, -0.88], [0.08, 0.08, 0.08]);
    }
    box(group, "calendar-pullout", paperMat, [x, belowY + 0.58, 0.18], [3.25, 0.12, 1.78]);
    for (let line = 0; line < 5; line += 1) box(group, "calendar-week-rule", accentMat, [x, belowY + 0.66, -0.45 + line * 0.3], [2.75, 0.014, 0.025]);

    // Books in the middle: a writing desk, real standing volumes and a reading chair.
    const middleY = FLOOR_Y.middle;
    makeTable(group, "study-writing-desk", x - 0.15, middleY, -0.9, 4.1, 1.48);
    makeBooks(group, "study-standing-books", x - 0.65, middleY + 0.95, -1.0, 7);
    makeBooks(group, "study-reference-stack", x + 1.25, middleY + 0.96, -0.9, 3, true);
    box(group, "study-ledger-open-left", paperMat, [x + 0.38, middleY + 1.0, -0.58], [0.92, 0.045, 0.72], [0, 0, 0.08]);
    box(group, "study-ledger-open-right", paperMat, [x + 1.2, middleY + 1.0, -0.58], [0.92, 0.045, 0.72], [0, 0, -0.08]);
    makeChair(group, "study-chair", x, middleY, 0.76, Math.PI);

    // Planner above: a brass rail, clipped cards, pencil cup and a narrow counter.
    const aboveY = FLOOR_Y.above;
    box(group, "planner-counter", woodMat, [x, aboveY + 0.86, -1.3], [4.28, 0.17, 1.08]);
    box(group, "planner-wall-rail", metalMat, [x, aboveY + 2.12, -2.42], [4.35, 0.09, 0.08]);
    for (let card = 0; card < 5; card += 1) {
      const cx = x - 1.65 + card * 0.82;
      box(group, `planner-card-${card}`, card % 2 ? paperMat : wallAltMat, [cx, aboveY + 1.56 + (card % 2) * 0.08, -2.34], [0.64, 0.86, 0.035], [0, 0, (card - 2) * 0.025]);
      mesh(group, `planner-clip-${card}`, unitCylinder, metalMat, [cx, aboveY + 2.12, -2.29], [0.07, 0.08, 0.07], [Math.PI / 2, 0, 0]);
    }
    mesh(group, "planner-pencil-cup", taperedCylinder, clayMat, [x + 1.62, aboveY + 1.12, -1.28], [0.28, 0.48, 0.28]);
    for (const dx of [-0.12, 0, 0.12]) box(group, "planner-pencil", accent2Mat, [x + 1.62 + dx, aboveY + 1.56 + Math.abs(dx), -1.28], [0.035, 0.72, 0.035], [0, 0, dx]);
  }

  function furnishKitchen() {
    const x = WING_X["kitchen-table"];

    // Plan Studio below: a deep pull-out drawer, rolled plans and upright sample boards.
    const belowY = FLOOR_Y.below;
    box(group, "plan-studio-case", darkWoodMat, [x, belowY + 1.02, -1.72], [4.42, 1.9, 0.92]);
    box(group, "plan-studio-drawer", woodMat, [x, belowY + 0.74, -0.28], [3.72, 0.38, 2.15]);
    box(group, "plan-studio-sheet", paperMat, [x, belowY + 0.96, -0.16], [3.18, 0.04, 1.58]);
    for (let roll = 0; roll < 4; roll += 1) mesh(group, `plan-roll-${roll}`, unitCylinder, roll % 2 ? paperMat : wallAltMat, [x - 1.38 + roll * 0.9, belowY + 1.25, -1.36], [0.18, 1.15, 0.18], [Math.PI / 2, 0, 0]);
    for (let rule = 0; rule < 4; rule += 1) box(group, "plan-sheet-rule", accentMat, [x, belowY + 0.99, -0.69 + rule * 0.35], [2.65 - rule * 0.22, 0.016, 0.025]);

    // Conversation middle: the house's broad timber folio table and two benches.
    const middleY = FLOOR_Y.middle;
    makeTable(group, "conversation-table", x, middleY, -0.45, 4.65, 2.22, resolvedTheme === "newfoundland" ? accentMat : woodMat);
    box(group, "conversation-folio-left", paperMat, [x - 0.86, middleY + 0.99, -0.34], [1.65, 0.045, 1.25], [0, 0, 0.075]);
    box(group, "conversation-folio-right", paperMat, [x + 0.86, middleY + 0.99, -0.34], [1.65, 0.045, 1.25], [0, 0, -0.075]);
    box(group, "conversation-folio-spine", metalMat, [x, middleY + 1.04, -0.34], [0.06, 0.065, 1.28]);
    box(group, "conversation-bench-front", darkWoodMat, [x, middleY + 0.48, 1.18], [3.7, 0.24, 0.62]);
    box(group, "conversation-bench-back", darkWoodMat, [x, middleY + 0.48, -1.88], [3.7, 0.24, 0.62]);

    // Journey above: a cabinet-sized atlas with globe, relief islands and a compass rose.
    const aboveY = FLOOR_Y.above;
    makeTable(group, "journey-atlas-table", x, aboveY, -0.78, 4.4, 1.68);
    box(group, "journey-atlas", paperMat, [x, aboveY + 0.98, -0.73], [3.72, 0.04, 1.28]);
    const relief = [[-1.2, 0.1, 0.58], [-0.55, -0.26, 0.38], [0.16, 0.12, 0.62], [0.92, -0.18, 0.46], [1.38, 0.24, 0.3]] as const;
    relief.forEach(([dx, dz, scale], index) => mesh(group, `atlas-relief-${index}`, unitSphere, index % 2 ? accentMat : leafMat, [x + dx, aboveY + 1.08, -0.74 + dz], [scale, 0.06, scale * 0.55]));
    mesh(group, "journey-globe", unitSphere, waterMat, [x + 1.55, aboveY + 1.65, -1.32], [0.48, 0.48, 0.48]);
    mesh(group, "journey-globe-ring", halfArch, metalMat, [x + 1.55, aboveY + 1.65, -1.32], [1.05, 1.05, 1.05], [0, 0, Math.PI / 2]);
    box(group, "journey-globe-stand", metalMat, [x + 1.55, aboveY + 1.16, -1.32], [0.09, 0.68, 0.09]);
  }

  function furnishTogether() {
    const x = WING_X.together;

    // Theatre below: projector, deep screen, memory shelf and reels.
    const belowY = FLOOR_Y.below;
    box(group, "theatre-screen-frame", darkWoodMat, [x, belowY + 1.62, -2.35], [4.45, 2.36, 0.16]);
    box(group, "theatre-screen", paperMat, [x, belowY + 1.62, -2.23], [4.0, 2.02, 0.035]);
    box(group, "theatre-projector-table", woodMat, [x, belowY + 0.55, 0.7], [2.0, 0.15, 1.05]);
    box(group, "theatre-projector", blackMat, [x, belowY + 0.85, 0.45], [0.88, 0.56, 0.84]);
    for (const dx of [-0.25, 0.25]) mesh(group, "theatre-projector-reel", unitCylinder, metalMat, [x + dx, belowY + 1.28, 0.45], [0.34, 0.09, 0.34], [Math.PI / 2, 0, 0]);
    const beam = mesh(group, "theatre-projector-beam", unitCone, glowMat, [x, belowY + 1.22, -0.78], [1.55, 3.4, 1.55], [-Math.PI / 2, 0, 0]);
    moving.push({ object: beam, baseY: beam.position.y, phase: 1.1, amplitude: 0, speed: 1, pulse: 0.045 });
    makeShelf(group, "memory-shelf", x - 1.8, belowY + 0.24, -0.28, 1.4, 3);
    const reels = Array.from({ length: 6 }, (_, index) => ({ position: [x - 2.32 + (index % 3) * 0.52, belowY + 0.52 + Math.floor(index / 3) * 0.72, -0.18] as [number, number, number], scale: [0.25, 0.09, 0.25] as [number, number, number], rotation: [Math.PI / 2, 0, 0] as [number, number, number] }));
    instances(group, "memory-reels", unitCylinder, metalMat, reels);

    // Common room middle: masonry hearth, adjoining pottery bench, letter desk and Hercules.
    const middleY = FLOOR_Y.middle;
    box(group, "common-hearth-surround", wallAltMat, [x - 1.12, middleY + 1.15, -2.12], [2.45, 2.1, 0.72]);
    box(group, "common-hearth-opening", blackMat, [x - 1.12, middleY + 0.78, -1.7], [1.55, 1.18, 0.18]);
    box(group, "common-hearth-mantle", woodMat, [x - 1.12, middleY + 2.18, -1.68], [2.72, 0.22, 0.72]);
    for (let index = 0; index < 3; index += 1) {
      const flame = mesh(group, `common-flame-${index}`, flameGeometry, flameMat, [x - 1.47 + index * 0.35, middleY + 0.72, -1.49], [0.32, 0.78 + index * 0.12, 0.28]);
      moving.push({ object: flame, baseY: flame.position.y, phase: index * 1.7, amplitude: 0.055, speed: 2.2 + index * 0.25, pulse: 0.13 });
    }
    makeTable(group, "pottery-bench", x + 1.48, middleY, -1.18, 2.1, 1.18);
    mesh(group, "pottery-wheel", unitCylinder, metalMat, [x + 1.48, middleY + 1.0, -1.12], [0.52, 0.12, 0.52]);
    mesh(group, "pottery-clay", taperedCylinder, clayMat, [x + 1.48, middleY + 1.25, -1.12], [0.38, 0.48, 0.38]);
    makeTable(group, "letter-writing-desk", x + 1.5, middleY, 0.78, 1.8, 0.82);
    box(group, "letter-paper", paperMat, [x + 1.5, middleY + 0.96, 0.78], [1.22, 0.035, 0.55], [0, 0, -0.06]);
    makeCat(group, x - 1.45, middleY, 0.63);

    // Conservatory above: glazed frame, planting bench and pots for wishes.
    const aboveY = FLOOR_Y.above;
    box(group, "conservatory-bench", woodMat, [x, aboveY + 0.72, -1.25], [4.25, 0.16, 1.05]);
    for (const px of [-2.15, -1.08, 0, 1.08, 2.15]) box(group, "conservatory-frame", metalMat, [x + px, aboveY + 1.56, -2.12], [0.07, 2.45, 0.07]);
    box(group, "conservatory-frame-top", metalMat, [x, aboveY + 2.68, -2.12], [4.48, 0.08, 0.08]);
    const panes = [-1.62, -0.54, 0.54, 1.62].map(dx => ({ position: [x + dx, aboveY + 1.55, -2.19] as [number, number, number], scale: [0.93, 2.1, 0.025] as [number, number, number] }));
    instances(group, "conservatory-glass", unitBox, glassMat, panes);
    [-1.55, -0.52, 0.52, 1.55].forEach((dx, index) => makePot(group, `wish-planter-${index}`, x + dx, aboveY + 0.8, -1.18, 0.7 + (index % 2) * 0.12));
  }

  ROOMS.forEach(makeWingArchitecture);
  makeConnections();
  furnishHome();
  furnishStudy();
  furnishKitchen();
  furnishTogether();

  // A shallow shared base makes the four wings one object instead of four adjacent dioramas.
  box(group, "whole-house-foundation", darkWoodMat, [0, -0.35, 0], [25.0, 0.7, WING_DEPTH + 0.75]);
  if (resolvedTheme === "newfoundland") {
    box(group, "whole-house-wharf", woodMat, [0, -0.74, 1.42], [25.8, 0.18, 2.0]);
    const floats = Array.from({ length: 18 }, (_, index) => ({ position: [-12 + index * 1.4, -0.46 + (index % 2) * 0.08, 2.2] as [number, number, number], scale: [0.16, 0.16, 0.16] as [number, number, number] }));
    instances(group, "outport-floats", unitSphere, accent2Mat, floats);
  }

  const zones = {} as Record<HouseZoneKey, HouseZone>;
  for (const room of ROOMS) for (const level of LEVELS) {
    const x = WING_X[room];
    const y = FLOOR_Y[level] + 1.35;
    const inward = x < 0 ? 0.35 : -0.35;
    zones[`${room}:${level}`] = {
      center: [x, y, -0.28],
      camera: [x + inward, y + 1.05, 10.4],
      phoneCamera: [x + inward * 0.45, y + 0.76, 13.4],
    };
  }

  const anchors: HouseAnchor[] = [
    { id: "queen", zone: "home:middle", position: [WING_X.home, FLOOR_Y.middle + 0.36, -1.04], label: "Queen's bay" },
    { id: "loft-banks", zone: "home:above", position: [WING_X.home, FLOOR_Y.above + 1.36, -1.32], label: "Loft ceramic banks" },
    { id: "cellar-bills", zone: "home:below", position: [WING_X.home, FLOOR_Y.below + 1.3, -1.25], label: "Cellar bills and waterline" },
    { id: "books", zone: "study:middle", position: [WING_X.study - 0.52, FLOOR_Y.middle + 1.08, -0.75], label: "Standing books" },
    { id: "planner", zone: "study:above", position: [WING_X.study, FLOOR_Y.above + 1.56, -1.86], label: "Planner rail" },
    { id: "calendar", zone: "study:below", position: [WING_X.study, FLOOR_Y.below + 0.82, -0.12], label: "Calendar drawer" },
    { id: "journey", zone: "kitchen-table:above", position: [WING_X["kitchen-table"], FLOOR_Y.above + 1.16, -0.6], label: "Journey atlas" },
    { id: "conversation", zone: "kitchen-table:middle", position: [WING_X["kitchen-table"], FLOOR_Y.middle + 1.06, -0.3], label: "One Conversation folio" },
    { id: "plan-studio", zone: "kitchen-table:below", position: [WING_X["kitchen-table"], FLOOR_Y.below + 1.0, -0.1], label: "Plan Studio drawer" },
    { id: "wishes", zone: "together:above", position: [WING_X.together, FLOOR_Y.above + 1.22, -1.05], label: "Conservatory wishes" },
    { id: "pottery", zone: "together:middle", position: [WING_X.together + 1.48, FLOOR_Y.middle + 1.15, -1.05], label: "Pottery bench" },
    { id: "memories", zone: "together:below", position: [WING_X.together - 1.8, FLOOR_Y.below + 1.18, -0.18], label: "Memory shelf" },
    { id: "letters", zone: "together:middle", position: [WING_X.together + 1.5, FLOOR_Y.middle + 1.02, 0.72], label: "Letter desk" },
    { id: "projector", zone: "together:below", position: [WING_X.together, FLOOR_Y.below + 1.02, 0.34], label: "Theatre projector" },
    { id: "hercules", zone: "together:middle", position: [WING_X.together - 1.45, FLOOR_Y.middle, 0.63], label: "Hercules by the hearth" },
    ...ROOMS.map((room): HouseAnchor => ({
      id: `door-${room}`,
      zone: `${room}:middle`,
      position: [WING_X[room], FLOOR_Y.middle + 0.05, WING_DEPTH / 2 + 0.12],
      label: `${room === "kitchen-table" ? "Kitchen Table" : room[0]!.toUpperCase() + room.slice(1)} threshold`,
    })),
  ];

  for (const anchor of anchors) {
    const marker = new THREE.Object3D();
    marker.name = `anchor-${anchor.id}`;
    marker.position.set(...anchor.position);
    marker.userData.zone = anchor.zone;
    marker.userData.label = anchor.label;
    group.add(marker);
  }

  const focusDistance: Record<string, number> = {
    queen: 6.8,
    "loft-banks": 5.8,
    "cellar-bills": 5.9,
    books: 4.8,
    planner: 5.1,
    calendar: 5.2,
    journey: 6.1,
    conversation: 6.3,
    "plan-studio": 5.8,
    wishes: 5.7,
    pottery: 4.1,
    memories: 4.4,
    letters: 3.8,
    projector: 4.5,
    hercules: 3.5,
  };
  const focus = Object.fromEntries(anchors.map((anchor): [string, HouseFocus] => {
    const [x, y, z] = anchor.position;
    if (anchor.id === "pottery") return [anchor.id, {
      center: [x, y + 0.05, z],
      camera: [x + 0.42, y + 1.15, z + 6.8],
      phoneCamera: [x + 0.2, y + 0.85, z + 5.6],
    }];
    const distance = focusDistance[anchor.id] ?? 5.5;
    const center: [number, number, number] = [x, y + (anchor.id.startsWith("door-") ? 1.05 : 0.72), z];
    return [anchor.id, {
      center,
      camera: [x + 0.42, center[1] + 0.68, z + distance + 1.35],
      phoneCamera: [x + 0.28, center[1] + 0.45, z + distance],
    }];
  })) as Record<string, HouseFocus>;

  group.traverse(object => {
    object.frustumCulled = true;
  });
  for (const part of moving) {
    part.baseScaleX = part.object.scale.x;
    part.baseScaleZ = part.object.scale.z;
  }

  return {
    group,
    zones,
    anchors,
    focus,
    animate(time: number) {
      if (disposed || !Number.isFinite(time)) return;
      for (const part of moving) {
        const wave = Math.sin(time * part.speed + part.phase);
        part.object.position.y = part.baseY + wave * part.amplitude;
        if (part.pulse) {
          const pulse = 1 + wave * part.pulse;
          part.object.scale.x = (part.baseScaleX ?? 1) * pulse;
          part.object.scale.z = (part.baseScaleZ ?? 1) * pulse;
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      group.clear();
      geometries.clear();
      materials.clear();
      moving.length = 0;
    },
  };
}
