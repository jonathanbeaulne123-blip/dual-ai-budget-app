import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { orderContactShade } from "../src/harbour/horizon/runtime/orderedContactShade";
function mesh(facing = [1, -1, 1, -1]) {
  const positions = [];
  for (const [i, side] of facing.entries()) {
    const a = [-1, -1, -i * 0.1], b = [1, -1, -i * 0.1], c = [0, 1, -i * 0.1];
    positions.push(...a, ...side > 0 ? b : c, ...side > 0 ? c : b);
  }
  const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
}
function materials() {
  return { back: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide }), front: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide }) };
}
function camera(ortho = false) {
  const value = ortho ? new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 100) : new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  value.position.set(0, 0, 5);
  value.lookAt(0, 0, 0);
  value.updateMatrixWorld(true);
  return value;
}
function draw(m, c, pass) {
  m.updateMatrixWorld(true);
  c.updateMatrixWorld(true);
  const group = m.geometry.groups[pass], mat = m.material[pass];
  m.onBeforeRender({}, {}, c, m.geometry, mat, group);
  const start = Math.max(group.start, m.geometry.drawRange.start), end = Math.min(group.start + group.count, m.geometry.drawRange.start + m.geometry.drawRange.count, m.geometry.index.count);
  const result = { indices: Array.from(m.geometry.index.array.slice(start, end)), group, counts: { ...m.userData.contactShadeCounts }, state: m.userData.contactShadePass };
  m.onAfterRender({}, {}, c, m.geometry, mat, group);
  return result;
}
function install(m, p = materials()) {
  const original = m.material, cleanup = orderContactShade(m, p);
  return { p, cleanup, dispose() {
    m.geometry.dispose();
    original.dispose();
    p.back.dispose();
    p.front.dispose();
  } };
}
describe("corridor contact shade retains exact conservative back/front passes", () => {
  it.each([false, true])("keeps each original pass ordered without opposite-facing submissions (orthographic=%s)", (ortho) => {
    const m = mesh(), c = camera(ortho), original = m.geometry.getAttribute("position").array.slice(), owner = install(m);
    const back = draw(m, c, 0), front = draw(m, c, 1);
    expect(back.indices).toEqual([3, 4, 5, 9, 10, 11]);
    expect(front.indices).toEqual([0, 1, 2, 6, 7, 8]);
    expect(back.state).toBe("partitioned");
    expect(front.state).toBe("partitioned");
    expect(m.geometry.getAttribute("position").array).toEqual(original);
    expect(owner.p.back.side).toBe(THREE.BackSide);
    expect(owner.p.front.side).toBe(THREE.FrontSide);
    expect(owner.p.back.forceSinglePass).toBe(false);
    expect(owner.p.front.forceSinglePass).toBe(false);
    owner.dispose();
  });
  it.each([false, true])("retains mirrored, rotated and nonuniform world-transform semantics (orthographic=%s)", (ortho) => {
    const m = mesh(), c = camera(ortho);
    m.position.set(1300, 90, 600);
    m.rotation.y = 0.7;
    m.scale.set(-2, 1.3, 0.8);
    m.updateMatrixWorld(true);
    c.position.copy(new THREE.Vector3(0, 0, 5).applyMatrix4(m.matrixWorld));
    c.lookAt(m.position);
    c.updateMatrixWorld(true);
    const owner = install(m);
    expect(draw(m, c, 0).indices).toEqual([3, 4, 5, 9, 10, 11]);
    expect(draw(m, c, 1).indices).toEqual([0, 1, 2, 6, 7, 8]);
    owner.dispose();
  });
  it.each(["near-plane", "grazing"])("duplicates only the uncertain face in both stable lists (%s)", (mode) => {
    const m = mesh([1, -1, 1]), c = camera(), p = m.geometry.getAttribute("position");
    if (mode === "near-plane") p.setXYZ(0, -1, -1, 4.95);
    else {
      p.setXYZ(0, 0, -1, -1);
      p.setXYZ(1, 0, 1, -1);
      p.setXYZ(2, 0, 0, -2);
    }
    const owner = install(m), back = draw(m, c, 0), front = draw(m, c, 1);
    expect(back.indices).toEqual([0, 1, 2, 3, 4, 5]);
    expect(front.indices).toEqual([0, 1, 2, 6, 7, 8]);
    expect(back.state).toBe("partial");
    expect(back.counts[mode === "near-plane" ? "nearPlane" : "grazing"]).toBe(1);
    expect(back.indices.length + front.indices.length).toBe(12);
    owner.dispose();
  });
  it("keeps a wholly near-clipped face once and a zero-area uncertain face in both passes", () => {
    const m = mesh([1, -1, 1]), c = camera(), p = m.geometry.getAttribute("position");
    for (let k = 0; k < 3; k++) p.setZ(k, 5.2);
    for (let k = 6; k < 9; k++) p.setXYZ(k, 0, 0, 0);
    const owner = install(m), back = draw(m, c, 0), front = draw(m, c, 1);
    expect(back.indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(front.indices).toEqual([6, 7, 8]);
    expect(back.counts.clipped).toBe(1);
    expect(back.counts.degenerate).toBe(1);
    owner.dispose();
  });
  it("does not reorder visible alpha fragments with distinct fogged colors", () => {
    const m = mesh(), c = camera(), owner = install(m), colors = [[0.1, 0.09, 0.08], [0.2, 0.25, 0.3], [0.3, 0.4, 0.5], [0.4, 0.5, 0.6]], alpha = [0.26, 0.19, 0.13, 0.21];
    const blend = (order) => order.reduce((rgb, face) => rgb.map((value, channel) => value * (1 - alpha[face]) + colors[face][channel] * alpha[face]), [0.7, 0.7, 0.7]);
    const visible = [...draw(m, c, 0).indices, ...draw(m, c, 1).indices].filter((_, i) => i % 3 === 0).map((vertex) => vertex / 3);
    expect(blend(visible)).toEqual(blend([1, 3, 0, 2]));
    expect(blend(visible)).not.toEqual(blend([0, 1, 2, 3]));
    owner.dispose();
  });
  it("preserves indexed drawRange and resets the shared index window after each pass", () => {
    const m = mesh();
    m.geometry.setIndex([0, 1, 2, 6, 7, 8, 3, 4, 5, 9, 10, 11]);
    m.geometry.setDrawRange(3, 6);
    const source = Array.from(m.geometry.index.array), c = camera(), owner = install(m), groups = [...m.geometry.groups];
    expect(draw(m, c, 0).indices).toEqual([3, 4, 5]);
    expect(Array.from(m.geometry.index.array)).toEqual(source);
    expect(draw(m, c, 1).indices).toEqual([6, 7, 8]);
    expect(Array.from(m.geometry.index.array)).toEqual(source);
    expect(m.geometry.drawRange).toEqual({ start: 3, count: 6 });
    expect(m.geometry.groups[0]).toBe(groups[0]);
    expect(m.geometry.groups[1]).toBe(groups[1]);
    owner.dispose();
  });
  it("reclassifies sequential camera moves without stale group data or shared material changes", () => {
    const a = mesh(), b = mesh([1]), c = camera(), p = materials(), owner = install(a, p), other = install(b, p);
    const states = [p.back.side, p.front.side, p.back.forceSinglePass, p.front.forceSinglePass];
    expect(draw(a, c, 0).indices).toEqual([3, 4, 5, 9, 10, 11]);
    expect(draw(a, c, 1).indices).toEqual([0, 1, 2, 6, 7, 8]);
    c.position.z = -5;
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld(true);
    expect(draw(a, c, 0).indices).toEqual([0, 1, 2, 6, 7, 8]);
    expect(draw(a, c, 1).indices).toEqual([3, 4, 5, 9, 10, 11]);
    expect(draw(b, c, 0).indices).toEqual([0, 1, 2]);
    expect(draw(b, c, 1).indices).toEqual([]);
    expect([p.back.side, p.front.side, p.back.forceSinglePass, p.front.forceSinglePass]).toEqual(states);
    a.geometry.dispose();
    b.geometry.dispose();
    owner.cleanup();
    other.cleanup();
    p.back.dispose();
    p.front.dispose();
  });
  it("retains original full back/front lists for unsupported cameras and changed positions", () => {
    for (const changed of [false, true]) {
      const m = mesh([1, -1]), owner = install(m), c = changed ? camera() : new THREE.Camera();
      if (changed) m.geometry.getAttribute("position").needsUpdate = true;
      const back = draw(m, c, 0), front = draw(m, c, 1);
      expect(back.state).toBe("unsupported");
      expect(back.indices).toEqual([0, 1, 2, 3, 4, 5]);
      expect(front.indices).toEqual(back.indices);
      owner.dispose();
    }
  });
  it("restores prior callbacks/material and leaves shared material disposal to the owner", () => {
    const m = mesh(), original = m.material, c = camera(), before = vi.fn(), after = vi.fn(), p = materials(), disposeBack = vi.fn(), disposeFront = vi.fn();
    m.onBeforeRender = before;
    m.onAfterRender = after;
    p.back.addEventListener("dispose", disposeBack);
    p.front.addEventListener("dispose", disposeFront);
    const cleanup = orderContactShade(m, p), index = m.geometry.index;
    draw(m, c, 0);
    draw(m, c, 1);
    expect(before).toHaveBeenCalledTimes(2);
    expect(after).toHaveBeenCalledTimes(2);
    m.geometry.dispose();
    cleanup();
    expect(m.onBeforeRender).toBe(before);
    expect(m.onAfterRender).toBe(after);
    expect(m.material).toBe(original);
    expect(m.geometry.index).toBe(index);
    expect(m.geometry.groups).toEqual([]);
    expect(disposeBack).not.toHaveBeenCalled();
    expect(disposeFront).not.toHaveBeenCalled();
    p.back.dispose();
    p.front.dispose();
    original.dispose();
    expect(disposeBack).toHaveBeenCalledTimes(1);
    expect(disposeFront).toHaveBeenCalledTimes(1);
  });
  it("uses installed r185 group references, stable object ordering and same-pass index upload", () => {
    const renderer = readFileSync("node_modules/three/src/renderers/WebGLRenderer.js", "utf8");
    const project = renderer.slice(renderer.indexOf("function projectObject("), renderer.indexOf("function renderObjects("));
    expect(project).toContain("const group = groups[ i ];");
    expect(project).toContain("currentRenderList.push( object, geometry, groupMaterial, groupOrder, _vector4.z, group );");
    const renderObject = renderer.slice(renderer.indexOf("function renderObject("), renderer.indexOf("function getProgram(", renderer.indexOf("function renderObject(")));
    expect(renderObject.indexOf("object.onBeforeRender(")).toBeLessThan(renderObject.indexOf("_this.renderBufferDirect("));
    expect(renderer).toContain("drawStart = Math.max( drawStart, group.start * rangeFactor );");
    expect(renderer).toContain("( group.start + group.count ) * rangeFactor");
    const list = readFileSync("node_modules/three/src/renderers/webgl/WebGLRenderLists.js", "utf8");
    expect(list).toContain("group: group");
    expect(list).toContain("return a.id - b.id;");
    expect(list).toContain("transparent.sort( customTransparentSort || reversePainterSortStable );");
    expect(readFileSync("node_modules/three/src/renderers/webgl/WebGLBindingStates.js", "utf8")).toContain("attributes.update( index, gl.ELEMENT_ARRAY_BUFFER );");
  });
  it("registers both fog-visible pass materials once and uses the existing shared disposal owner", () => {
    const source = readFileSync("src/harbour/horizon/runtime/corridorArt.ts", "utf8");
    expect(source).toContain("shadeBack=shade.clone(),shadeFront=shade.clone()");
    expect(source).toContain("shadeBack.side=THREE.BackSide;shadeFront.side=THREE.FrontSide;");
    expect(source).toContain("lampDepth,shade,shadeBack,shadeFront,ink,halo} as Record");
    expect(source).toContain("for(const mat of Object.values(materials))mat.dispose();");
  });
});
