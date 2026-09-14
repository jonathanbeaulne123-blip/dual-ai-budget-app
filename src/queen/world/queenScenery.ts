import * as THREE from "three";

/**
 * The world she sits in. Household Home resolves to exactly three scenes —
 * Classic's kitchen table, Taylor's *Lover* and Newfoundland's *Jellybean
 * Row* — and each one is a real place here rather than a field of nothing:
 * a cotton-candy cloud world, the coloured row above the harbour, and a home
 * office full of plants and coffee.
 *
 * Three rules hold all three together.
 *
 * **Depth is three layers, never a backdrop.** A distance (sky or wall), a
 * middle (the thing you came to see), and a near layer at the bottom edge that
 * the camera looks past. The near layer is what turns a picture into a place,
 * and it is kept below her chin so it never covers a reading.
 *
 * **She is the subject.** Everything here is `frustumCulled`, unlit-simple and
 * deliberately low contrast against her: the scenery carries no state, no
 * money and no text, and nothing in it is interactive. If the eye lands on the
 * scenery before it lands on her, the scenery is wrong.
 *
 * **Motion is ambient and it is optional.** `tick` moves the world on a clock
 * and returns whether anything actually moved; the caller runs it only while
 * the page is visible and motion is welcome. Under `prefers-reduced-motion`,
 * a paused atmosphere or a hidden tab it is never called, and every world is
 * built at a resting pose that reads correctly as one still frame.
 *
 * Authored in world units with the floor at y = 0, which the caller parks at
 * her feet. No money is read here.
 */
export type QueenSceneryKind = "clouds" | "row" | "office";

/** Which world a shared-home scene opens into, or null for a scene that has none. */
export function queenSceneryKind(sceneId: string | null | undefined): QueenSceneryKind | null {
  return sceneId === "lover" ? "clouds" : sceneId === "jellybean" ? "row" : sceneId === "classic-home" ? "office" : null;
}

export type QueenSceneryOptions = {
  reducedMotion?: boolean;
  /** The scene's own paper. The sky fades into it at the horizon so the canvas has no visible edge. */
  paper?: string;
};

/** The six painted colours the flat Jellybean Row has always used. Kept in step with `SceneArtwork`'s row. */
export const JELLYBEAN_COLOURS = ["#c8675b", "#5f908c", "#d4a24f", "#817caa", "#60828d", "#b86573"] as const;

