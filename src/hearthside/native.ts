import type { Environment } from "../core/types.ts";
import {parseHearthsideRoute} from './routes.ts';

export type NativeIdentity = { environment: Environment; householdId: string; memberId: string; designId: string; pieceId: string; revision: number };
export type NativeMesh = { name: string; positions: number[]; normals: number[]; uvs: number[]; indices: number[]; texturePng: string; color: [number, number, number, number] };
export type NativeBacking = { status: "available"; step: number } | { status: "unavailable" };
export type NativeScene = { version: 1; identity: NativeIdentity; meshes: NativeMesh[]; glbBase64: string; backing: NativeBacking; returnPath: string; fundingEnabled?:boolean };
export type NativeEvent = { version: 1; sessionId: string; identity: NativeIdentity; kind: "funding-intent" | "closed" | "tracking" | "background" | "resumed" | "error"; eventId: string; state?: string };
export type NativeAcceptedUpdate = { sessionId: string; identity: NativeIdentity; receiptId: string; backing: NativeBacking; animate: boolean };
export type NativePlugin = {
  available(): Promise<{ supported: boolean; platform: string; reason?: string }>;
  presentAR(input: { sessionId: string; scene: NativeScene }): Promise<void>;
  resumeAR(input: { sessionId: string }): Promise<void>;
  updateAccepted(input: NativeAcceptedUpdate): Promise<void>;
  closeAR(input: { sessionId: string }): Promise<void>;
  addListener(name: "hearthside", listener: (event: NativeEvent) => void): Promise<{ remove(): Promise<void> }>;
  authenticate(input: { url: string; state: string }): Promise<{ callbackUrl: string }>;
  consumeAuthCallback(): Promise<{ callbackUrl: string | null }>;
  cancelAuthentication(): Promise<void>;
  secureGet(input: { key: string }): Promise<{ value: string | null }>;
  secureSet(input: { key: string; value: string }): Promise<void>;
  secureRemove(input: { key: string }): Promise<void>;
};
const id = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/.test(v);
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const sameIdentity = (a: NativeIdentity, b: NativeIdentity) => ["environment", "householdId", "memberId", "designId", "pieceId", "revision"].every((key) => a[key as keyof NativeIdentity] === b[key as keyof NativeIdentity]);
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function record(v: unknown, keys: string[]): asserts v is Record<string, unknown> {
  assert(v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every((key) => Object.hasOwn(v, key)), "Unsupported native payload.");
}
function base64(v: unknown, max: number) { assert(typeof v === "string" && v.length <= max && v.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(v), "Invalid local native asset."); }
export function validateNativeGLB(encoded: string) {
  base64(encoded, 12 * 1024 * 1024);
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  assert(bytes.length >= 20, "A complete GLB asset is required.");
  const view = new DataView(bytes.buffer);
  assert(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === bytes.length && view.getUint32(16, true) === 0x4e4f534a, "Invalid GLB container.");
  const size = view.getUint32(12, true); assert(size > 0 && size + 20 <= bytes.length, "Invalid GLB JSON chunk.");
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + size)).trim());
  assert(json.asset?.version === "2.0" && [...(json.buffers ?? []), ...(json.images ?? [])].every((value: { uri?: unknown }) => value.uri === undefined), "Native assets must be self-contained; remote resources are refused.");
}
function vector(v: unknown, length: number, max: number): asserts v is number[] {
  assert(Array.isArray(v) && v.length === length && v.length <= max && Array.from(v).every((n) => typeof n === "number" && Number.isFinite(n)), "Invalid native geometry.");
}
export function validateNativeIdentity(input: unknown): NativeIdentity {
  record(input, ["environment", "householdId", "memberId", "designId", "pieceId", "revision"]);
  assert((input.environment === "development" || input.environment === "production") && [input.householdId, input.memberId, input.designId, input.pieceId].every(id) && integer(input.revision), "Invalid native scope.");
  return structuredClone(input) as NativeIdentity;
}
export function validateNativeBacking(input: unknown): NativeBacking {
  assert(input !== null && typeof input === "object", "Invalid backing projection.");
  const value = input as NativeBacking;
  record(value, value.status === "available" ? ["status", "step"] : ["status"]);
  assert(value.status === "unavailable" || value.status === "available" && integer(value.step) && value.step <= 10, "Invalid backing projection.");
  return structuredClone(value);
}
/** Accept only bounded internal routes, with explicit household scope whenever a query is present. */
export function validateNativeReturnPath(value:unknown,householdId:string):string {
  assert(typeof value==='string'&&value.length<=3000&&value.startsWith('/hearthside')&&!value.includes('\\')&&!value.includes('#'),'Native return must stay inside Hearthside.');
  const url=new URL(value,'https://hearth.invalid');
  assert(url.origin==='https://hearth.invalid'&&url.pathname===value.split('?')[0]&&!/%(?:2f|5c|2e)/i.test(url.pathname),'Native return must stay inside Hearthside.');
  if(!url.search){assert(/^\/hearthside(?:\/[A-Za-z0-9._~%-]+)*$/.test(value)&&!value.includes('..'),'Native return must stay inside Hearthside.');return value;}
  const allowed=['household','room','mode','design','from','focus','surface'];
  assert([...url.searchParams.keys()].every(key=>allowed.includes(key)&&url.searchParams.getAll(key).length===1)&&url.searchParams.get('household')===householdId,'Native return belongs to another household.');
  const route=parseHearthsideRoute(value,householdId);assert(route,'Native return must identify a Hearthside object.');
  if(route.returnContext){const back=new URL(route.returnContext.path,'https://hearth.invalid');assert(!back.searchParams.has('from')&&!back.searchParams.has('focus'),'Native return is nested.');validateNativeReturnPath(route.returnContext.path,householdId);}
  return value;
}
/** Mesh coordinates are authored metres. No financial scale, squash, poses or room scans. */
export function validateNativeScene(input: unknown): NativeScene {
  record(input, ["version", "identity", "meshes", "glbBase64", "backing", "returnPath",...(input&&typeof input==='object'&&Object.hasOwn(input,'fundingEnabled')?['fundingEnabled']:[])]);
  assert(input.fundingEnabled===undefined||typeof input.fundingEnabled==='boolean','Invalid funding interaction.');
  assert(input.version === 1, "Unsupported native scene version.");
  const identity=validateNativeIdentity(input.identity); validateNativeBacking(input.backing);
  validateNativeReturnPath(input.returnPath,identity.householdId);
  base64(input.glbBase64, 12 * 1024 * 1024); validateNativeGLB(input.glbBase64 as string);
  assert(Array.isArray(input.meshes) && input.meshes.length > 0 && input.meshes.length <= 64, "Unsupported native mesh count.");
  let vertices = 0;
  for (const mesh of input.meshes) {
    record(mesh, ["name", "positions", "normals", "uvs", "indices", "texturePng", "color"]);
    assert(id(mesh.name) && Array.isArray(mesh.positions) && mesh.positions.length % 3 === 0, "Invalid native mesh identity.");
    const count = mesh.positions.length / 3; vertices += count;
    vector(mesh.positions, count * 3, 150000); vector(mesh.normals, count * 3, 150000); vector(mesh.uvs, count * 2, 100000); vector(mesh.color, 4, 4);
    assert(mesh.positions.every((n: number) => Math.abs(n) <= 5) && mesh.color.every((n: number) => n >= 0 && n <= 1), "Native geometry must use bounded metres and colour.");
    assert(Array.isArray(mesh.indices) && mesh.indices.length > 0 && mesh.indices.length % 3 === 0 && mesh.indices.length <= 300000 && Array.from(mesh.indices).every((n) => integer(n) && n < count), "Invalid native triangles.");
    base64(mesh.texturePng, 4 * 1024 * 1024);
  }
  assert(vertices <= 100000 && JSON.stringify(input).length <= 24 * 1024 * 1024, "This native scene exceeds the portable asset limit.");
  return structuredClone(input) as NativeScene;
}

