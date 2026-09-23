import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import * as THREE from "three";
import { PLAYABLE_AVATARS } from "../src/harbour/body/avatarDefinition.ts";
import { createPlayableFigure } from "../src/harbour/body/playableFigure.ts";
import { createBodyFigure } from "../src/harbour/body/figure.ts";
import {createCharacterWalker} from "../src/harbour/body/characterWalker.ts";
import * as glbAssets from "../src/harbour/assets/loadGlb.ts";

const root = resolve(process.cwd(), "public/models/players");
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

describe("Little Harbour playable character derivatives", () => {
  it("ships compact, provenance-fenced authored surfaces", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")) as { characters: Array<{ avatar: string; url: string; bytes: number; sha256: string; triangles: number; drawPrimitives: number; source: { sha256: string } }> };
    expect(manifest.characters.map((row) => row.avatar).sort()).toEqual(["bianca", "jonathan"]);
    for (const row of manifest.characters) {
      const file = resolve(process.cwd(), `public${row.url}`);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file).byteLength).toBe(row.bytes);
      expect(hash(readFileSync(file))).toBe(row.sha256);
      expect(PLAYABLE_AVATARS[row.avatar as keyof typeof PLAYABLE_AVATARS].sha256).toBe(row.sha256);
      expect(row.triangles).toBeLessThanOrEqual(10_000);
      expect(row.drawPrimitives).toBeLessThanOrEqual(4);
      expect(row.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("ships a self-contained local reviewer with no remote dependency", () => {
    const html = readFileSync(resolve(root, "viewer.html"), "utf8");
    expect(html).toContain("data:model/gltf-binary;base64,");
    expect(html).toContain("<script type=\"module\">");
    expect(html).not.toContain('src="./viewer.js"');
    expect(existsSync(resolve(root, "viewer.js"))).toBe(false);
    const viewerSource = readFileSync(resolve(process.cwd(), "scripts/harbour/playable-character-viewer.mjs"), "utf8");
    expect(viewerSource).not.toContain("fetch(");
    expect(viewerSource).toContain("row.dataUrl");
  });

  it("returns an immediately poseable procedural biped for either explicit avatar", () => {
    for (const avatar of Object.keys(PLAYABLE_AVATARS) as Array<keyof typeof PLAYABLE_AVATARS>) {
      const figure = createPlayableFigure(avatar, "lite");
      expect(figure.height).toBeGreaterThan(0);
      figure.pose(0.4, 1, 1, { lean: 0, bank: 0, run: 1, air: 0.2, flourish: 0 });
      expect(figure.group.position.y).toBe(0);
      figure.dispose();
    }
  });

  it("shows the selected authored surface when its asset loads", async () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.2, 1, .1), new THREE.MeshStandardMaterial());
    root.add(mesh);
    const acquire = vi.spyOn(glbAssets, "acquireGlb").mockImplementation(async (asset) => ({root, asset, release: () => undefined}));
    try {
      for (const avatar of ["bianca", "jonathan"] as const) {
        const statuses: string[] = [];
        const figure = createPlayableFigure(avatar, "lite", {onStatus: (_, status) => statuses.push(status)});
        await vi.waitFor(() => expect(statuses).toEqual(["ready"]));
        expect(figure.group.getObjectByName(`playable-${avatar}-lite`)).toBeTruthy();
        expect(figure.group.getObjectByName("body-torso")!.visible).toBe(false);
        figure.dispose();
      }
    } finally { acquire.mockRestore(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
  });

  it("shows a live partner's selected model without sharing its fade material", async () => {
    const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(.2,1,.1),new THREE.MeshStandardMaterial()));
    const acquire=vi.spyOn(glbAssets,"acquireGlb").mockImplementation(async asset=>({root,asset,release:()=>undefined}));
    const local=createPlayableFigure("bianca","lite");
    const partner=createCharacterWalker({tint:"#ffffff",skin:"#ffffff",height:.58});
    try {
      partner.setAvatar?.("bianca");
      await vi.waitFor(()=>expect(partner.group.getObjectByName("playable-bianca-lite")).toBeTruthy());
      await vi.waitFor(()=>expect(local.group.getObjectByName("playable-bianca-lite")).toBeTruthy());
      const localMesh=local.group.getObjectByName("playable-bianca-lite")!.children[0] as THREE.Mesh;
      const peerMesh=partner.group.getObjectByName("playable-bianca-lite")!.children[0] as THREE.Mesh;
      expect(peerMesh.material).not.toBe(localMesh.material);
      partner.setOpacity(.4);
      expect((peerMesh.material as THREE.MeshStandardMaterial).opacity).toBeCloseTo(.4);
      expect((localMesh.material as THREE.MeshStandardMaterial).opacity).toBe(1);
    } finally {partner.dispose();local.dispose();acquire.mockRestore();root.traverse(node=>{const mesh=node as THREE.Mesh;if(mesh.isMesh){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}});}
  });

  it("keeps authored feature colours in one real draw primitive per surface", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    for (const avatar of Object.keys(PLAYABLE_AVATARS) as Array<keyof typeof PLAYABLE_AVATARS>) {
      const document = await io.read(resolve(process.cwd(), `public${PLAYABLE_AVATARS[avatar].url}`));
      const primitives = document.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives());
      expect(primitives).toHaveLength(1);
      const colour = primitives[0]?.getAttribute("COLOR_0");
      expect(colour).toBeDefined();
      const swatches = new Set<string>(), paintedSkin = new Set<string>();
      for (let index = 0; index < (colour?.getCount() ?? 0); index += 1) {
        const rgb = colour!.getElement(index, [] as number[]).slice(0, 3);
        const key = rgb.map(component => component.toFixed(3)).join(",");
        swatches.add(key);
        const [r, g, b] = rgb as [number, number, number];
        if (r > .6 && g > .2 && g < .65 && b < g * .75 && g < r * .7) paintedSkin.add(key);
      }
      expect(swatches.size).toBeGreaterThan(6);
      // The originals have a painted peach face under a white material.
      // A flat material-factor bake loses these gradients and turns it white.
      expect(paintedSkin.size, `${avatar} lost the painted face`).toBeGreaterThan(10);
    }
  });

  it("passes an already-cancelled caller signal through before requesting an asset", () => {
    const acquire = vi.spyOn(glbAssets, "acquireGlb").mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    const controller = new AbortController(); controller.abort();
    try {
      const figure = createPlayableFigure("bianca", "lite", { signal: controller.signal });
      expect(acquire.mock.calls[0]?.[1]?.aborted).toBe(true);
      figure.dispose();
    } finally { acquire.mockRestore(); }
  });

  it("fits moving limbs to the authored shoulders and keeps the long coat free of a blue waist patch", () => {
    for (const avatar of ["bianca", "jonathan"] as const) {
      const definition = PLAYABLE_AVATARS[avatar];
      const figure = createBodyFigure(definition.colours, definition.anatomy);
      const arm = figure.group.getObjectByName("body-arm-left")!;
      const leg = figure.group.getObjectByName("body-leg-left")!;
      expect(arm.position.y).toBeGreaterThan(.45);
      const sleeve = arm.children[0] as THREE.Mesh;
      sleeve.geometry.computeBoundingBox();
      expect(sleeve.geometry.boundingBox!.max.x - sleeve.geometry.boundingBox!.min.x).toBeLessThan(.06);
      expect(Math.abs(leg.position.x)).toBeLessThan(.03);
      expect(figure.group.getObjectByName("body-pelvis")!.visible).toBe(avatar === "bianca");
      const hipPosition = leg.position.clone();
      figure.pose(.8, 1, .2, { lean: 0, bank: 0, run: 0 });
      expect(arm.rotation.x * leg.rotation.x).toBeLessThan(0);
      expect(leg.position.equals(hipPosition)).toBe(true);
      figure.dispose();
    }
  });
});
