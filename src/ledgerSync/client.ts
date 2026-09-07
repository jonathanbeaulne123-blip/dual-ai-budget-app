import type { Household, CommitResult } from "../core/types.ts";
import { assembleHousehold } from "../core/sync.ts";
import { assertAcceptableBooks } from "../core/commandRuntime.ts";
import { financialAuditHash } from "../core/commandIdentity.ts";
import { capturedIntent, clearCapturedIntent } from "./capture.ts";
import { project, digest } from "./patch.ts";
import {
  commandFromCapture,
  type Scope,
  type Replica,
  type LedgerCommand,
  type AcceptedEvent,
  type Receipt,
} from "./protocol.ts";
import { LedgerStore } from "./localStore.ts";
import { encodeMessage, MessageReader, WINDOW, retryDelay } from "./wire.ts";
export type SyncStatus =
  | "connecting"
  | "ready"
  | "offline"
  | "saving"
  | "recovery"
  | "error";
export type ClientOptions = {
  scope: Pick<Scope, "environment" | "householdId" | "memberId" | "subject">;
  token: () => Promise<string>;
  adopt: (household: Household) => Promise<void>;
  status: (status: SyncStatus, message?: string) => void;
};
export class LedgerSyncClient {
  private store?: LedgerStore;
  private replica?: Replica;
  private socket?: WebSocket;
  private generation = 0;
  private stopped = false;
  private connecting = false;
  private inFlight?: string;
  private attempt = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private renewal?: ReturnType<typeof setTimeout>;
  private receive = Promise.resolve();
  private sending = Promise.resolve();
  private pending = new Map<string, LedgerCommand>();
  private waiters = new Map<
    string,
    { resolve: (value: CommitResult) => void; reject: (error: Error) => void }
  >();
  private accepted = new Map<string, CommitResult>();
  private ready = false;
  private initialResolve?: () => void;
  private initialReject?: (e: Error) => void;
  constructor(readonly options: ClientOptions) {}
  private path(action: string) {
    const s = this.options.scope;
    return `/ledger-sync/v2/${s.environment}/${s.householdId}/${action}`;
  }
  private online = () => {
    if (!this.stopped) {
      clearTimeout(this.retry);
      this.retry = undefined;
      this.disconnect();
      void this.connect();
    }
  };
  private offline = () => {
    clearTimeout(this.retry);
    this.retry = undefined;
    this.disconnect();
    this.options.status(
      "offline",
      "Changes stay on this device until the connection returns.",
    );
  };
  async start() {
    this.store = await LedgerStore.open(this.options.scope);
    if (this.stopped) {
      this.store.close();
      return;
    }
    const saved = await this.store.load();
    this.replica = saved.replica;
    for (const command of saved.pending) this.pending.set(command.id, command);
    if (this.replica)
      try {
        await this.publish(this.replica);
      } catch {
        this.replica = undefined;
      }
    window.addEventListener("online", this.online);
    window.addEventListener("offline", this.offline);
    const initial = new Promise<void>((resolve, reject) => {
      this.initialResolve = resolve;
      this.initialReject = reject;
    });
    void this.connect();
    return initial;
  }
  private async ticket() {
    const response = await fetch(this.path("ticket"), {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.options.token()}` },
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "UNAUTHENTICATED");
    const scope = value.scope as Scope;
    if (
      scope.environment !== this.options.scope.environment ||
      scope.householdId !== this.options.scope.householdId ||
      scope.memberId !== this.options.scope.memberId ||
      scope.subject !== this.options.scope.subject
    )
      throw new Error("SCOPE_MISMATCH");
    return value as { ticket: string; scope: Scope };
  }
  private async connect() {
    if (this.stopped || this.connecting || !navigator.onLine) return;
    this.connecting = true;
    const generation = ++this.generation;
    this.options.status("connecting");
    try {
      const ticket = await this.ticket();
      if (generation !== this.generation || this.stopped) return;
      const ws = new WebSocket(
          `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${this.path("socket")}`,
        ),
        reader = new MessageReader();
      this.socket = ws;
      ws.binaryType = "arraybuffer";
      ws.onopen = () =>
        ws.send(JSON.stringify({ type: "auth", ticket: ticket.ticket }));
      ws.onmessage = (event) => {
        this.receive = this.receive
          .then(async () => {
            if (generation !== this.generation || this.stopped) return;
            if (typeof event.data === "string") {
              const message = JSON.parse(event.data);
              if (message.type === "authenticated") {
                if (!this.ready)
                  await this.send(
                    { type: "resume", sequence: this.replica?.sequence ?? 0 },
                    generation,
                  );
                return;
              }
              if (message.type === "error") {
                if (message.id) {
                  const error = new Error(message.message ?? message.code);
                  if (message.definitive === true) {
                    if (this.inFlight === message.id) this.inFlight = undefined;
                    this.waiters.get(message.id)?.reject(error);
                    this.waiters.delete(message.id);
                    await this.store!.acknowledge(message.id);
                    this.pending.delete(message.id);
                    await this.sendPending();
                    this.options.status("error", error.message);
                    return;
                  }
                  throw error;
                }
                throw new Error(message.code);
              }
              return;
            }
            const bytes = event.data as ArrayBuffer;
            const message = (await reader.accept(bytes)) as any;
            ws.send(
              JSON.stringify({ type: "credit", bytes: bytes.byteLength }),
            );
            if (!message) return;
            if (message.type === "snapshot") {
              const replica = message.replica as Replica;
              if (this.replica && this.pending.size)
                await this.store!.recover(this.replica);
              this.validateScope(replica);
              await this.store!.save(replica);
              await this.publish(replica);
              this.replica = replica;
            } else if (message.type === "event")
              await this.event(message.event as AcceptedEvent);
            else if (message.type === "ready") {
              if (message.sequence !== this.replica?.sequence)
                throw new Error("SEQUENCE_GAP");
              if (message.hash !== (await digest(this.replica))) {
                this.replica = undefined;
                throw new Error("REPLICA_CHECKSUM");
              }
              this.ready = true;
              this.attempt = 0;
              this.options.status(this.pending.size ? "saving" : "ready");
              this.initialResolve?.();
              this.initialResolve = undefined;
              await this.sendPending();
            } else if (message.type === "ack") {
              const receipt = message.receipt as Receipt;
              if (!this.replica || receipt.sequence > this.replica.sequence)
                throw new Error("SEQUENCE_GAP");
              await this.store!.acknowledge(receipt.id);
              this.pending.delete(receipt.id);
              if (this.inFlight === receipt.id) this.inFlight = undefined;
              const household = await this.household(this.replica),
                result: CommitResult = {
                  household,
                  postedIds: receipt.postedIds,
                  warnings: receipt.warnings,
                  undo: { ...receipt.undo, snapshot: household },
                  ...(receipt.persistenceScope
                    ? {
                        persistenceScope: receipt.persistenceScope,
                        personalMemberId: receipt.personalMemberId,
                      }
                    : {}),
                };
              this.accepted.set(receipt.id, result);
              if (this.accepted.size > 100)
                this.accepted.delete(this.accepted.keys().next().value!);
              this.waiters.get(receipt.id)?.resolve(result);
              this.waiters.delete(receipt.id);
              this.options.status(this.pending.size ? "saving" : "ready");
              await this.sendPending();
            }
          })
          .catch((error) => {
            if (generation === this.generation) {
              this.options.status(
                "recovery",
                error instanceof Error ? error.message : String(error),
              );
              this.disconnect();
              this.schedule();
            }
          });
      };
      ws.onclose = () => {
        if (generation === this.generation) {
          this.ready = false;
          this.inFlight = undefined;
          this.options.status("offline");
          this.schedule();
        }
      };
      ws.onerror = () => ws.close();
      this.renewal = setTimeout(() => {
        void this.renew(generation);
      }, 40000);
    } catch (error) {
      if (generation === this.generation) {
        this.options.status(
          "error",
          error instanceof Error ? error.message : String(error),
        );
        this.schedule();
      }
    } finally {
      if (generation === this.generation) this.connecting = false;
    }
  }
  private validateScope(r: Replica) {
    const scope = this.options.scope;
    if (
      !Number.isSafeInteger(r.sequence) ||
      r.sequence < 0 ||
      r.shared.environment !== scope.environment ||
      r.shared.householdId !== scope.householdId ||
      r.personal.memberId !== scope.memberId
    )
      throw new Error("SCOPE_MISMATCH");
  }
  private async household(r: Replica) {
    const h = assembleHousehold(r.shared, r.personal, { linked: true });
    h.revision = r.sequence;
    h.baseRevision = r.sequence;
    h.sharing = {
      ...h.sharing!,
      mode: "synchronized",
      pending: false,
      lastError: null,
    };
    assertAcceptableBooks(h);
    h.booksAcceptedHash = await financialAuditHash(h);
    clearCapturedIntent(h);
    return h;
  }
  private async publish(r: Replica) {
    if (!this.stopped) await this.options.adopt(await this.household(r));
  }
  private async event(event: AcceptedEvent) {
    if (!this.replica) throw new Error("SEQUENCE_GAP");
    if (event.sequence <= this.replica.sequence) return;
    if (event.sequence !== this.replica.sequence + 1)
      throw new Error("SEQUENCE_GAP");
    if (event.personal && event.memberId !== this.options.scope.memberId)
      throw new Error("SCOPE_MISMATCH");
    const next: Replica = {
      sequence: event.sequence,
      shared: project(this.replica.shared, event.shared),
      personal: event.personal
        ? project(this.replica.personal, event.personal)
        : this.replica.personal,
    };
    this.validateScope(next);
    await this.store!.save(next);
    await this.publish(next);
    this.replica = next;
  }
  private send(value: unknown, generation = this.generation) {
    const next = this.sending.then(async () => {
      for (const buffer of await encodeMessage(value)) {
        while (
          this.socket?.bufferedAmount &&
          this.socket.bufferedAmount > WINDOW
        ) {
          if (generation !== this.generation || this.stopped)
            throw new Error("DISCONNECTED");
          await new Promise((r) => setTimeout(r, 10));
        }
        if (
          generation !== this.generation ||
          this.socket?.readyState !== WebSocket.OPEN
        )
          throw new Error("DISCONNECTED");
        this.socket.send(buffer);
      }
    });
    this.sending = next.catch(() => {});
    return next;
  }
  private async sendPending() {
    if (!this.ready || this.inFlight) return;
    const command = this.pending.values().next().value;
    if (!command) return;
    this.inFlight = command.id;
    await this.send({ type: "command", command });
  }
  async confirm(candidate: Household, id: string): Promise<CommitResult> {
    const prior = this.accepted.get(id);
    if (prior) return prior;
    const capture = capturedIntent(candidate);
    if (!capture)
      throw new Error(
        "This action needs a registered ledger command. Nothing was posted.",
      );
    const command =
      this.pending.get(id) ??
      (await commandFromCapture(
        capture,
        {
          environment: this.options.scope.environment,
          householdId: this.options.scope.householdId,
        },
        id,
      ));
    await this.store!.enqueue(command);
    this.pending.set(id, command);
    this.options.status("saving");
    const result = new Promise<CommitResult>((resolve, reject) =>
      this.waiters.set(id, { resolve, reject }),
    );
    if (this.ready) void this.sendPending().catch(() => this.online());
    else if (
      navigator.onLine &&
      !this.retry &&
      !this.socket &&
      !this.connecting
    )
      void this.connect();
    return result;
  }
  result(id: string) {
    return this.accepted.get(id);
  }
  retryPending(forceSnapshot = false) {
    if (forceSnapshot) this.replica = undefined;
    this.online();
  }
  private async renew(generation: number) {
    try {
      const ticket = await this.ticket();
      if (generation !== this.generation) return;
      this.socket?.send(
        JSON.stringify({ type: "auth", ticket: ticket.ticket }),
      );
      this.renewal = setTimeout(() => {
        void this.renew(generation);
      }, 40000);
    } catch {
      if (generation === this.generation) {
        this.disconnect();
        this.schedule();
      }
    }
  }
  private schedule() {
    if (this.stopped || this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = undefined;
      void this.connect();
    }, retryDelay(this.attempt++));
  }
  private disconnect() {
    this.generation++;
    this.connecting = false;
    this.inFlight = undefined;
    this.ready = false;
    clearTimeout(this.renewal);
    this.socket?.close();
  }
  async destroy() {
    this.stopped = true;
    this.disconnect();
    clearTimeout(this.retry);
    window.removeEventListener("online", this.online);
    window.removeEventListener("offline", this.offline);
    await this.receive;
    this.store?.close();
    this.initialReject?.(new Error("SCOPE_CLOSED"));
    for (const waiter of this.waiters.values())
      waiter.reject(new Error("SCOPE_CLOSED"));
    this.waiters.clear();
  }
}