/** Inject the registered Capacitor plugin and the application's existing review opener. */
export class HearthsideNativeController {
  private current: { id: string; scene: NativeScene; receipts: Set<string>; events: Set<string> } | null = null;
  private generation = 0;
  private listener: { remove(): Promise<void> } | null = null;
  private connecting: Promise<void> | null = null;
  constructor(private readonly plugin: NativePlugin, private readonly review: (intent: { id: string; identity: NativeIdentity; returnPath: string }) => void, private readonly onState: (event: NativeEvent) => void = () => {}) {}
  async connect() {
    if (this.listener) return;
    this.connecting ??= this.plugin.addListener("hearthside", (event) => this.receive(event)).then((listener) => { this.listener = listener; }).finally(() => { this.connecting = null; });
    await this.connecting;
  }
  async open(scene: NativeScene) {
    const checked = validateNativeScene(scene), generation = ++this.generation;
    const previous = this.current; this.current = null;
    if (previous) await this.plugin.closeAR({ sessionId: previous.id });
    await this.connect();
    const available = await this.plugin.available();
    if (generation !== this.generation) return;
    assert(available.supported, available.reason ?? "Interactive AR is unavailable on this device.");
    const current = { id: crypto.randomUUID(), scene: checked, receipts: new Set<string>(), events: new Set<string>() };
    this.current = current;
    try { await this.plugin.presentAR({ sessionId: current.id, scene: checked }); }
    catch (error) {
      if (this.current === current) this.current = null;
      await this.plugin.closeAR({ sessionId: current.id });
      throw error;
    }
    if (generation !== this.generation) await this.plugin.closeAR({ sessionId: current.id });
  }
  receive(event: NativeEvent) {
    const current = this.current;
    try { validateNativeIdentity(event?.identity); } catch { return; }
    if (!current || event.version !== 1 || event.sessionId !== current.id || !sameIdentity(event.identity, current.scene.identity) || !id(event.eventId) || current.events.has(event.eventId)) return;
    if (!["funding-intent", "closed", "tracking", "background", "resumed", "error"].includes(event.kind)) return;
    if(event.kind==='funding-intent'&&current.scene.fundingEnabled===false)return;
    current.events.add(event.eventId);
    if (event.kind === "closed") this.current = null;
    if (event.kind === "funding-intent"&&current.scene.fundingEnabled!==false) this.review({ id: event.eventId, identity: structuredClone(current.scene.identity), returnPath: current.scene.returnPath });
    this.onState(event);
  }
  /** Caller supplies a recovered accepted canonical receipt, never a pending gesture. */
  async accepted(input: { identity: NativeIdentity; receiptId: string; backing: NativeBacking; kind: "contribution" | "earmark" | "release" | "target-change" | "reversal"; status: "accepted" }) {
    const current = this.current;
    if (!current || input.status !== "accepted" || !sameIdentity(current.scene.identity, input.identity) || !id(input.receiptId) || current.receipts.has(input.receiptId)) return;
    const backing = validateNativeBacking(input.backing);
    await this.plugin.updateAccepted({ sessionId: current.id, identity: current.scene.identity, receiptId: input.receiptId, backing, animate: input.kind === "contribution" });
    if (this.current !== current) return;
    current.receipts.add(input.receiptId); current.scene.backing = backing;
  }
  async leaveScope() { ++this.generation; const current = this.current; this.current = null; if (current) await this.plugin.closeAR({ sessionId: current.id }); }
  async resume() { if (this.current) await this.plugin.resumeAR({ sessionId: this.current.id }); }
  async dispose() { await this.leaveScope(); await this.connecting; await this.listener?.remove(); this.listener = null; }
}

