import {hasPlayData,isPlayStep} from '../core/herculesPlay.ts';
import { hasGoalEnvelopeData } from "../core/goalEnvelopes.ts";
import { hasPlanDecisionData } from "../core/planSystem.ts";
import { hasTaskData, TASK_COMMAND_KINDS } from "../core/tasks.ts";
import {companionActionEffect} from '../core/herculesCompanionActions.ts';
import { previewFor, visiblePreviews, type PendingPreview, type RejectedEntry } from "./optimistic.ts";
import { IncrementalBooksGuard } from "../core/booksValidation.ts";
import type { Household, CommitResult } from "../core/types.ts";
import { assembleHousehold } from "../core/sync.ts";
import { validatedLedgerBooksStatus } from "./validatedBooks.ts";
import type { BooksStatus } from "../ledger/engine.ts";
import { financialAuditHash } from "../core/commandIdentity.ts";
import { capturedIntent, clearCapturedIntent } from "./capture.ts";
import { canonical, project, digest } from "./patch.ts";
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
  adopt: (household: Household, validatedStatus?: BooksStatus, pending?: PendingPreview[]) => Promise<void>;
  status: (status: SyncStatus, message?: string) => void;
  pendingChanged?: (pending: PendingPreview[]) => void;
  rejectedChanged?: (entries: RejectedEntry[]) => void;
};
export class LedgerCommandRejectedError extends Error {}
export class LedgerSyncClient {
  private booksGuard = new IncrementalBooksGuard();
  private verified = new WeakMap<Replica, { household: Household; status: BooksStatus }>();
  private store?: LedgerStore;
  private localReady?: Promise<void>;
  private previews = new Map<string, PendingPreview>();
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
  private confirmationIntents = new Map<string,string>();
  private confirming = new Map<string,Promise<CommitResult>>();
  private ready = false;
  private companionProfileVersion = 0;
  private companionPlayVersion = 0;
  private companionDiscoveryVersion = 0;
  private companionWardrobeVersion = 0;
  private companionWorkflowVersion = 0;
  private herculesActionsEnabled = false;
  private nativeCalendarVersion = 0;
  private taskPlannerVersion = 0;
  private planDecisionVersion = 0;
  private goalEnvelopeVersion = 0;
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
    this.localReady = this.initializeLocal();
    await this.localReady;
    if (this.stopped) return;
    window.addEventListener("online", this.online);
    window.addEventListener("offline", this.offline);
    const initial = new Promise<void>((resolve, reject) => { this.initialResolve = resolve; this.initialReject = reject; });
    void this.connect();
    return initial;
  }
  private async initializeLocal() {
    this.store = await LedgerStore.open(this.options.scope);
    if (this.stopped) {
      this.store.close();
      return;
    }
    const saved = await this.store.load();
    this.options.rejectedChanged?.(await this.store.rejected());
    this.replica = saved.replica;
    for (const preview of saved.previews) this.previews.set(preview.commandId, preview);
    for (const command of saved.pending) this.pending.set(command.id, command);
    if (this.replica)
      try {
        const accepted = await this.household(this.replica);
        for (const preview of visiblePreviews(this.previews.values(), this.replica.sequence)) {
          this.booksGuard.fork().validate({ ...accepted, transactions: [...accepted.transactions, ...preview.rows] });
        }
        await this.publish(this.replica);
      } catch {
        this.replica = undefined;
      }
  }
  private pendingRows() {
    return visiblePreviews(this.previews.values(), this.replica?.sequence ?? 0);
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
                  const error = message.definitive === true ? new LedgerCommandRejectedError(message.message ?? message.code) : new Error(message.message ?? message.code);
                  if (message.definitive === true) {
                    if (this.inFlight === message.id) this.inFlight = undefined;
                    await this.store!.reject(message.id, error.message);
                    this.options.rejectedChanged?.(await this.store!.rejected());
                    this.previews.delete(message.id);
                    this.options.pendingChanged?.(this.pendingRows());
                    this.waiters.get(message.id)?.reject(error);
                    this.waiters.delete(message.id);
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
              await this.household(replica);
              const covered = await this.resolveSnapshotPreviews(replica);
              await this.store!.save(replica, covered);
              for (const id of covered) { const preview = this.previews.get(id); if (preview) this.previews.set(id, {...preview, acceptedSequence: replica.sequence}); }
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
              this.companionProfileVersion = message.companionProfileVersion === 1 ? 1 : 0;
              this.companionPlayVersion = message.companionPlayVersion === 1 ? 1 : 0;
              this.companionDiscoveryVersion = message.companionDiscoveryVersion === 1 ? 1 : 0;
              this.companionWardrobeVersion = message.companionWardrobeVersion === 1 ? 1 : 0;
              this.companionWorkflowVersion = message.companionWorkflowVersion === 1 ? 1 : 0;
              this.herculesActionsEnabled = message.herculesActionsEnabled === true;
              this.nativeCalendarVersion = message.nativeCalendarVersion === 1 ? 1 : 0;
              this.taskPlannerVersion = message.taskPlannerVersion === 1 ? 1 : 0;
              this.goalEnvelopeVersion = message.goalEnvelopeVersion === 1 ? 1 : 0;
              this.planDecisionVersion = message.planDecisionVersion === 1 ? 1 : 0;
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
              const acknowledgedCommand=this.pending.get(receipt.id);
              if(acknowledgedCommand)this.confirmationIntents.set(receipt.id,canonical(acknowledgedCommand.steps.map(({kind,args})=>({kind,args}))));
              this.pending.delete(receipt.id);
              this.previews.delete(receipt.id);
              this.options.pendingChanged?.(this.pendingRows());
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
              if (this.accepted.size > 100) {
                const oldest=this.accepted.keys().next().value!;
                this.accepted.delete(oldest);this.confirmationIntents.delete(oldest);
              }
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
    this.validateScope(r);
    const known = this.verified.get(r);
    if (known) return known.household;
    const h = assembleHousehold(r.shared, r.personal, { linked: true });
    h.revision = r.sequence;
    h.baseRevision = r.sequence;
    h.sharing = {
      ...h.sharing!,
      mode: "synchronized",
      pending: false,
      lastError: null,
    };
    const status = validatedLedgerBooksStatus(h, this.booksGuard);
    h.booksAcceptedHash = await financialAuditHash(h);
    clearCapturedIntent(h);
    this.verified.set(r, { household: h, status });
    return h;
  }
  private async publish(r: Replica) {
    if (!this.stopped) {
      const household = await this.household(r);
      if (!this.stopped) await this.options.adopt(household, this.verified.get(r)!.status, visiblePreviews(this.previews.values(), r.sequence));
    }
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
    await this.household(next);
    const commandId = event.confirmation?.commandId;
    if (commandId && event.memberId !== this.options.scope.memberId) throw new Error("SCOPE_MISMATCH");
    await this.store!.save(next, commandId ? [commandId] : []);
    if (commandId) { const preview = this.previews.get(commandId); if (preview) this.previews.set(commandId, { ...preview, acceptedSequence: next.sequence }); }
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
  private async resolveSnapshotPreviews(replica: Replica): Promise<string[]> {
    const covered: string[] = [];
    for (const [id, preview] of this.previews) {
      if (preview.acceptedSequence !== undefined && preview.acceptedSequence <= replica.sequence) continue;
      const response = await fetch(this.path(`receipt?id=${encodeURIComponent(id)}`), { headers: { Authorization: `Bearer ${await this.options.token()}` } });
      const value = await response.json();
      if (!response.ok) { if (value.error === "RECEIPT_NOT_FOUND") continue; throw new Error(value.error ?? "RECEIPT_RECOVERY_FAILED"); }
      if (value.version === 1 && value.reserved === true && value.confirmationId === id) {
        await this.store!.reject(id, "This confirmation identity belongs to an imported entry. Review the retained draft before a new Confirm.");
        this.previews.delete(id); this.pending.delete(id);
        this.waiters.get(id)?.reject(new LedgerCommandRejectedError("IMPORTED_CONFIRMATION_EXISTS"));this.waiters.delete(id);
        this.options.rejectedChanged?.(await this.store!.rejected());
        continue;
      }
      if (value.version !== 2 || value.receipt?.id !== id || value.receipt.actor !== this.options.scope.memberId) throw new Error("RECEIPT_RECOVERY_REQUIRED");
      if (value.receipt.sequence <= replica.sequence) covered.push(id);
    }
    return covered;
  }
  async confirm(candidate: Household, id: string, onQueued?: () => void): Promise<CommitResult> {
    await this.localReady;
    if (this.stopped || !this.store || !this.replica) throw new Error("LOCAL_REPLICA_REQUIRED");
    const capture = capturedIntent(candidate);
    if (!capture) throw new Error("This action needs a registered ledger command. Nothing was posted.");
    const intent=canonical(capture.steps.map(({kind,args})=>({kind,args})));
    const pending=this.pending.get(id);
    const existingIntent=this.confirmationIntents.get(id) ?? (pending ? canonical(pending.steps.map(({kind,args})=>({kind,args}))) : undefined);
    if(existingIntent && existingIntent!==intent) throw new LedgerCommandRejectedError("CONFIRMATION_REVIEW_CHANGED");
    const prior=this.accepted.get(id);
    if(prior)return prior;
    const inProgress=this.confirming.get(id);
    if(inProgress)return inProgress;
    this.confirmationIntents.set(id,intent);
    const result=this.queueConfirmation(candidate,id,onQueued);
    this.confirming.set(id,result);
    try{return await result;}finally{if(this.confirming.get(id)===result)this.confirming.delete(id);}
  }
  private async queueConfirmation(candidate:Household,id:string,onQueued?:()=>void):Promise<CommitResult> {
    const capture=capturedIntent(candidate)!;
    if (hasGoalEnvelopeData(candidate) && this.goalEnvelopeVersion !== 1) throw new LedgerCommandRejectedError("KITTY_UPDATE_REQUIRED: Connect to updated Hearth before saving this bank. Your review remains open.");
    const extendedPlan = hasPlanDecisionData(candidate) || capture.steps.some(step => {
      const input = step.args[0] as { lines?: Array<{ decision?: unknown }>; changedLines?: Array<{ decision?: unknown }>; changedAssumptions?: unknown; checkpoint?: unknown; outcomes?: Array<{ evidenceIds?: unknown }>; planReference?: unknown } | undefined;
      return (input?.lines ?? input?.changedLines ?? []).some(line => line.decision) || input?.changedAssumptions !== undefined || input?.checkpoint !== undefined || input?.outcomes?.some(row => row.evidenceIds) || input?.planReference;
    });
    if (extendedPlan && this.planDecisionVersion !== 1) throw new LedgerCommandRejectedError("PLAN_UPDATE_REQUIRED: Connect to the updated Hearth before saving these Plan decisions. Keep this draft open and retry after connecting.");

    if(capture.steps.some(s=>s.kind==='executeHerculesAction')&&(!this.ready||!this.herculesActionsEnabled))throw new LedgerCommandRejectedError('HERCULES_ACTIONS_PAUSED: Conversational changes are not enabled on this Hearth server.');
    if(capture.steps.some(s=>s.kind==='saveNativeEvent')&&(!this.ready||this.nativeCalendarVersion!==1))throw new LedgerCommandRejectedError('CALENDAR_UPDATE_REQUIRED: Connect to an updated Hearth to save events.');
    if((hasTaskData(candidate)||capture.steps.some(s=>TASK_COMMAND_KINDS.includes(s.kind)))&&(!this.ready||this.taskPlannerVersion!==1))throw new LedgerCommandRejectedError('PLANNER_UPDATE_REQUIRED: Connect to an updated Hearth to save planner tasks.');
    if(capture.steps.some(s=>['executeHerculesAction','cancelHerculesSubmission'].includes(s.kind)||s.kind==='commitCompanion'&&(s.args[0] as {operation?:{kind?:string}})?.operation?.kind==='workflow.set')&&(!this.ready||this.companionWorkflowVersion!==1))throw new LedgerCommandRejectedError('HERCULES_UPDATE_REQUIRED: Connect to an updated Hearth before saving conversational drafts.');
    if(capture.steps.some(step=>companionActionEffect(step)!==null||step.kind==='commitCompanionGallery'||(step.kind==='commitCompanion'&&String((step.args[0] as {operation?:{kind?:string}})?.operation?.kind).startsWith('look.')))&&(!this.ready||this.companionWardrobeVersion!==1))throw new LedgerCommandRejectedError('HERCULES_UPDATE_REQUIRED: Connect to an updated Hearth before saving or sharing looks.');
    if (capture.steps.some(step => step.kind === "commitCompanion") && (!this.ready || this.companionProfileVersion !== 1)) {
      throw new LedgerCommandRejectedError("HERCULES_UPDATE_REQUIRED: Connect to an updated Hearth before saving Hercules preferences or conversations.");
    }
    if (capture.steps.some(step => step.kind === "commitCompanion" && (step.args[0] as { operation?: { kind?: string } })?.operation?.kind === "suggestion.set") && this.companionDiscoveryVersion !== 1) {
      throw new LedgerCommandRejectedError("HERCULES_UPDATE_REQUIRED: Connect to an updated Hearth before saving suggestions.");
    }
    if ((hasPlayData(candidate) || capture.steps.some(isPlayStep)) && (!this.ready || this.companionPlayVersion!==1)) throw new LedgerCommandRejectedError('PLAY_UPDATE_REQUIRED: Connect to the updated Hearth to save this room.');
    const replica=this.replica;
    if(!replica)throw new Error("LOCAL_REPLICA_REQUIRED");
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
    // Blocking accounting validation before either visibility or queue durability.
    this.booksGuard.fork().validate(candidate);
    const preview = this.previews.get(id) ?? previewFor(candidate, await this.household(replica), command, this.options.scope.memberId);
    await this.store!.enqueue(command, preview);
    if (this.stopped) throw new Error("SCOPE_CLOSED");
    if (preview) this.previews.set(id, preview);
    this.pending.set(id, command);
    this.options.status("saving");
    this.options.pendingChanged?.(this.pendingRows());
    if (preview) onQueued?.();
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
  /** Read a submitted draft's authority without recomputing or reposting its money. */
  async submissionStatus(id: string): Promise<"accepted" | "pending" | "rejected" | "missing"> {
    await this.localReady;
    if (this.stopped || !this.store) throw new Error("SCOPE_CLOSED");
    if (this.accepted.has(id)) return "accepted";
    const response = await fetch(this.path(`receipt?id=${encodeURIComponent(id)}`), { headers: { Authorization: `Bearer ${await this.options.token()}` } });
    const value = await response.json();
    if (this.stopped) throw new Error("SCOPE_CLOSED");
    if (response.ok) {
      if (value.version !== 2 || value.receipt?.id !== id || value.receipt.actor !== this.options.scope.memberId) throw new Error("RECEIPT_RECOVERY_REQUIRED");
      return "accepted";
    }
    if (value.error !== "RECEIPT_NOT_FOUND") throw new Error(value.error ?? "RECEIPT_RECOVERY_FAILED");
    if (this.pending.has(id)) return "pending";
    const rejected = await this.store.rejected();
    if (this.stopped) throw new Error("SCOPE_CLOSED");
    return rejected.some(row => row.command.id === id) ? "rejected" : "missing";
  }
  async verifyImport() {
    const response=await fetch(this.path('parity'),{method:'POST',headers:{Authorization:`Bearer ${await this.options.token()}`}});
    const report=await response.json();if(!response.ok)throw new Error(report.error??'IMPORT_PROOF_FAILED');return report;
  }
  async dismissRejected(id: string) {
    await this.localReady; await this.store!.dismissRejected(id);
    if(!this.stopped)this.options.rejectedChanged?.(await this.store!.rejected());
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
