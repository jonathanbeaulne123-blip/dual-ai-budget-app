// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { seedDemoHousehold, setBoardPhoto, type Household, type CommitResult } from "../src/core/index.ts";
import type { BoardMediaClientOptions, PendingBoardPhoto } from "../src/boardMedia/index.ts";
import { BoardPhotos } from "../src/widgets/BoardPhotos.tsx";
const mocks = vi.hoisted(() => ({ create: vi.fn(), load: vi.fn(), ensure: vi.fn() }));
vi.mock("../src/boardMedia/index.ts", () => ({ createBoardMediaClient: mocks.create, SOURCE_MAX_BYTES: 10 * 1024 * 1024 }));
vi.mock("../src/auth/supabaseSession.ts", () => ({ loadSupabaseSession: mocks.load, ensureSupabaseSession: mocks.ensure, SUPABASE_SESSION_CHANGED_EVENT: "test:auth-change" }));
let host: HTMLDivElement; let root: Root; let household: Household;
let commands: ((current: Household) => CommitResult)[];
let rows: PendingBoardPhoto[];
const mediaId = "BM-11111111-1111-4111-8111-111111111111";
const oldMediaId = "BM-22222222-2222-4222-8222-222222222222";
const memberId = "MEM-002";
let options: BoardMediaClientOptions[];
function createClient() {
  return { getBoardPhoto: vi.fn(async () => new Blob(["fake test bytes"], { type: "image/jpeg" })), uploadBoardPhoto: vi.fn(), listPendingBoardPhotos: vi.fn(async () => [...rows]), retryPendingBoardPhoto: vi.fn(async () => ({ ...rows[0]! })), acknowledgeBoardPhoto: vi.fn(async (id: string) => { rows = rows.filter(row => row.pendingId !== id); }), discardPendingBoardPhoto: vi.fn(async (id: string) => { rows = rows.filter(row => row.pendingId !== id); }), deleteBoardPhoto: vi.fn(), dispose: vi.fn() };
}
let clients: ReturnType<typeof createClient>[];
function pending(slot: 1 | 2 | 3, expectedVersion = 0): PendingBoardPhoto {
  return { pendingId: "pending-1", mediaId, contentType: "image/jpeg", byteLength: 15, width: 10, height: 10, createdAt: "2026-09-08T19:00:00Z", status: "queued", attempts: 1,
    scope: { environment: "development", householdId: household.householdId, actorId: memberId, authIdentity: "test-auth-A" }, intent: { slot, caption: "A day together", crop: { x: 30, y: 60, zoom: 1.5 }, expectedVersion } };
}
async function render() { await act(async () => root.render(h(BoardPhotos, { household, memberId, busy: false, onCommand: fn => commands.push(fn) }))); }
function button(name: string) { const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(row => row.textContent === name); if (!found) throw new Error(`Missing ${name}`); return found; }
async function click(name: string) { await act(async () => button(name).click()); }
async function value(input: HTMLInputElement, text: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => `blob:photo-${Math.random()}`), revokeObjectURL: vi.fn() }));
  const auth = { userId: "test-auth-A", sessionId: "test-session-A", accessToken: "synthetic" };
  mocks.load.mockReturnValue(auth); mocks.ensure.mockResolvedValue(auth);
  household = seedDemoHousehold({ environment: "development", today: "2026-09-08" }); rows = []; commands = []; clients = []; options = [];
  mocks.create.mockImplementation((config: BoardMediaClientOptions) => { options.push(config); const client = createClient(); clients.push(client); return client; });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("recovers the durable intended slot after reload and acknowledges only the accepted media reference", async () => {
  rows = [pending(2)]; await render(); expect(commands).toHaveLength(0);
  await click("Retry photo 2"); expect(commands).toHaveLength(1); expect(clients[0]!.acknowledgeBoardPhoto).not.toHaveBeenCalled();
  household = commands[0]!(household).household;
  expect(household.kitchen.boards?.photos[0]).toMatchObject({ id: "BOARD-PHOTO-2", mediaId, caption: "A day together", crop: { x: 30, y: 60, zoom: 1.5 }, version: 1 });
  rows[0]!.status = "uploaded"; await render();
  expect(clients[0]!.acknowledgeBoardPhoto).toHaveBeenCalledWith("pending-1"); expect(clients[0]!.deleteBoardPhoto).not.toHaveBeenCalled();
});
it("refuses a recovered upload if its original slot version changed", async () => {
  rows = [pending(1)]; household = setBoardPhoto(household, { memberId, slot: 1, mediaId: oldMediaId, caption: "Partner photo", crop: { x: 50, y: 50, zoom: 1 }, expectedVersion: 0 }).household;
  await render(); await click("Retry photo 1"); expect(commands).toHaveLength(0); expect(clients[0]!.retryPendingBoardPhoto).not.toHaveBeenCalled(); expect(host.textContent).toContain("photo space changed");
  await click("Discard pending photo 1"); expect(clients[0]!.discardPendingBoardPhoto).toHaveBeenCalledWith("pending-1"); expect(clients[0]!.deleteBoardPhoto).not.toHaveBeenCalled();
});
it("preserves caption/crop drafts when a metadata edit loses its version race", async () => {
  household = setBoardPhoto(household, { memberId, slot: 1, mediaId: oldMediaId, caption: "Original", crop: { x: 50, y: 50, zoom: 1 }, expectedVersion: 0 }).household;
  await render(); await click("Edit photo 1"); const caption = host.querySelector<HTMLInputElement>('[aria-label="Photo 1 caption"]')!; await value(caption, "My unfinished caption"); await click("Save photo 1");
  household = setBoardPhoto(household, { memberId, slot: 1, mediaId: oldMediaId, caption: "Partner edit", crop: { x: 40, y: 50, zoom: 1 }, expectedVersion: 1 }).household;
  expect(() => commands[0]!(household)).toThrow(); await render(); expect(caption.value).toBe("My unfinished caption"); expect(button("Save photo 1").disabled).toBe(true);
});
it("keeps the former image and durable intent when upload fails before metadata acceptance", async () => {
  household = setBoardPhoto(household, { memberId, slot: 1, mediaId: oldMediaId, caption: "Original", crop: { x: 50, y: 50, zoom: 1 }, expectedVersion: 0 }).household;
  await render(); clients[0]!.uploadBoardPhoto.mockImplementation(async (_file, intent) => { rows = [{ ...pending(1, 1), intent }]; throw new Error("Photo remains pending. Reconnect and retry."); });
  await click("Edit photo 1"); await value(host.querySelector<HTMLInputElement>('[aria-label="Photo 1 caption"]')!, "Replacement");
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  await act(async () => { Object.defineProperty(input, "files", { configurable: true, value: [new File(["fake source"], "test.jpg", { type: "image/jpeg" })] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
  await click("Save photo 1"); expect(commands).toHaveLength(0); expect(household.kitchen.boards?.photos[0]!.mediaId).toBe(oldMediaId); expect(rows[0]!.intent).toMatchObject({ slot: 1, caption: "Replacement", expectedVersion: 1 });
  expect(host.querySelector<HTMLInputElement>('[aria-label="Photo 1 caption"]')!.value).toBe("Replacement"); expect(button("Retry photo 1")).toBeDefined();
});
it("retires clients synchronously on a batched auth A-B-A switch and revokes displayed URLs", async () => {
  household = setBoardPhoto(household, { memberId, slot: 1, mediaId: oldMediaId, caption: "Original", crop: { x: 50, y: 50, zoom: 1 }, expectedVersion: 0 }).household;
  await render(); expect(options[0]!.isCurrent()).toBe(true);
  await act(async () => {
    mocks.load.mockReturnValue({ userId: "test-auth-B", sessionId: "test-session-B" }); window.dispatchEvent(new Event("test:auth-change"));
    expect(options[0]!.isCurrent()).toBe(false);
    mocks.load.mockReturnValue({ userId: "test-auth-A", sessionId: "test-session-A" }); window.dispatchEvent(new Event("test:auth-change"));
  });
  expect(clients[0]!.dispose).toHaveBeenCalled(); expect(options[0]!.isCurrent()).toBe(false); expect(clients.length).toBe(2); expect(URL.revokeObjectURL).toHaveBeenCalled();
});

it("never submits a late upload into a new household session", async () => {
  await render();
  let finish!: (value: { mediaId: string; pendingId: string }) => void;
  clients[0]!.uploadBoardPhoto.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await click("Add photo 1");
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  await act(async () => { Object.defineProperty(input, "files", { configurable: true, value: [new File(["fake source"], "test.jpg", { type: "image/jpeg" })] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
  await click("Save photo 1");
  const a = household; household = { ...household, householdId: "HH-OTHER" }; await render(); household = a; await render();
  await act(async () => finish({ mediaId, pendingId: "late" }));
  expect(commands).toHaveLength(0); expect(options[0]!.isCurrent()).toBe(false);
});

it("uses matching cached expired auth for offline queue/recovery and refreshes again when online", async () => {
  const { createBoardMediaClient } = await vi.importActual<typeof import("../src/boardMedia/index.ts")>("../src/boardMedia/index.ts");
  const { Blob: NodeBlob } = await import("node:buffer");
  const { jpeg } = await import("./fixtures/boardMedia.ts");
  const records = new Map<string, import("../src/boardMedia/index.ts").PendingBoardPhotoRecord>();
  const store: import("../src/boardMedia/index.ts").BoardPhotoStore = {
    add: async record => { records.set(record.pendingId, record); },
    get: async (_scope, id) => records.get(id),
    list: async () => [...records.values()],
    update: async (_scope, id, patch) => { const record = records.get(id); if (!record) return; const next = { ...record, ...patch }; records.set(id, next); return next; },
    remove: async (_scope, id) => { records.delete(id); },
  };
  const expired = { userId: "test-auth-A", sessionId: "test-session-A", accessToken: "synthetic-expired", expiresAt: 1 };
  mocks.load.mockReturnValue(expired); mocks.ensure.mockRejectedValue(new Error("Cannot refresh while offline"));
  let online = false;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  await render(); const binding = options[0]!;
  const bytes = await jpeg(); const blob = new NodeBlob([bytes], { type: "image/jpeg" }) as unknown as Blob;
  const fetcher = vi.fn(async () => { throw new Error("Offline"); });
  const makeClient = () => createBoardMediaClient({ ...binding, store, fetch: fetcher, prepare: async () => ({ blob, width: 12, height: 8 }) });
  const media = makeClient(); const intent = pending(3).intent!;
  await expect(media.uploadBoardPhoto(blob, intent)).rejects.toMatchObject({ code: "NETWORK_UNAVAILABLE" });
  expect(records.size).toBe(1); expect(mocks.ensure).not.toHaveBeenCalled();
  media.dispose(); const recovered = makeClient();
  expect((await recovered.listPendingBoardPhotos())[0]).toMatchObject({ intent, status: "queued" });
  mocks.ensure.mockResolvedValue({ ...expired, accessToken: "synthetic-fresh" }); online = true;
  await expect(binding.getSession()).resolves.toMatchObject({ accessToken: "synthetic-fresh", authIdentity: "test-auth-A", actorId: memberId });
  expect(mocks.ensure).toHaveBeenCalledOnce();
  recovered.dispose(); vi.restoreAllMocks();
});

it("removes only the accepted board reference and never deletes stored photo bytes", async () => {
  household = setBoardPhoto(household, { memberId, slot: 1, mediaId: oldMediaId, caption: "Original", crop: { x: 50, y: 50, zoom: 1 }, expectedVersion: 0 }).household;
  await render(); await click("Remove photo 1");
  expect(household.kitchen.boards?.photos[0]!.mediaId).toBe(oldMediaId);
  expect(clients[0]!.deleteBoardPhoto).not.toHaveBeenCalled();
  household = commands[0]!(household).household; await render();
  expect(household.kitchen.boards?.photos[0]!.mediaId).toBeNull();
  expect(clients[0]!.deleteBoardPhoto).not.toHaveBeenCalled(); expect(clients[0]!.discardPendingBoardPhoto).not.toHaveBeenCalled();
});