/** Supabase-compatible async storage backed by Keychain / Android Keystore encryption. */
export function nativeAuthStorage(plugin: NativePlugin) {
  const key = (input: string) => { assert(/^[A-Za-z0-9:._-]{1,180}$/.test(input), "Invalid native session storage key."); return input; };
  return {
    getItem: async (name: string) => (await plugin.secureGet({ key: key(name) })).value,
    setItem: async (name: string, value: string) => { assert(value.length <= 32768, "Native session record is too large."); await plugin.secureSet({ key: key(name), value }); },
    removeItem: async (name: string) => plugin.secureRemove({ key: key(name) }),
  };
}
export function consumeNativeAuthCode(callbackUrl: string, expectedState: string): string {
  const url = new URL(callbackUrl);
  assert(url.protocol === "hearthside:" && url.hostname === "auth" && url.pathname === "/callback" && !url.hash && url.searchParams.get("state") === expectedState && url.searchParams.getAll("state").length === 1 && url.searchParams.getAll("code").length === 1, "The native sign-in return does not match this session.");
  const code = url.searchParams.get("code"); assert(code && code.length <= 4096 && !url.searchParams.has("access_token"), "Native sign-in requires a PKCE authorization code."); return code;
}
/** Use with the existing SDK's PKCE URL builder and exchangeCodeForSession. */
export async function beginNativePkce(plugin: NativePlugin, createAuthorizationURL: (redirectTo: string) => Promise<string>): Promise<string> {
  const state = [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  await plugin.secureSet({ key: "native-pkce-state", value: JSON.stringify({ state, expiresAt: Date.now() + 600000 }) });
  const redirectTo = `hearthside://auth/callback?state=${state}`;
  const url = await createAuthorizationURL(redirectTo);
  assert(new URL(url).protocol === "https:", "Native authentication requires the secure system browser.");
  const result = await plugin.authenticate({ url, state });
  const code = consumeNativeAuthCode(result.callbackUrl, state);
  await plugin.consumeAuthCallback(); await plugin.secureRemove({ key: "native-pkce-state" }); return code;
}
export async function recoverNativePkce(plugin: NativePlugin): Promise<string | null> {
  const saved = (await plugin.secureGet({ key: "native-pkce-state" })).value;
  if (!saved) return null;
  const pending = JSON.parse(saved) as { state: string; expiresAt: number };
  if (pending.expiresAt < Date.now()) { await plugin.cancelAuthentication(); await plugin.secureRemove({ key: "native-pkce-state" }); return null; }
  const { callbackUrl } = await plugin.consumeAuthCallback();
  if (!callbackUrl) return null;
  const code = consumeNativeAuthCode(callbackUrl, pending.state); await plugin.secureRemove({ key: "native-pkce-state" }); return code;
}