/** A small deterministic source, so a world looks the same every mount and a screenshot is a screenshot. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

/** A vertical gradient on a plane: the cheapest honest sky, and the only texture any of these worlds needs. */
function gradientTexture(stops: readonly (readonly [number, string])[]): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const fill = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [at, color] of stops) fill.addColorStop(at, color);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createQueenScenery(kind: QueenSceneryKind, options: QueenSceneryOptions = {}) {
  const group = new THREE.Group();
  group.name = `queen-scenery-${kind}`;
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  let disposed = false;
  const geo = <G extends THREE.BufferGeometry>(g: G): G => { geometries.add(g); return g; };
  const mat = <M extends THREE.Material>(m: M): M => { materials.add(m); return m; };
  const tex = <T extends THREE.Texture>(t: T): T => { textures.add(t); return t; };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, name: string) => {
    const object = new THREE.Mesh(geo(g), m);
    object.name = name;
    parent.add(object);
    return object;
  };
  /** The far plane every world stands in front of: one gradient, drawn first, never lit. */
  const backdrop = (given: readonly (readonly [number, string])[], width: number, height: number, z: number) => {
    // The last stop is the page's own paper when the caller knows it, so the sky
    // reaches the bottom of the canvas as the same colour the page continues in.
    const stops = options.paper ? [...given.slice(0, -1), [given[given.length - 1]![0], options.paper] as const] : given;
    const texture = gradientTexture(stops);
    const material = mat(texture
      ? new THREE.MeshBasicMaterial({ map: tex(texture), depthWrite: false, toneMapped: false })
      : new THREE.MeshBasicMaterial({ color: stops[stops.length - 1]![1], depthWrite: false, toneMapped: false }));
    const plane = mesh(new THREE.PlaneGeometry(width, height), material, group, "queen-scenery-backdrop");
    plane.position.set(0, height / 2 - 4, z);
    plane.renderOrder = -10;
    return plane;
  };

  /** Everything a `tick` moves, in one list, so a world that adds motion cannot forget to declare it. */
  const drifting: { object: THREE.Object3D; speed: number; span: number; bob: number; phase: number }[] = [];
  const swaying: { object: THREE.Object3D; amount: number; speed: number; phase: number; rest: number }[] = [];
  const steaming: { object: THREE.Object3D; rise: number; from: number; phase: number; x: number; material: THREE.Material & { opacity: number } }[] = [];
  let flyer: { object: THREE.Object3D; speed: number; span: number } | null = null;

  // ---------------------------------------------------------------------
  if (kind === "clouds") {
    // *Lover* — a cotton-candy cloud world. She sits in it, not in front of it:
    // banks behind her, banks below the floor line, and the sky reading pink to
    // periwinkle the way the record's own sky does.
    backdrop([[0, "#a8c6f2"], [0.34, "#dcc0ea"], [0.62, "#f7bfd6"], [0.86, "#fcd9e3"], [1, "#f7eef1"]], 90, 52, -30);
    const puff = geo(new THREE.SphereGeometry(1, 14, 10));
    // Candy, not weather: saturated enough to read as spun sugar, and each tone lit from inside so the shading never turns them grey.
    const tones = ["#ffd7e6", "#ffbcd6", "#f3bde4", "#cfc4f2", "#b9d2f7"] as const;
    const cloudMats = tones.map((color) => mat(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.42, roughness: 1, metalness: 0 })));
    const random = rng(0x10ce);
    /** One cloud: a handful of flattened spheres that read as a single soft mass from the one angle the camera has. */
    const cloud = (x: number, y: number, z: number, size: number, tone: number) => {
      const bank = new THREE.Group();
      bank.name = "queen-cloud";
      bank.position.set(x, y, z);
      const lobes = 5 + Math.floor(random() * 4);
      for (let i = 0; i < lobes; i += 1) {
        const lobe = new THREE.Mesh(puff, cloudMats[(tone + (i % 2)) % cloudMats.length]!);
        lobe.position.set((i - lobes / 2) * size * 0.58 + (random() - 0.5) * size * 0.3, (random() - 0.5) * size * 0.34, (random() - 0.5) * size * 0.5);
        const k = size * (0.62 + random() * 0.5);
        lobe.scale.set(k, k * (0.56 + random() * 0.2), k * 0.86);
        bank.add(lobe);
      }
      group.add(bank);
      return bank;
    };
    // Distance: a soft band far above and behind her head, small enough to read as distance.
    for (let i = 0; i < 6; i += 1) cloud(-22 + i * 8.5 + random() * 3, 7.4 + random() * 3, -25 - random() * 6, 1.6 + random() * 0.9, i % tones.length);
    // Middle: the banks she sits among, kept well off her centre so her face is never behind one.
    for (const [x, y, z, size, tone] of [[-9.6, 3.4, -12, 2.4, 1], [10.2, 4.2, -13, 2.6, 2], [-13.5, 1.4, -9, 1.9, 0], [13.4, 1.9, -10, 2.1, 3]] as const) {
      drifting.push({ object: cloud(x, y, z, size, tone), speed: 0.05 + random() * 0.05, span: 30, bob: 0.12 + random() * 0.1, phase: random() * 6.28 });
    }
    // The bank she is standing on, directly under her and low enough never to reach her hem.
    drifting.push({ object: cloud(0, -1.5, -1.2, 2.6, 0), speed: 0.02, span: 40, bob: 0.07, phase: 2.1 });
    // Near: the bank she is standing in. It laps at her hem — this is the layer that makes it a world rather than a wallpaper.
    for (const [x, z, size, tone] of [[-5.4, 4.4, 2.1, 0], [5.2, 5.2, 2.3, 1], [0.2, 7.4, 2.7, 4], [-11.4, 3.2, 1.9, 3], [11.6, 3.8, 2, 2]] as const) {
      const bank = cloud(x, -0.85 - size * 0.12, z, size, tone);
      drifting.push({ object: bank, speed: 0.03 + random() * 0.04, span: 34, bob: 0.13, phase: random() * 6.28 });
    }
    // A handful of drifting motes, because a cloud world with nothing in the air between the banks reads as a wallpaper.
    const moteMat = mat(new THREE.MeshBasicMaterial({ color: "#fff6fa", transparent: true, opacity: 0.75, depthWrite: false }));
    const moteGeo = geo(new THREE.SphereGeometry(0.055, 6, 5));
    const motes = new THREE.InstancedMesh(moteGeo, moteMat, 26);
    motes.name = "queen-cloud-motes";
    motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const seat = new THREE.Object3D();
    for (let i = 0; i < 26; i += 1) {
      seat.position.set(-13 + random() * 26, -1 + random() * 7, -6 + random() * 9);
      seat.updateMatrix();
      motes.setMatrixAt(i, seat.matrix);
    }
    group.add(motes);
    drifting.push({ object: motes, speed: 0.09, span: 26, bob: 0.3, phase: 0 });
  }

  // ---------------------------------------------------------------------
  if (kind === "row") {
    // *Jellybean Row* — held to what the harbour page does well: three real
    // layers of depth, the Atlantic's overcast light, and enough drawn in it
    // that it reads as a street rather than a motif.
    backdrop([[0, "#93b3c6"], [0.4, "#c2d4d9"], [0.7, "#dde8e2"], [1, "#eef3ec"]], 100, 58, -46);
    const random = rng(0x1e11);
    const box = geo(new THREE.BoxGeometry(1, 1, 1));
    const roofGeo = geo(new THREE.ConeGeometry(0.78, 0.5, 4));
    const paneMat = mat(new THREE.MeshStandardMaterial({ color: "#fff1c4", emissive: "#f3d68a", emissiveIntensity: 0.45, roughness: 0.5 }));
    const trimMat = mat(new THREE.MeshStandardMaterial({ color: "#fbf6ea", roughness: 0.85 }));
    const roofMat = mat(new THREE.MeshStandardMaterial({ color: "#4b5a60", roughness: 0.95 }));
    const houseMats = JELLYBEAN_COLOURS.map((color) => mat(new THREE.MeshStandardMaterial({ color, roughness: 0.86 })));

    // Distance: the harbour, off past the end of the row where the street falls away — the row reads as standing *above* something.
    // The harbour: a standing band behind the row, seen in the gaps between houses.
    // A level camera cannot look *down* on water, so the depth is bought by
    // stacking bands rather than by tilting the world.
    const water = mesh(new THREE.PlaneGeometry(120, 3.2), mat(new THREE.MeshStandardMaterial({ color: "#6d8c9c", roughness: 0.26, metalness: 0.12 })), group, "queen-row-water");
    water.position.set(0, 2.6, -44);
    const farShore = mesh(new THREE.PlaneGeometry(120, 4.6), mat(new THREE.MeshStandardMaterial({ color: "#7c8a83", roughness: 1 })), group, "queen-row-shore");
    farShore.position.set(0, 6.4, -45);
    const hull = mesh(new THREE.BoxGeometry(2.6, 0.62, 0.9), mat(new THREE.MeshStandardMaterial({ color: "#c2452f", roughness: 0.8 })), group, "queen-row-boat");
    hull.position.set(-16, 2.7, -43);
    const cabin = mesh(box, trimMat, group, "queen-row-boat-cabin");
    cabin.scale.set(0.9, 0.8, 0.7);
    cabin.position.set(-15.7, 3.3, -43);

    /** One row house: a painted box with a pitched roof, two lit windows, a door and clapboard shadow. */
    const house = (x: number, y: number, z: number, w: number, h: number, tone: number) => {
      const home = new THREE.Group();
      home.name = "queen-row-house";
      home.position.set(x, y, z);
      const wall = new THREE.Mesh(box, houseMats[tone % houseMats.length]!);
      wall.scale.set(w, h, w * 0.9);
      wall.position.y = h / 2;
      home.add(wall);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.scale.set(w * 1.02, h * 0.1 / 0.5, w * 1.02);
      roof.position.y = h + h * 0.05;
      roof.rotation.y = Math.PI / 4;
      home.add(roof);
      for (const wy of [h * 0.78, h * 0.5] as const) for (const wx of [-w * 0.25, w * 0.25] as const) {
        const pane = new THREE.Mesh(box, paneMat);
        pane.scale.set(w * 0.2, h * 0.15, 0.06);
        pane.position.set(wx, wy, w * 0.46);
        home.add(pane);
      }
      // The painted door is the whole point of the street: it never matches the wall.
      const door = new THREE.Mesh(box, houseMats[(tone + 3) % houseMats.length]!);
      door.scale.set(w * 0.22, h * 0.24, 0.08);
      door.position.set(0, h * 0.12, w * 0.47);
      home.add(door);
      const chimney = new THREE.Mesh(box, trimMat);
      chimney.scale.set(w * 0.16, h * 0.16, w * 0.16);
      chimney.position.set(-w * 0.26, h + h * 0.1, 0);
      home.add(chimney);
      const step = new THREE.Mesh(box, trimMat);
      step.scale.set(w * 0.3, h * 0.03, 0.3);
      step.position.set(0, h * 0.015, w * 0.55);
      home.add(step);
      group.add(home);
      return home;
    };
    // Middle: the row itself, well back so it reads as a street behind her rather than a wall over her,
    // stepping up the hill the way the real one does and running off both edges.
    for (let i = 0; i < 15; i += 1) {
      const w = 2.4 + random() * 0.7;
      house(-26 + i * 3.5, 0.5 + i * 0.42, -34 - random() * 2, w, 3.2 + random() * 1.1, i % 6);
    }
    // The street she is standing on, and the low wall that holds the hill up behind her.
    const street = mesh(new THREE.PlaneGeometry(120, 60), mat(new THREE.MeshStandardMaterial({ color: "#8e9890", roughness: 1 })), group, "queen-row-street");
    street.rotation.x = -Math.PI / 2;
    street.position.set(0, -0.02, -16);
    const wall = mesh(box, mat(new THREE.MeshStandardMaterial({ color: "#7a8279", roughness: 1 })), group, "queen-row-wall");
    wall.scale.set(120, 1.4, 1);
    wall.position.set(0, 0.7, -30);

    // The pavement she is standing on, and the road beyond it: the street has to be
    // two surfaces or the lower half of the frame is one grey slab.
    const pavement = mesh(new THREE.PlaneGeometry(120, 7), mat(new THREE.MeshStandardMaterial({ color: "#a5ada3", roughness: 1 })), group, "queen-row-pavement");
    pavement.rotation.x = -Math.PI / 2;
    pavement.position.set(0, 0.012, -1.4);
    const kerbLine = mesh(new THREE.PlaneGeometry(120, 0.22), mat(new THREE.MeshStandardMaterial({ color: "#c6ccc0", roughness: 1 })), group, "queen-row-kerb-line");
    kerbLine.rotation.x = -Math.PI / 2;
    kerbLine.position.set(0, 0.02, -4.9);

    // Near: the kerb at the very front and two bollards at the edges of the frame.
    // A level camera cannot look down, so the near layer has to be things that
    // stand *up* from the ground close to the lens — the harbour page's pilings,
    // not a railing floating below the floor.
    const railMat = mat(new THREE.MeshStandardMaterial({ color: "#4a5a60", roughness: 0.7, metalness: 0.2 }));
    const kerb = mesh(box, mat(new THREE.MeshStandardMaterial({ color: "#b9bfb4", roughness: 1 })), group, "queen-row-kerb");
    kerb.scale.set(60, 0.34, 0.5);
    kerb.position.set(0, 0.17, 2.2);
    for (const x of [-3.7, 3.7] as const) {
      const bollard = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.7, 10), railMat, group, "queen-row-bollard");
      bollard.position.set(x, 0.35, 1.6);
      const cap = mesh(new THREE.SphereGeometry(0.11, 10, 8), railMat, group, "queen-row-bollard-cap");
      cap.position.set(x, 0.7, 1.6);
    }
    // The lamp post: on frame at the left edge, its head inside the frame rather than somewhere above it.
    const lampPost = mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.3, 8), railMat, group, "queen-row-lamp");
    lampPost.position.set(-4.9, 1.65, -3.4);
    const lampArm = mesh(new THREE.BoxGeometry(0.6, 0.07, 0.07), railMat, group, "queen-row-lamp-arm");
    lampArm.position.set(-4.6, 3.28, -3.4);
    const lampHead = mesh(new THREE.SphereGeometry(0.24, 12, 9), mat(new THREE.MeshStandardMaterial({ color: "#ffeec0", emissive: "#f4cf7e", emissiveIntensity: 0.9, roughness: 0.4 })), group, "queen-row-lamp-head");
    lampHead.position.set(-4.32, 3.18, -3.4);

    // Ambient: a gull crossing, and the harbour never being flat.
    const gull = new THREE.Group();
    gull.name = "queen-row-gull";
    const gullMat = mat(new THREE.MeshStandardMaterial({ color: "#fdfbf4", roughness: 0.9, side: THREE.DoubleSide }));
    for (const side of [-1, 1]) {
      const wing = mesh(new THREE.PlaneGeometry(0.9, 0.22), gullMat, gull, "queen-row-gull-wing");
      wing.position.set(side * 0.45, 0, 0);
      wing.rotation.z = side * 0.32;
    }
    gull.position.set(-20, 9.2, -24);
    group.add(gull);
    flyer = { object: gull, speed: 1.7, span: 46 };
    swaying.push({ object: gull, amount: 0.22, speed: 1.7, phase: 0, rest: 9.2 });
    drifting.push({ object: hull, speed: 0.05, span: 8, bob: 0.07, phase: 1.2 });
    drifting.push({ object: cabin, speed: 0.05, span: 8, bob: 0.07, phase: 1.2 });
  }

  // ---------------------------------------------------------------------
  if (kind === "office") {
    // Classic Hearth's shared home: a home office with a great many plants and
    // a cup of coffee going. She is a ceramic cat on the desk, so she is large
    // beside a mug and that is the right reading.
    backdrop([[0, "#efe4d2"], [0.55, "#e7dbc8"], [1, "#dccfba"]], 64, 40, -22);
    const random = rng(0xc0ffee);
    const box = geo(new THREE.BoxGeometry(1, 1, 1));

    // Distance: the wall, and the window the whole room is lit by.
    const glass = gradientTexture([[0, "#cfe3ef"], [0.52, "#e8f0e2"], [0.72, "#bcd0a8"], [1, "#9cb98c"]]);
    const pane = mesh(new THREE.PlaneGeometry(11, 8), mat(glass
      ? new THREE.MeshBasicMaterial({ map: tex(glass), toneMapped: false })
      : new THREE.MeshBasicMaterial({ color: "#fdf4dd", toneMapped: false })), group, "queen-office-window");
    pane.position.set(-0.4, 5.6, -13.6);
    const frameMat = mat(new THREE.MeshStandardMaterial({ color: "#6f5946", roughness: 0.8 }));
    for (const [x, y, w, h] of [[-0.4, 9.7, 11.6, 0.4], [-0.4, 1.5, 11.6, 0.4], [-6.1, 5.6, 0.4, 8.4], [5.3, 5.6, 0.4, 8.4], [-0.4, 5.6, 0.22, 8.4]] as const) {
      const bar = mesh(box, frameMat, group, "queen-office-frame");
      bar.scale.set(w, h, 0.3);
      bar.position.set(x, y, -13.4);
    }
    // The beam the window throws across the desk: the room's one piece of drama, and where the motes live.
    const beamMat = mat(new THREE.MeshBasicMaterial({ color: "#fff2cf", transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    const beam = mesh(new THREE.PlaneGeometry(9, 17), beamMat, group, "queen-office-beam");
    beam.position.set(-1.4, 3.4, -7);
    beam.rotation.set(-0.5, 0.12, 0.1);

    // The desk she is sitting on, running off both edges, and the shelf above it.
    const woodMat = mat(new THREE.MeshStandardMaterial({ color: "#9a7350", roughness: 0.66 }));
    const desk = mesh(box, woodMat, group, "queen-office-desk");
    desk.scale.set(40, 0.5, 9);
    desk.position.set(0, -0.25, -1.2);
    const shelf = mesh(box, woodMat, group, "queen-office-shelf");
    shelf.scale.set(26, 0.3, 1.6);
    shelf.position.set(0, 6.6, -12.2);

    // Plants: a great many, in three sizes, so the room is green before it is anything else.
    const leafMats = ["#3f7a45", "#2f5f3a", "#57924f", "#4a8158"].map((color) => mat(new THREE.MeshStandardMaterial({ color, roughness: 0.62, side: THREE.DoubleSide })));
    const potMats = ["#b4744f", "#c8a06f", "#8d9b8a", "#c9c2b4"].map((color) => mat(new THREE.MeshStandardMaterial({ color, roughness: 0.85 })));
    const potGeo = geo(new THREE.CylinderGeometry(0.52, 0.38, 0.8, 12));
    const leafGeo = geo(new THREE.SphereGeometry(0.5, 10, 7));
    const stemGeo = geo(new THREE.CylinderGeometry(0.035, 0.045, 1, 6));
    /** One plant: a pot, and a spray of leaves on stems that the ambient sway can move as one. */
    const plant = (x: number, y: number, z: number, size: number, leaves: number) => {
      const pot = new THREE.Group();
      pot.name = "queen-office-plant";
      pot.position.set(x, y, z);
      pot.scale.setScalar(size);
      const vessel = new THREE.Mesh(potGeo, potMats[Math.floor(random() * potMats.length)]!);
      vessel.position.y = 0.4;
      pot.add(vessel);
      const crown = new THREE.Group();
      crown.position.y = 0.8;
      for (let i = 0; i < leaves; i += 1) {
        const angle = (i / leaves) * Math.PI * 2 + random() * 0.5;
        const lean = 0.35 + random() * 0.55;
        const length = 0.9 + random() * 0.9;
        const stem = new THREE.Mesh(stemGeo, leafMats[1]!);
        stem.scale.y = length;
        stem.position.set(Math.cos(angle) * lean * 0.3, length / 2, Math.sin(angle) * lean * 0.3);
        stem.rotation.z = -Math.cos(angle) * lean * 0.5;
        stem.rotation.x = Math.sin(angle) * lean * 0.5;
        crown.add(stem);
        const blade = new THREE.Mesh(leafGeo, leafMats[Math.floor(random() * leafMats.length)]!);
        blade.position.set(Math.cos(angle) * (lean * 0.6 + length * 0.5), length, Math.sin(angle) * (lean * 0.6 + length * 0.5));
        blade.scale.set(0.85 + random() * 0.5, 0.13, 1.5 + random() * 0.9);
        blade.rotation.y = -angle;
        blade.rotation.z = -0.3 - random() * 0.3;
        crown.add(blade);
      }
      pot.add(crown);
      swaying.push({ object: crown, amount: 0.035 + random() * 0.03, speed: 0.5 + random() * 0.4, phase: random() * 6.28, rest: 0 });
      group.add(pot);
      return pot;
    };
    /** A snake plant: upright blades, no pot crown. The one silhouette a spray of leaves cannot give you. */
    const blades = (x: number, y: number, z: number, size: number) => {
      const pot = new THREE.Group();
      pot.name = "queen-office-blades";
      pot.position.set(x, y, z);
      pot.scale.setScalar(size);
      const vessel = new THREE.Mesh(potGeo, potMats[2]!);
      vessel.position.y = 0.4;
      pot.add(vessel);
      const crown = new THREE.Group();
      crown.position.y = 0.7;
      for (let i = 0; i < 7; i += 1) {
        const blade = new THREE.Mesh(leafGeo, leafMats[i % 2 ? 1 : 0]!);
        const tall = 1.5 + random() * 1.1;
        blade.scale.set(0.3, tall, 0.1);
        blade.position.set((random() - 0.5) * 0.5, tall * 0.5, (random() - 0.5) * 0.4);
        blade.rotation.z = (random() - 0.5) * 0.5;
        crown.add(blade);
      }
      pot.add(crown);
      swaying.push({ object: crown, amount: 0.022, speed: 0.42 + random() * 0.3, phase: random() * 6.28, rest: 0 });
      group.add(pot);
    };
    // On the desk beside her — small, because they are desk plants and she is a bank.
    for (const [x, z, size, leaves] of [[-4.9, -2.4, 0.52, 8], [4.6, -2.7, 0.46, 7], [-2.9, -3.4, 0.34, 6], [3.2, -3.5, 0.38, 6], [6.8, -2.2, 0.34, 6], [-7, -2.6, 0.4, 7]] as const) plant(x, 0, z, size, leaves);
    blades(-6.1, 0, -3.2, 0.44);
    blades(5.9, 0, -3.3, 0.4);
    // Along the shelf, and on the floor either side where a big one has room.
    for (const [x, size] of [[-9.5, 0.5], [-5.4, 0.44], [0.6, 0.48], [5.8, 0.45], [9.8, 0.52]] as const) plant(x, 6.75, -12.2, size, 7);
    for (const [x, z, size] of [[-12.4, -1.2, 1.5], [12.2, -1.4, 1.35], [-15.4, 1.2, 1.15], [15.2, 0.8, 1.25]] as const) plant(x, -4.6, z, size, 11);
    blades(-14, -4.6, -0.4, 1.5);
    blades(13.8, -4.6, -0.6, 1.35);

    // Trailing pothos off the shelf: the thing that makes a room read as lived in rather than styled.
    for (const [x, drop] of [[-7.6, 3.4], [3.1, 4.2], [8.4, 2.8]] as const) {
      const vine = new THREE.Group();
      vine.name = "queen-office-trailer";
      vine.position.set(x, 6.5, -12);
      for (let i = 0; i < 7; i += 1) {
        const t = (i + 1) / 7;
        const blade = mesh(leafGeo, leafMats[i % leafMats.length]!, vine, "queen-office-trailer-leaf");
        blade.position.set(Math.sin(i * 1.7) * 0.42, -t * drop, Math.cos(i * 1.3) * 0.2);
        blade.scale.set(0.5, 0.1, 0.7);
        blade.rotation.z = Math.sin(i) * 0.5;
      }
      swaying.push({ object: vine, amount: 0.05, speed: 0.4 + random() * 0.2, phase: random() * 6.28, rest: 0 });
      group.add(vine);
    }

    // The coffee, beside her, still going.
    const MUG = { x: 2.35, z: 1.7 };
    const china = mat(new THREE.MeshStandardMaterial({ color: "#f4efe2", roughness: 0.36, metalness: 0.02 }));
    const mug = mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.52, 18), china, group, "queen-office-mug");
    mug.position.set(MUG.x, 0.26, MUG.z);
    const handle = mesh(new THREE.TorusGeometry(0.15, 0.042, 8, 20), china, mug, "queen-office-mug-handle");
    handle.position.set(0.3, 0.02, 0);
    handle.rotation.set(0, Math.PI / 2, 0);
    const brew = mesh(new THREE.CircleGeometry(0.3, 18), mat(new THREE.MeshStandardMaterial({ color: "#4a2d1c", roughness: 0.25 })), group, "queen-office-brew");
    brew.rotation.x = -Math.PI / 2;
    brew.position.set(MUG.x, 0.515, MUG.z);
    const steamGeo = geo(new THREE.SphereGeometry(0.12, 8, 6));
    for (let i = 0; i < 5; i += 1) {
      const material = mat(new THREE.MeshBasicMaterial({ color: "#fffaf0", transparent: true, opacity: 0, depthWrite: false }));
      const puff = mesh(steamGeo, material, group, "queen-office-steam");
      puff.position.set(MUG.x, 0.55, MUG.z);
      steaming.push({ object: puff, rise: 1.25, from: 0.55, phase: i / 5, material, x: MUG.x });
    }
    // A notebook and a pen at the near edge, the layer the camera looks past.
    const book = mesh(box, mat(new THREE.MeshStandardMaterial({ color: "#efe7d6", roughness: 0.92 })), group, "queen-office-book");
    book.scale.set(2, 0.13, 1.42);
    book.position.set(-2.9, 0.065, 2.3);
    book.rotation.y = 0.18;
    const cover = mesh(box, mat(new THREE.MeshStandardMaterial({ color: "#7d8b76", roughness: 0.9 })), group, "queen-office-book-cover");
    cover.scale.set(2.04, 0.05, 1.46);
    cover.position.set(-2.9, 0.025, 2.3);
    cover.rotation.y = 0.18;
    const pen = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), mat(new THREE.MeshStandardMaterial({ color: "#8a3b2d", roughness: 0.5 })), group, "queen-office-pen");
    pen.rotation.set(Math.PI / 2, 0, 0.55);
    pen.position.set(-2.3, 0.17, 2.8);
    // Dust in the beam: the room's only fast motion, and it is nearly invisible.
    const dustMat = mat(new THREE.MeshBasicMaterial({ color: "#fff5da", transparent: true, opacity: 0.55, depthWrite: false }));
    const dust = new THREE.InstancedMesh(geo(new THREE.SphereGeometry(0.035, 5, 4)), dustMat, 22);
    dust.name = "queen-office-dust";
    dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const seat = new THREE.Object3D();
    for (let i = 0; i < 22; i += 1) {
      seat.position.set(-5 + random() * 8, 0.4 + random() * 6, -6 + random() * 7);
      seat.updateMatrix();
      dust.setMatrixAt(i, seat.matrix);
    }
    group.add(dust);
    drifting.push({ object: dust, speed: 0.05, span: 9, bob: 0.5, phase: 0 });
  }

  for (const object of group.children) object.frustumCulled = true;
  /** Where every moving thing rests, captured once: `tick` is a pure function of the clock, never of the last frame. */
  const restX = drifting.map((row) => row.object.position.x);
  const restY = drifting.map((row) => row.object.position.y);
  const flyerRest = flyer ? (flyer as { object: THREE.Object3D }).object.position.x : 0;

  return {
    group,
    kind,
    get disposed() { return disposed; },
    /** Whether this world has anything to animate at all. A world with none never asks for a frame. */
    get animated() { return !options.reducedMotion && (drifting.length > 0 || swaying.length > 0 || steaming.length > 0 || flyer !== null); },
    counts() { return { geometries: geometries.size, materials: materials.size, textures: textures.size, moving: drifting.length + swaying.length + steaming.length + (flyer ? 1 : 0) }; },
    /**
     * Move the world to where it stands at `seconds`. Returns whether anything
     * moved, so the caller can stop asking for frames. Pure function of the
     * clock: the same second always gives the same frame.
     */
    tick(seconds: number): boolean {
      if (disposed || options.reducedMotion) return false;
      for (const [index, row] of drifting.entries()) {
        const span = row.span;
        const travelled = (((restX[index]! + seconds * row.speed + span / 2) % span) + span) % span;
        row.object.position.x = travelled - span / 2;
        row.object.position.y = restY[index]! + Math.sin(seconds * 0.45 + row.phase) * row.bob;
      }
      for (const row of swaying) {
        row.object.rotation.z = Math.sin(seconds * row.speed + row.phase) * row.amount;
        if (row.rest) row.object.position.y = row.rest + Math.sin(seconds * row.speed * 0.7 + row.phase) * 0.35;
      }
      for (const row of steaming) {
        const t = (seconds * 0.42 + row.phase) % 1;
        row.object.position.y = row.from + t * row.rise;
        row.object.position.x = row.x + Math.sin(t * 4 + row.phase * 6) * 0.18;
        row.object.scale.setScalar(0.45 + t * 1.3);
        row.material.opacity = Math.max(0, Math.sin(t * Math.PI)) * 0.34;
      }
      if (flyer) {
        const travelled = (flyerRest + seconds * flyer.speed + flyer.span / 2) % flyer.span;
        flyer.object.position.x = travelled - flyer.span / 2;
      }
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      geometries.clear(); materials.clear(); textures.clear();
      drifting.length = 0; swaying.length = 0; steaming.length = 0; flyer = null;
    },
  };
}
export type QueenScenery = ReturnType<typeof createQueenScenery>;
