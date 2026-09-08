import type { AppearanceAccount } from "./appearanceAccount.ts";
import { DEFAULT_APPEARANCE, parseAppearance, type Appearance, type AppearanceScope, type ThemeId, type ThemeAccessory } from "./scenes.ts";

export type AppearanceSnapshot = {
  saved: Appearance; preview: ThemeId | null;
  status: "local" | "loading" | "saved" | "pending" | "error";
  message: string;
};
type Cache = { appearance: Appearance; pending: boolean; changes?: Partial<Appearance> };
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export const appearanceCacheKey = (scope: AppearanceScope): string => `hearth:appearance:v1:${scope.environment}:${scope.userId ?? "guest"}`;
export const INITIAL_APPEARANCE: AppearanceSnapshot = { saved: DEFAULT_APPEARANCE, preview: null, status: "local", message: "" };

/** Owns cosmetics only. Generation and serial writes protect both accounts and rapid selections. */
export class AppearanceStore {
  private scope: AppearanceScope = { environment: "development", userId: null };
  private value: AppearanceSnapshot = INITIAL_APPEARANCE;
  private listeners = new Set<() => void>();
  private generation = 0;
  private revision = 0;
  private pending = false;
  private changes: Partial<Appearance> = {};
  private flight: AbortController | null = null;
  private readFlight: AbortController | null = null;
  private connected = false;
  constructor(private account: AppearanceAccount, private storage: StorageLike | null, private online: () => boolean = () => typeof navigator === "undefined" || navigator.onLine) {}
  getSnapshot = (): AppearanceSnapshot => this.value;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(update: Partial<AppearanceSnapshot>): void {
    this.value = { ...this.value, ...update };
    this.listeners.forEach(listener => listener());
  }
  connect(scope: AppearanceScope): void {
    if (this.connected && appearanceCacheKey(scope) === appearanceCacheKey(this.scope)) return;
    this.disconnect();
    this.connected = true;
    this.scope = { ...scope };
    let cached: Cache = { appearance: DEFAULT_APPEARANCE, pending: false };
    try {
      const raw = this.storage?.getItem(appearanceCacheKey(scope));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Cache>;
        cached = { appearance: parseAppearance(parsed.appearance), pending: parsed.pending === true, changes: parsed.changes };
      }
    } catch { /* An unavailable cache must never stop the kitchen. */ }
    this.pending = cached.pending && Boolean(scope.userId);
    this.changes = this.pending ? allowlistedChanges(cached.changes ?? cached.appearance) : {};
    this.publish({ saved: cached.appearance, preview: null, status: this.pending ? "pending" : scope.userId ? this.online() ? "loading" : "error" : "local", message: scope.userId && !this.online() && !this.pending ? "Offline. Your cached look is ready; account appearance will be checked when you reconnect." : "" });
    void this.refresh();
  }
  disconnect(): void {
    this.connected = false;
    this.generation++;
    this.revision++;
    this.flight?.abort(); this.flight = null;
    this.readFlight?.abort(); this.readFlight = null;
  }
  preview = (theme: ThemeId): void => this.publish({ preview: parseAppearance({ theme }).theme });
  cancelPreview = (): void => { if (this.value.preview !== null) this.publish({ preview: null }); };
  apply = (theme: ThemeId): void => this.save({ theme });
  setAtmosphere = (atmosphere: boolean): void => this.save({ atmosphere }, false);
  setAccessoryHidden = (slot: ThemeAccessory, hidden: boolean): void => {
    this.save(slot === "hat" ? { hideThemeHat: hidden } : { hideThemeNeck: hidden }, false);
  };
  private save(value: Partial<Appearance>, clearPreview = true): void {
    this.revision++;
    this.changes = { ...this.changes, ...allowlistedChanges(value) };
    this.pending = Boolean(this.scope.userId);
    this.readFlight?.abort(); this.readFlight = null;
    this.publish({ saved: parseAppearance({ ...this.value.saved, ...this.changes }), ...(clearPreview ? { preview: null } : {}), status: this.pending ? "pending" : "local", message: "" });
    this.cache();
    void this.flush();
  }
  private cache(): void {
    try { this.storage?.setItem(appearanceCacheKey(this.scope), JSON.stringify({ appearance: this.value.saved, pending: this.pending, changes: this.changes })); }
    catch { /* In-memory selection remains usable in private browsing. */ }
  }
  refresh = async (): Promise<void> => {
    if (!this.connected || !this.scope.userId || !this.online()) return;
    if (this.pending) { await this.flush(); return; }
    if (this.readFlight) return;
    const generation = this.generation;
    const revision = this.revision;
    const controller = new AbortController();
    this.readFlight = controller;
    try {
      const saved = await this.account.read(this.scope, controller.signal);
      if (controller.signal.aborted || generation !== this.generation || revision !== this.revision) return;
      this.publish({ saved: parseAppearance(saved), status: "saved", message: "" });
      this.cache();
    } catch {
      if (controller.signal.aborted || generation !== this.generation || revision !== this.revision) return;
      this.publish({ status: "error", message: "Your current look is ready. Account appearance could not be checked." });
    } finally { if (this.readFlight === controller) this.readFlight = null; }
  };
  private async flush(): Promise<void> {
    if (!this.connected || !this.pending || this.flight || !this.scope.userId || !this.online()) return;
    const generation = this.generation;
    const revision = this.revision;
    const controller = new AbortController();
    this.flight = controller;
    try {
      const saved = await this.account.write({ ...this.scope }, { ...this.changes }, controller.signal);
      if (controller.signal.aborted || generation !== this.generation || revision !== this.revision) return;
      this.pending = false;
      this.changes = {};
      this.publish({ saved: parseAppearance(saved), status: "saved", message: "" });
      this.cache();
    } catch {
      if (controller.signal.aborted || generation !== this.generation || revision !== this.revision) return;
      this.publish({ status: "error", message: "Saved on this device. Retry to save this look to your account." });
    } finally {
      if (this.flight === controller) this.flight = null;
      // A superseded failure must not strand the newer queued choice. Only a
      // different revision retries automatically; a same-revision error waits.
      if (this.connected && generation === this.generation && revision !== this.revision) void this.flush();
    }
  }
}

function allowlistedChanges(raw: unknown): Partial<Appearance> {
  const value = raw && typeof raw === "object" ? raw as Partial<Appearance> : {};
  return { ...(value.theme !== undefined ? { theme: parseAppearance(value).theme } : {}), ...(typeof value.atmosphere === "boolean" ? { atmosphere: value.atmosphere } : {}), ...(typeof value.hideThemeHat === "boolean" ? { hideThemeHat: value.hideThemeHat } : {}), ...(typeof value.hideThemeNeck === "boolean" ? { hideThemeNeck: value.hideThemeNeck } : {}) };
}
