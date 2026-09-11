/** Claude's bounded prop study, reviewed and rebuilt by Codex: smooth profile,
 * visible front compartment, inset coin slot, owned resources and no money props. */
import * as THREE from "three";
export function createKittySculpture({
  glaze,
  brass,
  wood,
}: {
  glaze: string;
  brass: string;
  wood: string;
}) {
  const group = new THREE.Group();
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  const material = (color: string, roughness: number, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(m);
    return m;
  };
  const ceramic = new THREE.MeshPhysicalMaterial({
    color: glaze,
    roughness: 0.25,
    metalness: 0.025,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
  });
  materials.add(ceramic);
  const metal = material(brass, 0.32, 0.72),
    walnut = material(wood, 0.7),
    ink = material("#302b29", 0.8),
    paper = material("#f0dfbc", 0.8),
    velvet = material("#614837", 1),
    blush = material("#c9927d", 0.7);
  const mesh = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    parent: THREE.Object3D = group,
  ) => {
    geometries.add(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.decorative = true;
    parent.add(m);
    return m;
  };
  const sphere = (
    r: number,
    scale: [number, number, number],
    pos: [number, number, number],
    mat: THREE.Material,
  ) => {
    const m = mesh(new THREE.SphereGeometry(r, 32, 24), mat);
    m.scale.set(...scale);
    m.position.set(...pos);
    return m;
  };
  const curve = (
    points: [number, number, number][],
    radius: number,
    mat: THREE.Material,
  ) =>
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        36,
        radius,
        8,
        false,
      ),
      mat,
    );
  const disk = mesh(new THREE.CylinderGeometry(1.06, 1.1, 0.13, 64), walnut);
  disk.scale.z = 0.77;
  disk.position.y = 0.085;
  const rim = mesh(new THREE.TorusGeometry(1.06, 0.018, 8, 64), metal);
  rim.rotation.x = Math.PI / 2;
  rim.scale.y = 0.77;
  rim.position.y = 0.15;
  const outline = new THREE.SplineCurve(
    [
      [0.0, 0.16],
      [0.42, 0.19],
      [0.73, 0.38],
      [0.85, 0.72],
      [0.83, 1.02],
      [0.73, 1.34],
      [0.56, 1.62],
      [0.36, 1.83],
      [0, 1.87],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const body = mesh(
    new THREE.LatheGeometry(outline.getPoints(40), 48),
    ceramic,
  );
  body.scale.z = 0.84;
  sphere(0.59, [1.04, 0.91, 0.79], [0, 2.1, 0.035], ceramic);
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.2, 0);
    shape.quadraticCurveTo(-0.13, 0.37, 0, 0.43);
    shape.quadraticCurveTo(0.17, 0.31, 0.2, 0);
    shape.quadraticCurveTo(0, -0.08, -0.2, 0);
    const ear = mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.11,
        bevelEnabled: true,
        bevelSize: 0.045,
        bevelThickness: 0.04,
        bevelSegments: 3,
        curveSegments: 12,
      }),
      ceramic,
    );
    ear.position.set(side * 0.34, 2.4, -0.04);
    ear.rotation.z = -side * 0.2;
    const inner = mesh(new THREE.ShapeGeometry(shape), blush);
    inner.scale.set(0.48, 0.58, 1);
    inner.position.set(side * 0.34, 2.45, 0.132);
    inner.rotation.z = -side * 0.2;
    sphere(0.25, [1, 0.65, 1.2], [side * 0.36, 0.28, 0.54], ceramic);
    sphere(0.16, [0.65, 1.55, 0.8], [side * 0.64, 0.82, 0.47], ceramic);
    curve(
      [
        [side * 0.29, 2.14, 0.46],
        [side * 0.18, 2.1, 0.5],
        [side * 0.09, 2.13, 0.51],
      ],
      0.019,
      ink,
    );
    curve(
      [
        [side * 0.045, 1.97, 0.5],
        [side * 0.09, 1.94, 0.485],
        [side * 0.13, 1.98, 0.47],
      ],
      0.011,
      ink,
    );
    for (let i = 0; i < 2; i++)
      curve(
        [
          [side * 0.25, 2.01 - i * 0.06, 0.463],
          [side * 0.39, 2.03 - i * 0.07, 0.425],
        ],
        0.008,
        ink,
      );
  }
  sphere(0.047, [1, 0.6, 0.6], [0, 2.025, 0.519], blush);
  const slotRim = mesh(new THREE.BoxGeometry(0.31, 0.028, 0.092), metal);
  slotRim.position.set(0, 2.647, 0.01);
  const slot = mesh(new THREE.BoxGeometry(0.26, 0.03, 0.037), ink);
  slot.position.set(0, 2.651, 0.01);
  curve(
    [
      [0.62, 0.29, -0.34],
      [0.93, 0.44, -0.48],
      [1.02, 0.76, -0.3],
      [0.9, 0.97, -0.07],
      [0.77, 0.92, 0.08],
    ],
    0.087,
    ceramic,
  );
  // Compartment is mounted ahead of the body: contents remain visible when opened.
  const frame = new THREE.Shape();
  frame.moveTo(-0.32, -0.32);
  frame.lineTo(0.32, -0.32);
  frame.lineTo(0.32, 0.32);
  frame.lineTo(-0.32, 0.32);
  frame.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.27, -0.27);
  hole.lineTo(-0.27, 0.27);
  hole.lineTo(0.27, 0.27);
  hole.lineTo(0.27, -0.27);
  hole.closePath();
  frame.holes.push(hole);
  const surround = mesh(
    new THREE.ExtrudeGeometry(frame, {
      depth: 0.13,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 3,
    }),
    metal,
  );
  surround.position.set(0, 0.96, 0.68);
  const back = mesh(new THREE.BoxGeometry(0.55, 0.55, 0.015), velvet);
  back.position.set(0, 0.96, 0.76);
  for (let i = 0; i < 3; i++) {
    const env = new THREE.Group();
    env.position.set((i - 1) * 0.052, 0.98 + (i - 1) * 0.04, 0.79 + i * 0.022);
    env.rotation.z = (i - 1) * -0.08;
    group.add(env);
    mesh(new THREE.BoxGeometry(0.36, 0.23, 0.012), paper, env);
    const flap = new THREE.Shape();
    flap.moveTo(-0.18, 0.115);
    flap.lineTo(0, -0.015);
    flap.lineTo(0.18, 0.115);
    flap.closePath();
    mesh(new THREE.ShapeGeometry(flap), walnut, env).position.z = 0.008;
    const seal = mesh(new THREE.CircleGeometry(0.025, 16), metal, env);
    seal.position.set(0, 0, 0.011);
  }
  const hinge = new THREE.Group();
  hinge.position.set(-0.32, 0.96, 0.885);
  group.add(hinge);
  const door = mesh(new THREE.BoxGeometry(0.64, 0.64, 0.045), ceramic, hinge);
  door.position.x = 0.32;
  const knob = mesh(new THREE.SphereGeometry(0.038, 16, 12), metal, hinge);
  knob.position.set(0.55, 0, 0.052);
  return {
    group,
    setOpen(open: boolean) {
      hinge.rotation.y = open ? -1.9 : 0;
    },
    setGlaze(hex: string) {
      ceramic.color.set(hex);
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      geometries.clear();
      materials.clear();
    },
  };
}
