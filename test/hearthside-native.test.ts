import { describe, expect, it, vi } from "vitest";
import { beginNativePkce, consumeNativeAuthCode, HearthsideNativeController, nativeAuthStorage, recoverNativePkce, validateNativeScene, validateNativeReturnPath, type NativeEvent, type NativePlugin, type NativeScene } from "../src/hearthside/native.ts";

function glb() {
  const json = JSON.stringify({ asset: { version: "2.0" }, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }], buffers: [{ byteLength: 44 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [0.1, 0.1, 0] }, { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" }] });
  const padded = json.padEnd(Math.ceil(json.length / 4) * 4, " "); const bytes = new Uint8Array(20 + padded.length + 8 + 44), view = new DataView(bytes.buffer);
  [0x46546c67, 2, bytes.length, padded.length, 0x4e4f534a].forEach((n, i) => view.setUint32(i * 4, n, true)); bytes.set(new TextEncoder().encode(padded), 20);
  const binary = 20 + padded.length; view.setUint32(binary, 44, true); view.setUint32(binary + 4, 0x004e4942, true);
  [0, 0, 0, 0.1, 0, 0, 0, 0.1, 0].forEach((n, i) => view.setFloat32(binary + 8 + i * 4, n, true)); [0, 1, 2].forEach((n, i) => view.setUint16(binary + 44 + i * 2, n, true));
  return Buffer.from(bytes).toString("base64");
}
const fixture = (): NativeScene => ({ version: 1, identity: { environment: "development", householdId: "house-a", memberId: "alice", designId: "design-a", pieceId: "cat-a", revision: 4 }, backing: { status: "available", step: 3 }, returnPath: "/hearthside/studio/cat-a", glbBase64: glb(), meshes: [{ name: "body", positions: [0, 0, 0, 0.1, 0, 0, 0, 0.1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 1, 0, 0, 1], indices: [0, 1, 2], texturePng: "", color: [1, 0.8, 0.6, 1] }] });
function harness() {
  const storage = new Map<string, string>(); let listener: (event: NativeEvent) => void = () => {};
  const plugin: NativePlugin = {
    available: vi.fn(async () => ({ supported: true, platform: "ios" })), presentAR: vi.fn(async () => {}), resumeAR: vi.fn(async () => {}), closeAR: vi.fn(async () => {}), updateAccepted: vi.fn(async () => {}),
    addListener: vi.fn(async (_, callback) => { listener = callback; return { remove: vi.fn(async () => {}) }; }),
    authenticate: vi.fn(async ({ state }) => ({ callbackUrl: `hearthside://auth/callback?code=synthetic-code&state=${state}` })), consumeAuthCallback: vi.fn(async () => ({ callbackUrl: null })), cancelAuthentication: vi.fn(async () => {}),
    secureGet: vi.fn(async ({ key }) => ({ value: storage.get(key) ?? null })), secureSet: vi.fn(async ({ key, value }) => { storage.set(key, value); }), secureRemove: vi.fn(async ({ key }) => { storage.delete(key); }),
  };
  const review = vi.fn(); const controller = new HearthsideNativeController(plugin, review);
  const event = (kind: NativeEvent["kind"], extra: Partial<NativeEvent> = {}) => {
    const call = vi.mocked(plugin.presentAR).mock.calls.at(-1)![0];
    listener({ version: 1, sessionId: call.sessionId, identity: call.scene.identity, kind, eventId: "event-a", ...extra });
  };
  return { plugin, controller, review, storage, event };
}
describe("native companions stay inside accepted Hearthside scope", () => {
  it("keeps scoped object queries and focus while refusing cross-household and external return paths",()=>{
    const path='/hearthside/pieces/cat-a?household=house-a&room=studio&mode=present&design=design-a';
    expect(validateNativeReturnPath(path,'house-a')).toBe(path);
    for(const bad of [path+'&private=1',path+'&household=house-b',path.replace('house-a','house-b'),path+'&from='+encodeURIComponent('/hearthside/rooms/common?household=house-b'),'/hearthside/%2e%2e/ledger','/hearthside/../ledger',path+'#camera'])expect(()=>validateNativeReturnPath(bad,'house-a')).toThrow();
  });
  it("keeps a free piece interactive without creating a financial review",async()=>{
    const h=harness();await h.controller.open({...fixture(),fundingEnabled:false});h.event('funding-intent');expect(h.review).not.toHaveBeenCalled();await h.controller.dispose();
  });
  it("validates metre geometry and refuses bad indices and external returns", () => {
    expect(validateNativeScene(fixture())).toEqual(fixture());
    const wrong = fixture(); wrong.meshes[0]!.indices[0] = 999; expect(() => validateNativeScene(wrong)).toThrow("triangles");
    expect(() => validateNativeScene({ ...fixture(), returnPath: "https://example.invalid" })).toThrow("inside Hearthside");
    expect(() => validateNativeScene({ ...fixture(), glbBase64: "" })).toThrow("complete GLB");
    expect(() => validateNativeScene({ ...fixture(), identity: { ...fixture().identity, environment: "Development" } })).toThrow("scope");
    expect(() => validateNativeScene({ ...fixture(), backing: { status: "available", step: 11 } })).toThrow("backing");
  });
  it("a native coin opens one existing review and never creates an accepted state", async () => {
    const h = harness(); await h.controller.open(fixture()); h.event("funding-intent"); h.event("funding-intent");
    expect(h.review).toHaveBeenCalledOnce(); expect(h.plugin.updateAccepted).not.toHaveBeenCalled();
    expect(h.review.mock.calls[0]![0]).toEqual({ id: "event-a", identity: fixture().identity, returnPath: fixture().returnPath });
  });
  it("accepted receipt replay animates once; target changes and unavailable backing remain truthful", async () => {
    const h = harness(); await h.controller.open(fixture());
    const input = { identity: fixture().identity, receiptId: "receipt-a", backing: { status: "available" as const, step: 4 }, kind: "contribution" as const, status: "accepted" as const };
    await h.controller.accepted(input); await h.controller.accepted(input); expect(h.plugin.updateAccepted).toHaveBeenCalledOnce();
    await h.controller.accepted({ ...input, receiptId: "target-change", kind: "target-change", backing: { status: "unavailable" } });
    expect(vi.mocked(h.plugin.updateAccepted).mock.calls.at(-1)![0]).toMatchObject({ animate: false, backing: { status: "unavailable" } });
    await h.controller.resume(); expect(h.plugin.resumeAR).toHaveBeenCalledOnce();
  });
  it("scope switches discard delayed native interactions and cross-household receipts", async () => {
    const h = harness(); await h.controller.open(fixture());
    h.event("funding-intent", { identity: { ...fixture().identity, householdId: "another" } }); expect(h.review).not.toHaveBeenCalled();
    await h.controller.accepted({ identity: { ...fixture().identity, memberId: "bob" }, receiptId: "other", backing: { status: "available", step: 10 }, kind: "contribution", status: "accepted" });
    expect(h.plugin.updateAccepted).not.toHaveBeenCalled(); await h.controller.leaveScope(); h.event("funding-intent"); expect(h.review).not.toHaveBeenCalled(); expect(h.plugin.closeAR).toHaveBeenCalledOnce();
  });
  it("scope departure during capability loading never opens a camera", async () => {
    const h = harness(); let finish!: (value: { supported: boolean; platform: string }) => void;
    vi.mocked(h.plugin.available).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const opening = h.controller.open(fixture()); await vi.waitFor(() => expect(h.plugin.available).toHaveBeenCalled()); await h.controller.leaveScope();
    finish({ supported: true, platform: "android" }); await opening; expect(h.plugin.presentAR).not.toHaveBeenCalled();
  });
  it("unsupported devices and permission denial reject truthfully", async () => {
    const h = harness(); vi.mocked(h.plugin.available).mockResolvedValue({ supported: false, platform: "android", reason: "Unsupported phone" });
    await expect(h.controller.open(fixture())).rejects.toThrow("Unsupported phone"); expect(h.plugin.presentAR).not.toHaveBeenCalled();
    vi.mocked(h.plugin.available).mockResolvedValue({ supported: true, platform: "ios" }); vi.mocked(h.plugin.presentAR).mockRejectedValue(new Error("CAMERA_DENIED"));
    await expect(h.controller.open(fixture())).rejects.toThrow("CAMERA_DENIED");
    await h.controller.resume(); h.event("funding-intent");
    expect(h.plugin.closeAR).toHaveBeenCalledOnce(); expect(h.plugin.resumeAR).not.toHaveBeenCalled(); expect(h.review).not.toHaveBeenCalled();
  });
  it("an explicitly closed native scene cannot later open a financial review", async () => {
    const h = harness(); await h.controller.open(fixture()); h.event("closed"); h.event("funding-intent", { eventId: "late-intent" });
    await h.controller.resume(); expect(h.plugin.resumeAR).not.toHaveBeenCalled(); expect(h.review).not.toHaveBeenCalled();
  });
  it("secure storage has no volatile fallback and accepts only PKCE code returns", async () => {
    const h = harness(), storage = nativeAuthStorage(h.plugin);
    await storage.setItem("sb-synthetic-auth-token", "synthetic-session"); expect(await storage.getItem("sb-synthetic-auth-token")).toBe("synthetic-session"); await storage.removeItem("sb-synthetic-auth-token"); expect(await storage.getItem("sb-synthetic-auth-token")).toBeNull();
    expect(consumeNativeAuthCode("hearthside://auth/callback?code=code-a&state=state-a", "state-a")).toBe("code-a");
    for (const url of ["hearthside://auth/callback?code=a&state=other", "hearthside://auth/callback?code=a&state=state-a&state=state-a", "hearthside://auth/callback?state=state-a#access_token=secret", "https://example.invalid?code=a&state=state-a"]) expect(() => consumeNativeAuthCode(url, "state-a")).toThrow();
    vi.mocked(h.plugin.secureSet).mockRejectedValue(new Error("locked")); await expect(storage.setItem("session", "synthetic")).rejects.toThrow("locked");
  });
  it("opens the system browser with unguessable state and expires stale recovery", async () => {
    const h = harness(), builder = vi.fn(async (redirect: string) => `https://auth.example.invalid/authorize?redirect_to=${encodeURIComponent(redirect)}`);
    expect(await beginNativePkce(h.plugin, builder)).toBe("synthetic-code"); expect(builder.mock.calls[0]![0]).toMatch(/^hearthside:\/\/auth\/callback\?state=[0-9a-f]{64}$/);
    expect(h.storage.has("native-pkce-state")).toBe(false);
    h.storage.set("native-pkce-state", JSON.stringify({ state: "old", expiresAt: 1 })); expect(await recoverNativePkce(h.plugin)).toBeNull(); expect(h.plugin.cancelAuthentication).toHaveBeenCalledOnce();
  });
});
