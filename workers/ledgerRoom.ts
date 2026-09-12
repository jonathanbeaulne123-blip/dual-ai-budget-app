/// <reference path="./ledger-platform.d.ts" />
import {herculesActionsEnabled} from '../src/core/herculesActionPolicy.ts';
import { compareImportParity } from "../src/ledgerSync/importParity.ts";
import { IncrementalBooksGuard } from "../src/core/booksValidation.ts";
import {
  seal,
  restoreArchive,
  type Checkpoint,
  type Sealed,
  type ArchiveRecord,
  type RestorePointSummary,
} from "../src/ledgerSync/backup.ts";
import type {
  DurableObjectState,
  R2Bucket,
  WebSocket,
  Request as WorkerRequest,
} from "@cloudflare/workers-types/index.ts";
declare const Response: typeof import("@cloudflare/workers-types/index.ts").Response;
declare const WebSocketPair: typeof import("@cloudflare/workers-types/index.ts").WebSocketPair;
import { DurableObject } from "cloudflare:workers";
import { splitForSync } from "../src/core/sync.ts";
import { assembleHousehold } from "../src/core/sync.ts";
import { activateScheduledPlans, appendTrustedPlanHerculesTurn } from "../src/core/commands.ts";
import { todayKey } from "../src/core/calendar.ts";
import { planActivationInstant, type PlanHerculesTurn } from "../src/core/planSystem.ts";
import { assertAcceptableBooks } from "../src/core/commandRuntime.ts";
import type {
  Household,
  PersonalEnvelope,
  SharedEnvelope,
  RestorePoint,
  CommandReceipt,
  CommitResult,
} from "../src/core/types.ts";
import {
  prepareCommand,
  intentDigest,
  type AuthorityState,
} from "../src/ledgerSync/authority.ts";
import {
  digest,
  difference,
  type ProjectionPatch,
} from "../src/ledgerSync/patch.ts";
import {
  parseCommand,
  type AcceptedEvent,
  type Receipt,
  type Scope,
} from "../src/ledgerSync/protocol.ts";
import {
  MessageReader,
  encodeMessage,
  WINDOW,
} from "../src/ledgerSync/wire.ts";
import { importLegacy, supabase, type AuthEnv } from "./ledgerSyncAuth.ts";
import { importReservationDigests, reservationDigest } from "./ledgerReservations.ts";
type Env = AuthEnv & { LEDGER_ARCHIVE: R2Bucket; HERCULES_ACTIONS_ENABLED?: string; HERCULES_EXTERNAL_CALENDAR_WRITES?: string };
type Attachment = {
  scope?: Scope;
  deadline: number;
  ready: boolean;
  lane?: "ledger" | "presence";
  presenceAt?: number;
};
export class LedgerRoom extends DurableObject<Env> {
  private booksGuards = new Map<string, IncrementalBooksGuard>();
  private state?: AuthorityState;
  private tail: Promise<unknown> = Promise.resolve();
  private readers = new Map<WebSocket, MessageReader>();
  private flows = new Map<
    WebSocket,
    { queue: ArrayBuffer[]; outstanding: number; bytes: number }
  >();
  private admissions = { at: 0, count: 0 };
  private queued = 0;
  private socketQueued = new Map<WebSocket, number>();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS projection(scope TEXT,field TEXT,entity TEXT,part INTEGER,position INTEGER,data TEXT,PRIMARY KEY(scope,field,entity,part))",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS journal(sequence INTEGER,part INTEGER,data TEXT,PRIMARY KEY(sequence,part))",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,actor TEXT,digest TEXT,sequence INTEGER,data TEXT)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,scope TEXT,expires INTEGER)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS checkpoint_outbox(id INTEGER,part INTEGER,data TEXT,PRIMARY KEY(id,part))",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS archive(sequence INTEGER PRIMARY KEY,hash TEXT)",
    );
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS import_proof_outbox(key TEXT,part INTEGER,data TEXT,PRIMARY KEY(key,part))");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS legacy_reservations(digest TEXT PRIMARY KEY)");
    for (const ws of ctx.getWebSockets()) ws.close(1012, "RECONNECT");
  }
  private metric(event: string, values: Record<string, number | string> = {}) {
    // Operational counters/timing only: never money, notes, member or household IDs.
    console.log(
      JSON.stringify({ service: "ledger-sync-v2", event, ...values }),
    );
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work);
    this.tail = next.catch(() => {});
    return next;
  }
  private meta(key: string, fallback = "") {
    return (
      this.ctx.storage.sql
        .exec<{ value: string }>("SELECT value FROM meta WHERE key=?", key)
        .toArray()[0]?.value ?? fallback
    );
  }
  private set(key: string, value: string) {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO meta VALUES (?,?)",
      key,
      value,
    );
  }
  private importedReceipts(): CommandReceipt[] {
    return JSON.parse(this.meta("importedReceipts", "[]"));
  }
  private reserveImportedReceipts(receipts: CommandReceipt[]) {
    const reserved = new Map(this.importedReceipts().map(receipt => [receipt.confirmationId, receipt]));
    for (const receipt of receipts) {
      const previous = reserved.get(receipt.confirmationId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(receipt)) throw new Error("IMPORT_RECEIPT_CONFLICT");
      reserved.set(receipt.confirmationId, receipt);
    }
    this.set("importedReceipts", JSON.stringify([...reserved.values()]));

  }
  private reserveDigests(digests: string[]) {
    for (const value of digests) {
      if (!/^[0-9a-f]{64}$/.test(value)) throw new Error("INVALID_RESERVATION_DIGEST");
      this.ctx.storage.sql.exec("INSERT OR IGNORE INTO legacy_reservations VALUES (?)", value);
    }
    this.set("importedReceiptsReady", "2");
  }
  private queueImportProof(key:string,value:unknown) {
    const body=JSON.stringify(value);
    for(let at=0;at<body.length;at+=60000)this.ctx.storage.sql.exec("INSERT OR REPLACE INTO import_proof_outbox VALUES (?,?,?)",key,at/60000,body.slice(at,at+60000));
  }
  private async collectReservations(scope: Scope, token: string, receipts: CommandReceipt[]) {
    const ring = await Promise.all(receipts.map(receipt => reservationDigest(scope, receipt.confirmationId)));
    const history = this.env.LEDGER_SYNC_LOCAL_AUTH === "true" ? []
      : await importReservationDigests(this.env, scope, token, this.meta("authorityInstance"));
    this.check(scope);
    return [...new Set([...ring, ...history])];
  }
  private put(scope: string, field: string, entity: string, value: unknown) {
    const sql = this.ctx.storage.sql;
    const position =
      sql
        .exec<{
          position: number;
        }>(
          "SELECT position FROM projection WHERE scope=? AND field=? AND entity=? LIMIT 1",
          scope,
          field,
          entity,
        )
        .toArray()[0]?.position ??
      sql
        .exec<{
          n: number;
        }>(
          "SELECT coalesce(max(position),0)+1 n FROM projection WHERE scope=? AND field=?",
          scope,
          field,
        )
        .one().n;
    sql.exec(
      "DELETE FROM projection WHERE scope=? AND field=? AND entity=?",
      scope,
      field,
      entity,
    );
    const text = JSON.stringify(value);
    for (let i = 0; i < text.length; i += 60000)
      sql.exec(
        "INSERT INTO projection VALUES (?,?,?,?,?,?)",
        scope,
        field,
        entity,
        i / 60000,
        position,
        text.slice(i, i + 60000),
      );
  }
  private field(scope: string, field: string, value: unknown) {
    this.ctx.storage.sql.exec(
      "DELETE FROM projection WHERE scope=? AND field=?",
      scope,
      field,
    );
    if (
      Array.isArray(value) &&
      value.every((r) => r && typeof r.id === "string")
    ) {
      this.put(scope, field, "#", { array: true });
      for (const row of value) this.put(scope, field, row.id, row);
    } else this.put(scope, field, "#", { value });
  }
  private writeProjection(scope: string, patch: ProjectionPatch) {
    for (const field of patch.unset)
      this.ctx.storage.sql.exec(
        "DELETE FROM projection WHERE scope=? AND field=?",
        scope,
        field,
      );
    for (const [field, value] of Object.entries(patch.set))
      this.field(scope, field, value);
    for (const [field, change] of Object.entries(patch.rows)) {
      for (const id of change.remove)
        this.ctx.storage.sql.exec(
          "DELETE FROM projection WHERE scope=? AND field=? AND entity=?",
          scope,
          field,
          id,
        );
      for (const row of change.put) this.put(scope, field, String(row.id), row);
    }
  }
  private readProjection(scope: string): unknown {
    const rows = this.ctx.storage.sql
      .exec<{
        field: string;
        entity: string;
        data: string;
      }>(
        "SELECT field,entity,data FROM projection WHERE scope=? ORDER BY field,position,part",
        scope,
      )
      .toArray();
    const grouped = new Map<
      string,
      { field: string; entity: string; data: string }
    >();
    for (const row of rows) {
      const key = JSON.stringify([row.field, row.entity]),
        old = grouped.get(key);
      if (old) old.data += row.data;
      else grouped.set(key, { ...row });
    }
    const result: Record<string, unknown> = {};
    for (const row of grouped.values()) {
      const value = JSON.parse(row.data);
      if (row.entity === "#")
        result[row.field] = value.array ? [] : value.value;
      else (result[row.field] as unknown[]).push(value);
    }
    return result;
  }
  private load(): AuthorityState {
    if (this.state) return this.state;
    if (!this.meta("initialized")) throw new Error("IMPORT_REQUIRED");
    const personal = new Map<string, PersonalEnvelope>();
    for (const row of this.ctx.storage.sql
      .exec<{
        scope: string;
      }>("SELECT DISTINCT scope FROM projection WHERE scope!='shared'")
      .toArray())
      personal.set(
        row.scope,
        this.readProjection(row.scope) as PersonalEnvelope,
      );
    return (this.state = {
      sequence: Number(this.meta("sequence", "0")),
      shared: this.readProjection("shared") as SharedEnvelope,
      personal,
    });
  }
  private check(scope: Scope) {
    if (this.meta("deleted") || this.meta("deleting"))
      throw new Error("LEDGER_DELETED");
    if (
      scope.expires <= Date.now() ||
      scope.aclEpoch < Number(this.meta("acl", "1"))
    )
      throw new Error("AUTH_EXPIRED");
    if (
      this.meta("scope", `${scope.environment}/${scope.householdId}`) !==
      `${scope.environment}/${scope.householdId}`
    )
      throw new Error("SCOPE_MISMATCH");
  }
  async beginDelete(scope: Scope) {
    return this.serial(async () => {
      if (
        (this.meta("deleting") && this.meta("deleting") !== scope.subject) ||
        (this.meta("deleted") && this.meta("deleted") !== scope.subject)
      )
        throw new Error("DELETION_IN_PROGRESS");
      if (
        this.meta("deleting") === scope.subject ||
        this.meta("deleted") === scope.subject
      )
        return;
      this.check(scope);
      if (scope.role !== "owner") throw new Error("FORBIDDEN");
      this.set("deleting", scope.subject);
      await this.ctx.storage.sync();
      for (const ws of this.ctx.getWebSockets())
        ws.close(4003, "LEDGER_DELETED");
    });
  }
  async finishDelete(subject: string, scope: string) {
    return this.serial(async () => {
      // The edge supplies this subject/scope only after the authenticated,
      // idempotent control-plane deletion RPC has verified the former owner.
      if (
        this.meta("initialized") &&
        this.meta("deleting") !== subject &&
        this.meta("deleted") !== subject
      )
        throw new Error("FORBIDDEN");
      if (this.meta("scope", scope) !== scope)
        throw new Error("SCOPE_MISMATCH");
      this.set("scope", scope);
      const prefix = encodeURIComponent(scope) + "/";
      await this.env.LEDGER_ARCHIVE.put(
        `${prefix}tombstone`,
        JSON.stringify({
          scope: this.meta("scope"),
          deletedAt: new Date().toISOString(),
        }),
      );
      let cursor: string | undefined;
      do {
        const listed = await this.env.LEDGER_ARCHIVE.list({ prefix, cursor });
        const keys = listed.objects
          .map((object) => object.key)
          .filter((key) => key !== `${prefix}tombstone`);
        if (keys.length) await this.env.LEDGER_ARCHIVE.delete(keys);
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
      this.ctx.storage.transactionSync(() => {
        for (const table of [
          "projection",
          "journal",
          "receipts",
          "legacy_reservations",
          "archive",
          "checkpoint_outbox",
          "import_proof_outbox",
          "tickets",
        ])
          this.ctx.storage.sql.exec(`DELETE FROM ${table}`);
        this.set("deleted", subject);
        this.set("checkpointRequired", "");
        this.set("importedReceipts", "[]");
        this.set("importedReceiptsReady", "");
      });
      await this.ctx.storage.sync();
      this.state = undefined;
      return { deleted: true };
    });
  }
  async deletionOwner() {
    return this.meta("deleting") || this.meta("deleted");
  }
  async resolveReceipt(scope: Scope, id: string) {
    return this.serial(async () => {
      this.check(scope);
      if (!this.meta("initialized") || this.meta("importedReceiptsReady") !== "2") throw new Error("IMPORT_RECEIPT_REPAIR_REQUIRED");
      await this.archiveBarrier();
      this.check(scope);
      const imported = this.importedReceipts().find(receipt => receipt.confirmationId === id);
      if (imported) {
        // Legacy receipt format lacks submitting subject. Reserve and resolve
        // its identity without inventing ownership or disclosing private IDs.
        return { version: 1, confirmationId: imported.confirmationId, revision: imported.revision,
          acceptedAt: imported.acceptedAt, reserved: true };
      }
      const reserved = this.ctx.storage.sql.exec("SELECT 1 FROM legacy_reservations WHERE digest=?", await reservationDigest(scope, id)).toArray().length;
      this.check(scope);
      if (reserved) return { version: 1, confirmationId: id, reserved: true };
      const row = this.ctx.storage.sql.exec<{ actor: string; data: string }>("SELECT actor,data FROM receipts WHERE id=?", id).toArray()[0];
      if (!row || row.actor !== scope.memberId) throw new Error("RECEIPT_NOT_FOUND");
      return { version: 2, receipt: JSON.parse(row.data) as Receipt };
    });
  }
  async registerCreation(
    token: string,
    household: Household,
    memberId: string,
  ): Promise<void> {
    return this.serial(async () => {
      if (
        household.environment !== "development" ||
        !/^HH-[a-zA-Z0-9_-]{1,96}$/.test(household.householdId)
      )
        throw new Error("INVALID_SCOPE");
      assertAcceptableBooks(household);
      const split = splitForSync(
        { ...household, restorePoints: [], linked: true },
        memberId,
      );
      if (!this.meta("authorityInstance")) {
        this.set("authorityInstance", crypto.randomUUID());
        await this.ctx.storage.sync();
      }
      await supabase(this.env, "/rest/v1/rpc/create_ledger_sync_v2", token, {
        p_household_id: household.householdId,
        p_member_id: memberId,
        p_authority_instance: this.meta("authorityInstance"),
        p_shared: split.shared,
        p_personal: split.personal,
      });
    });
  }
  async ensureImported(scope: Scope, token: string, local?: Household) {
    return this.serial(async () => {
      this.check(scope);
      const exists = this.meta("initialized"),
        personalExists =
          this.ctx.storage.sql
            .exec(
              "SELECT 1 FROM projection WHERE scope=? LIMIT 1",
              scope.memberId,
            )
            .toArray().length > 0;
      if (exists && personalExists) {
        if (this.meta("importedReceiptsReady") !== "2") {
          // Upgrade already-imported rooms from the immutable fenced source,
          // not the current projection (older builds cleared these receipts).
          const original = local ?? (this.env.LEDGER_SYNC_LOCAL_AUTH === "true"
            ? { commandReceipts: this.load().shared.commandReceipts }
            : await importLegacy(this.env, scope, token, this.meta("authorityInstance")));
          const reservations = await this.collectReservations(scope, token, original.commandReceipts ?? []);
          this.check(scope);
          this.ctx.storage.transactionSync(() => {
            this.reserveImportedReceipts(original.commandReceipts ?? []);
            this.reserveDigests(reservations);
            this.field("shared", "commandReceipts", []);
            this.set("checkpointRequired", "1");
          });
          await this.ctx.storage.sync();
          this.state = undefined;
        }
        await this.archiveBarrier();
        return;
      }
      if (!this.meta("authorityInstance")) {
        this.set("authorityInstance", crypto.randomUUID());
        await this.ctx.storage.sync();
      }
      const household =
        local ??
        (await importLegacy(
          this.env,
          scope,
          token,
          this.meta("authorityInstance"),
        ));
      this.check(scope);
      if (
        household.environment !== scope.environment ||
        household.householdId !== scope.householdId
      )
        throw new Error("IMPORT_SCOPE_MISMATCH");
      assertAcceptableBooks(household);
      const split = splitForSync(household, scope.memberId),
        sourceHash = await digest(split);
      const reservations = await this.collectReservations(scope, token, household.commandReceipts ?? []);
      this.check(scope);
      this.ctx.storage.transactionSync(() => {
        this.reserveImportedReceipts(household.commandReceipts ?? []);
        this.reserveDigests(reservations);
        if (!exists) {
          for (const [field, value] of Object.entries(split.shared))
            this.field("shared", field, field === "commandReceipts" ? [] : value);
          this.set("sequence", String(household.revision));
          this.set("importSequence", String(household.revision));
          this.set("scope", `${scope.environment}/${scope.householdId}`);
          this.set("initialized", "1");
        }
        if (!personalExists)
          for (const [field, value] of Object.entries(split.personal))
            this.field(scope.memberId, field, value);
        this.set("checkpointRequired", "1");
        this.set(
          `import:${scope.memberId}`,
          JSON.stringify({
            sourceHash,
            sourceRevision: household.revision,
            at: new Date().toISOString(),
          }),
        );
        const persisted={shared:this.readProjection("shared") as SharedEnvelope,personal:this.readProjection(scope.memberId) as PersonalEnvelope};
        this.queueImportProof(`imports/${encodeURIComponent(scope.memberId)}`,{scope:this.meta("scope"),authorityInstance:this.meta("authorityInstance"),sourceHash,sourceRevision:household.revision,...persisted});
        if(!exists)this.queueImportProof('import-shared',{scope:this.meta("scope"),authorityInstance:this.meta("authorityInstance"),shared:persisted.shared});
      });
      await this.ctx.storage.sync();
      this.state = undefined;
      await this.archiveBarrier();
    });
  }
  async importParity(scope: Scope, token: string, localSource?: Household) {
    return this.serial(async () => {
      this.check(scope);
      if (!this.meta("initialized") || this.meta("importedReceiptsReady") !== "2") throw new Error("IMPORT_REQUIRED");
      const binding = JSON.parse(this.meta(`import:${scope.memberId}`, "null")) as {sourceHash:string;sourceRevision:number} | null;
      if(!binding)throw new Error("PERSONAL_IMPORT_REQUIRED");
      let normalizationDifferences: string[] = [];
      const sourceHousehold = localSource ?? await importLegacy(this.env,scope,token,this.meta("authorityInstance"), changes=>{normalizationDifferences=changes;});
      const source = splitForSync(sourceHousehold,scope.memberId);
      if(await digest(source)!==binding.sourceHash)throw new Error("IMPORT_SOURCE_CHANGED");
      const prefix=encodeURIComponent(this.meta("scope"));
      const ownObject=await this.env.LEDGER_ARCHIVE.get(`${prefix}/imports/${encodeURIComponent(scope.memberId)}`);
      let target: {shared:SharedEnvelope;personal:PersonalEnvelope};
      let evidence: string;
      if(ownObject) {
        const sealed=await ownObject.json<Sealed<{scope:string;authorityInstance:string;sourceHash:string;sourceRevision:number;shared:SharedEnvelope;personal:PersonalEnvelope}>>();
        if(await digest(sealed.data)!==sealed.sha256 || sealed.data.scope!==this.meta("scope") || sealed.data.authorityInstance!==this.meta("authorityInstance") || sealed.data.sourceHash!==binding.sourceHash || sealed.data.sourceRevision!==binding.sourceRevision) throw new Error("IMPORT_ARCHIVE_MISMATCH");
        target=sealed.data;evidence='SQLite import reread archived by member';
      } else {
        // Backfill evidence from a checksum-verified import-revision restore
        // checkpoint. Never compare a later edited projection to frozen source.
        const points=JSON.parse(this.meta("restorePoints","[]")) as RestorePointSummary[];
        const point=points.find(p=>p.sourceRevision===binding.sourceRevision);
        const object=point ? await this.env.LEDGER_ARCHIVE.get(`${prefix}/restore/${point.id}`) : null;
        if(!object)throw new Error("IMPORT_BASELINE_UNAVAILABLE");
        const sealed=await object.json<Sealed<Checkpoint>>();
        if(await digest(sealed.data)!==sealed.sha256 || sealed.data.scope!==this.meta("scope") || sealed.data.authorityInstance!==this.meta("authorityInstance") || sealed.data.sequence!==binding.sourceRevision)throw new Error("IMPORT_ARCHIVE_MISMATCH");
        const personal=sealed.data.personal.find(([id])=>id===scope.memberId)?.[1];
        if(!personal)throw new Error("PERSONAL_IMPORT_BASELINE_UNAVAILABLE");
        target={shared:{...sealed.data.shared,commandReceipts:[]},personal};evidence='Verified import-revision checkpoint';
      }
      // A late member imports their frozen Personal scope after Shared has
      // advanced. Compare Shared at its own import boundary, not against edits.
      if(target.shared.revision!==source.shared.revision){
        const object=await this.env.LEDGER_ARCHIVE.get(`${prefix}/import-shared`);
        if(!object)throw new Error("SHARED_IMPORT_BASELINE_UNAVAILABLE");
        const sealed=await object.json<Sealed<{scope:string;authorityInstance:string;shared:SharedEnvelope}>>();
        if(await digest(sealed.data)!==sealed.sha256||sealed.data.scope!==this.meta("scope")||sealed.data.authorityInstance!==this.meta("authorityInstance"))throw new Error("IMPORT_ARCHIVE_MISMATCH");
        target={...target,shared:sealed.data.shared};
      }
      const expected=await this.collectReservations(scope,token,sourceHousehold.commandReceipts);
      const stored=this.ctx.storage.sql.exec<{digest:string}>("SELECT digest FROM legacy_reservations ORDER BY digest").toArray().map(row=>row.digest);
      const set=new Set(stored);
      const report=await compareImportParity({source,target, importedReceipts:this.importedReceipts(), reserved:async id=>set.has(await reservationDigest(scope,id)),manifestCount:expected.length,manifestExact:JSON.stringify([...expected].sort())===JSON.stringify(stored),today:'2026-09-07'});
      if(normalizationDifferences.length){report.pass=false;report.differences.push(...normalizationDifferences.map(field=>`normalization.${field}`));}
      this.check(scope);
      this.set(`parity:${scope.memberId}`,JSON.stringify({pass:report.pass,at:new Date().toISOString(),sourceHash:binding.sourceHash,sourceRevision:binding.sourceRevision}));
      await this.ctx.storage.sync();this.check(scope);
      const memberCoverage=this.load().shared.members.filter(member=>member.active).map(member=>{
        const ownBinding=JSON.parse(this.meta(`import:${member.id}`,'null'));
        const ownProof=JSON.parse(this.meta(`parity:${member.id}`,'null'));
        return {memberId:member.id,checked:Boolean(ownProof&&ownBinding&&ownProof.sourceHash===ownBinding.sourceHash),pass:ownProof&&ownBinding&&ownProof.sourceHash===ownBinding.sourceHash?ownProof.pass:null};
      });
      return {...report,evidence,normalizationDifferences,memberCoverage,otherMemberScope:'requires-own-authenticated-report'};
    });
  }
  async reconcileMembers(
    scope: Scope,
    roster: Array<{ id: string; name: string; active: boolean }>,
  ) {
    return this.serial(async () => {
      this.check(scope);
      const state = this.load();
      const byId = new Map(roster.map((m) => [m.id, m]));
      const members = state.shared.members.map((member) => ({
        ...member,
        active: byId.get(member.id)?.active ?? false,
      }));
      for (const member of roster)
        if (!members.some((m) => m.id === member.id))
          members.push({
            ...member,
            color: "#718477",
            updatedAt: new Date().toISOString(),
          });
      if (JSON.stringify(members) === JSON.stringify(state.shared.members))
        return;
      const shared = { ...state.shared, members, revision: state.sequence + 1 };
      const event: AcceptedEvent = {
        sequence: state.sequence + 1,
        shared: difference(state.shared, shared),
        acceptedAt: new Date().toISOString(),
      };
      const body = JSON.stringify(event),
        hash = await digest(event);
      this.check(scope);
      this.ctx.storage.transactionSync(() => {
        this.writeProjection("shared", event.shared);
        for (let at = 0; at < body.length; at += 60000)
          this.ctx.storage.sql.exec(
            "INSERT INTO journal VALUES (?,?,?)",
            event.sequence,
            at / 60000,
            body.slice(at, at + 60000),
          );
        this.ctx.storage.sql.exec(
          "INSERT INTO archive VALUES (?,?)",
          event.sequence,
          hash,
        );
        this.set("sequence", String(event.sequence));
      });
      this.state = undefined;
      await this.ctx.storage.sync();
      await this.archiveBarrier();
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment() as Attachment;
        if (a.scope && !byId.get(a.scope.memberId)?.active) {
          ws.close(4003, "ACCESS_CHANGED");
          continue;
        }
        if (a.ready && a.scope)
          try {
            await this.send(ws, { type: "event", event });
          } catch {
            ws.close(1012, "RECONNECT");
          }
      }
      await this.schedule();
    });
  }
  private async checkpoint() {
    const state = this.load();
    const points: RestorePointSummary[] = JSON.parse(
      this.meta("restorePoints", "[]"),
    );
    const id = Number(this.meta("checkpointId", "0")) + 1;
    if (!points.some((point) => point.sourceRevision === state.sequence))
      points.push({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        sourceRevision: state.sequence,
        createdByMemberId: "authority",
        label: `Accepted ledger revision ${state.sequence}`,
        sharedMoneyHash: await digest(state.shared),
      });
    const retained = points
      .filter(
        (point) => Date.parse(point.createdAt) > Date.now() - 30 * 86400000,
      )
      .slice(-40);
    const data: Checkpoint = {
      version: 2,
      scope: this.meta("scope"),
      authorityInstance: this.meta("authorityInstance"),
      sequence: state.sequence,
      shared: state.shared,
      personal: [...state.personal],
      receipts: this.ctx.storage.sql
        .exec<{ data: string }>("SELECT data FROM receipts ORDER BY sequence")
        .toArray()
        .map((row) => JSON.parse(row.data)),
      ...(this.meta("importedReceiptsReady") === "2" ? { importedReceipts: this.importedReceipts(),
        reservationDigests: this.ctx.storage.sql.exec<{ digest: string }>("SELECT digest FROM legacy_reservations ORDER BY digest").toArray().map(row => row.digest) } : {}),
      importBindings: Object.fromEntries(this.ctx.storage.sql.exec<{key:string;value:string}>("SELECT key,value FROM meta WHERE key LIKE 'import:%'").toArray().map(row=>[row.key.slice(7),JSON.parse(row.value)])),
      restorePoints: retained,
    };
    const body = JSON.stringify(await seal(data));
    this.ctx.storage.transactionSync(() => {
      for (let at = 0; at < body.length; at += 60000)
        this.ctx.storage.sql.exec(
          "INSERT INTO checkpoint_outbox VALUES (?,?,?)",
          id,
          at / 60000,
          body.slice(at, at + 60000),
        );
      this.set("checkpointId", String(id));
    });
    await this.ctx.storage.sync();
    await this.schedule();
  }
  async restore(scope: Scope) {
    return this.serial(async () => {
      this.check(scope);
      if (this.meta("initialized"))
        throw new Error("RESTORE_REQUIRES_EMPTY_AUTHORITY");
      const prefix = encodeURIComponent(
        `${scope.environment}/${scope.householdId}`,
      );
      if (await this.env.LEDGER_ARCHIVE.get(`${prefix}/tombstone`))
        throw new Error("LEDGER_DELETED");
      const object = await this.env.LEDGER_ARCHIVE.get(`${prefix}/checkpoint`);
      if (!object) throw new Error("BACKUP_MISSING");
      const checkpoint = await object.json<Sealed<Checkpoint>>();
      const tipObject = await this.env.LEDGER_ARCHIVE.get(`${prefix}/tip`),
        tip = tipObject
          ? await tipObject.json<{
              scope: string;
              authorityInstance: string;
              sequence: number;
            }>()
          : undefined;
      if (
        tip &&
        (tip.scope !== checkpoint.data.scope ||
          tip.authorityInstance !== checkpoint.data.authorityInstance ||
          !Number.isSafeInteger(tip.sequence))
      )
        throw new Error("ARCHIVE_AUTHORITY_MISMATCH");
      const sequence = Math.max(checkpoint.data.sequence, tip?.sequence ?? 0),
        records: Sealed<ArchiveRecord>[] = [];
      for (let at = checkpoint.data.sequence + 1; at <= sequence; at++) {
        const event = await this.env.LEDGER_ARCHIVE.get(
          `${prefix}/events/${at}`,
        );
        if (!event) throw new Error("ARCHIVE_GAP");
        records.push(await event.json<Sealed<ArchiveRecord>>());
      }
      const restored = await restoreArchive(
        `${scope.environment}/${scope.householdId}`,
        checkpoint,
        records,
      );
      this.check(scope);
      this.ctx.storage.transactionSync(() => {
        if (restored.importedReceipts) this.reserveImportedReceipts(restored.importedReceipts);
        if (restored.reservationDigests) this.reserveDigests(restored.reservationDigests);
        for (const [field, value] of Object.entries(restored.shared))
          this.field("shared", field, field === "commandReceipts" ? [] : value);
        for (const [member, own] of restored.personal)
          for (const [field, value] of Object.entries(own))
            this.field(member, field, value);
        for (const receipt of restored.receipts) {
          this.ctx.storage.sql.exec(
            "INSERT INTO receipts VALUES (?,?,?,?,?)",
            receipt.id,
            receipt.actor,
            receipt.digest,
            receipt.sequence,
            JSON.stringify(receipt),
          );
          if (receipt.undoOf) this.set(`undo:${receipt.undoOf}`, receipt.id);
        }
        this.set("restorePoints", JSON.stringify(restored.restorePoints ?? []));
        for(const [member, binding] of Object.entries(restored.importBindings ?? {})) this.set(`import:${member}`, JSON.stringify(binding));
        this.set("scope", restored.scope);
        this.set("authorityInstance", restored.authorityInstance);
        this.set("sequence", String(restored.sequence));
        this.set("importSequence", String(restored.sequence));
        this.set("initialized", "1");
      });
      this.state = undefined;
      await this.ctx.storage.sync();
      return { restoredSequence: restored.sequence };
    });
  }
  async listRestorePoints(scope: Scope) {
    return this.serial(async () => {
      this.check(scope);
      await this.archiveBarrier();
      return JSON.parse(
        this.meta("restorePoints", "[]"),
      ) as RestorePointSummary[];
    });
  }
  private async restorePoint(id: string): Promise<RestorePoint> {
    const points: RestorePointSummary[] = JSON.parse(
        this.meta("restorePoints", "[]"),
      ),
      point = points.find((point) => point.id === id);
    if (!point || Date.parse(point.createdAt) < Date.now() - 30 * 86400000)
      throw new Error("RESTORE_POINT_MISSING");
    const object = await this.env.LEDGER_ARCHIVE.get(
      `${encodeURIComponent(this.meta("scope"))}/restore/${id}`,
    );
    if (!object) throw new Error("RESTORE_POINT_MISSING");
    const checkpoint = await object.json<Sealed<Checkpoint>>();
    if (
      checkpoint.data.scope !== this.meta("scope") ||
      checkpoint.data.authorityInstance !== this.meta("authorityInstance") ||
      (await digest(checkpoint.data)) !== checkpoint.sha256 ||
      (await digest(checkpoint.data.shared)) !== point.sharedMoneyHash
    )
      throw new Error("RESTORE_CHECKSUM");
    return { ...point, shared: checkpoint.data.shared };
  }
  async ticket(scope: Scope) {
    this.check(scope);
    const id = crypto.randomUUID();
    this.ctx.storage.sql.exec(
      "INSERT INTO tickets VALUES (?,?,?)",
      id,
      JSON.stringify(scope),
      Date.now() + 15000,
    );
    await this.ctx.storage.sync();
    await this.schedule();
    return id;
  }
  async revoke(epoch: number) {
    this.set("acl", String(Math.max(epoch, Number(this.meta("acl", "1")))));
    await this.ctx.storage.sync();
    for (const ws of this.ctx.getWebSockets())
      if ((ws.deserializeAttachment() as Attachment).scope?.aclEpoch! < epoch)
        ws.close(4003, "ACCESS_CHANGED");
  }
  private async commitSystemPlanResult(id: string, acceptedAt: string, result: CommitResult): Promise<Receipt> {
    const state = this.load();
    const prior = this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM receipts WHERE id=?", id).toArray()[0];
    if (prior) return JSON.parse(prior.data) as Receipt;
    const household = { ...result.household, commandReceipts: [], restorePoints: [], revision: state.sequence + 1, baseRevision: state.sequence + 1 };
    assertAcceptableBooks(household);
    const actorMemberId = result.persistenceScope === "member-personal" ? result.personalMemberId
      : state.shared.members.find((member) => member.active && state.personal.has(member.id))?.id;
    if (!actorMemberId) throw new Error("SYSTEM_PLAN_REPLICA_UNAVAILABLE");
    const priorPersonal = state.personal.get(actorMemberId);
    if (!priorPersonal) throw new Error("SYSTEM_PLAN_REPLICA_UNAVAILABLE");
    const split = splitForSync(household, actorMemberId);
    const event: AcceptedEvent = { sequence: state.sequence + 1, shared: difference(state.shared, split.shared),
      ...(result.persistenceScope === "member-personal" ? { personal: difference(priorPersonal, split.personal), memberId: actorMemberId } : {}), acceptedAt };
    const receipt: Receipt = { id, sequence: event.sequence, digest: await digest({ id, event }), actor: "system:plan-authority",
      postedIds: [...new Set(result.postedIds)], warnings: result.warnings, undo: { id, label: result.undo.label, postedIds: [], actorMemberId: "system:plan-authority", commandKind: result.undo.commandKind },
      commandKind: result.undo.commandKind ?? "systemPlanAuthority",
      ...(result.persistenceScope === "member-personal" ? { persistenceScope: "member-personal" as const, personalMemberId: actorMemberId } : {}) };
    const eventText = JSON.stringify(event), eventHash = await digest(event);
    this.ctx.storage.transactionSync(() => {
      this.writeProjection("shared", event.shared);
      if (event.personal) this.writeProjection(actorMemberId, event.personal);
      for (let at = 0; at < eventText.length; at += 60000) this.ctx.storage.sql.exec("INSERT INTO journal VALUES (?,?,?)", event.sequence, at / 60000, eventText.slice(at, at + 60000));
      this.ctx.storage.sql.exec("INSERT INTO receipts VALUES (?,?,?,?,?)", id, receipt.actor, receipt.digest, receipt.sequence, JSON.stringify(receipt));
      this.ctx.storage.sql.exec("INSERT INTO archive VALUES (?,?)", receipt.sequence, eventHash);
      this.set("sequence", String(receipt.sequence));
    });
    await this.ctx.storage.sync();
    this.state = { sequence: receipt.sequence, shared: split.shared, personal: event.personal ? new Map(state.personal).set(actorMemberId, split.personal) : state.personal };
    for (const peer of this.ctx.getWebSockets()) {
      const attachment = peer.deserializeAttachment() as Attachment;
      if (attachment.ready && attachment.scope) {
        try { this.check(attachment.scope); await this.send(peer, { type: "event", event: this.visible(event, attachment.scope.memberId) }); }
        catch { peer.close(4003, "AUTH_EXPIRED"); }
      }
    }
    await this.archiveBarrier();
    await this.schedule();
    return receipt;
  }
  async appendTrustedPlanReply(scope: Scope, input: {
    sessionId: string; inReplyToTurnId: string; text: string; sourceReferences: PlanHerculesTurn["sourceReferences"];
    sourceRevision: number; receiptId: string; responseHash: string; provider: string; createdAt: string;
  }) {
    return this.serial(async () => {
      this.check(scope);
      await this.archiveBarrier();
      const state = this.load(), personal = state.personal.get(scope.memberId);
      if (!personal) throw new Error("PERSONAL_IMPORT_REQUIRED");
      const household = assembleHousehold(state.shared, personal, { linked: true });
      const result = appendTrustedPlanHerculesTurn(household, input);
      const receipt = await this.commitSystemPlanResult(input.receiptId, input.createdAt, result);
      return { receipt, turnId: result.postedIds[0] ?? null, sequence: receipt.sequence };
    });
  }
  private async activateDuePlans(): Promise<void> {
    let state = this.load();
    const memberId = (state.shared.members ?? []).find((member) => member.active && state.personal.has(member.id))?.id;
    if (!memberId) return;
    const asOf = todayKey(new Date(), "America/Toronto");
    const eventId = `PLAN-CLOCK-${asOf}-${state.sequence + 1}`;
    const result = activateScheduledPlans(assembleHousehold(state.shared, state.personal.get(memberId)!, { linked: true }), { asOf, eventId, createdAt: new Date().toISOString() });
    if (result.postedIds.length) await this.commitSystemPlanResult(eventId, result.household.lastCommittedAt ?? new Date().toISOString(), result);
    state = this.load();
    for (const [ownerMemberId, personal] of state.personal) {
      const personalEventId = `PLAN-CLOCK-${asOf}-${ownerMemberId}-${state.sequence + 1}`;
      const personalResult = activateScheduledPlans(assembleHousehold(state.shared, personal, { linked: true }), {
        asOf, eventId: personalEventId, createdAt: new Date().toISOString(), scope: "personal", memberId: ownerMemberId,
      });
      if (personalResult.postedIds.length) {
        await this.commitSystemPlanResult(personalEventId, new Date().toISOString(), personalResult);
        state = this.load();
      }
    }
  }
  async snapshot(scope: Scope) {
    return this.serial(async () => {
      this.check(scope);
      await this.activateDuePlans();
      await this.archiveBarrier();
      this.check(scope);
      const state = this.load();
      return {
        sequence: state.sequence,
        shared: state.shared,
        personal: state.personal.get(scope.memberId),
      };
    });
  }
  async fetch(request: WorkerRequest) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("WebSocket required", { status: 426 });
    if (Date.now() - this.admissions.at > 1000)
      this.admissions = { at: Date.now(), count: 0 };
    if (++this.admissions.count > 20 || this.ctx.getWebSockets().length >= 100)
      return new Response("Retry", { status: 503 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({
      deadline: Date.now() + 5000,
      ready: false,
      lane:
        new URL(request.url).searchParams.get("lane") === "presence"
          ? "presence"
          : "ledger",
    } satisfies Attachment);
    await this.schedule();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  private async send(ws: WebSocket, value: unknown) {
    const buffers = await encodeMessage(value),
      attachment = ws.deserializeAttachment() as Attachment;
    if (!attachment.scope) return;
    this.check(attachment.scope);
    const f = this.flows.get(ws) ?? { queue: [], outstanding: 0, bytes: 0 };
    const size = buffers.reduce((n, b) => n + b.byteLength, 0);
    if (
      f.bytes + size > 32 * 1024 * 1024 ||
      [...this.flows.values()].reduce((n, x) => n + x.bytes, 0) + size >
        48 * 1024 * 1024
    ) {
      ws.close(1013, "RESYNC_REQUIRED");
      return;
    }
    f.queue.push(...buffers);
    f.bytes += size;
    this.flows.set(ws, f);
    this.drain(ws, f);
  }
  private drain(
    ws: WebSocket,
    f: { queue: ArrayBuffer[]; outstanding: number; bytes: number },
  ) {
    while (f.queue.length && f.outstanding + f.queue[0]!.byteLength <= WINDOW) {
      const buffer = f.queue.shift()!;
      ws.send(buffer);
      f.bytes -= buffer.byteLength;
      f.outstanding += buffer.byteLength;
    }
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === "string" && message.length <= 1024) {
      try {
        const value = JSON.parse(message);
        if (value.type === "presence") {
          const a = ws.deserializeAttachment() as Attachment;
          if (a.lane !== "presence" || !a.scope) return;
          this.check(a.scope);
          if (Date.now() - (a.presenceAt ?? 0) < 100) return;
          a.presenceAt = Date.now();
          ws.serializeAttachment(a);
          const payload = JSON.stringify({
            type: "presence",
            memberId: a.scope.memberId,
            deviceId: `${a.scope.subject}:${String(value.deviceId).slice(0, 100)}`,
            seenAt: new Date().toISOString(),
          });
          for (const peer of this.ctx.getWebSockets()) {
            const p = peer.deserializeAttachment() as Attachment;
            if (peer !== ws && p.lane === "presence" && p.scope)
              try {
                this.check(p.scope);
                peer.send(payload);
              } catch {
                peer.close(4003, "ACCESS_CHANGED");
              }
          }
          return;
        }
      } catch {
        ws.close(4000, "INVALID_PRESENCE");
        return;
      }
    }
    const receivedAt = performance.now();
    const pending = this.socketQueued.get(ws) ?? 0;
    if (this.queued >= 64 || pending >= 16) {
      this.metric("queue-rejected", { queued: this.queued });
      ws.close(1013, "RETRY_WITH_JITTER");
      return;
    }
    this.queued++;
    this.socketQueued.set(ws, pending + 1);
    return this.serial(async () => {
      let requestId: string | undefined;
      let admission = false;
      let commitAttempted = false;
      try {
        const a = ws.deserializeAttachment() as Attachment;
        if (typeof message === "string") {
          if (message.length > 4096) throw new Error("MESSAGE_TOO_LARGE");
          const m = JSON.parse(message);
          if (m.type === "auth") {
            const row = this.ctx.storage.sql
              .exec<{
                scope: string;
                expires: number;
              }>(
                "DELETE FROM tickets WHERE id=? RETURNING scope,expires",
                String(m.ticket),
              )
              .toArray()[0];
            if (!row || row.expires <= Date.now())
              throw new Error("UNAUTHENTICATED");
            const scope = JSON.parse(row.scope) as Scope;
            this.check(scope);
            if (
              a.scope &&
              (a.scope.subject !== scope.subject ||
                a.scope.memberId !== scope.memberId)
            )
              throw new Error("SCOPE_MISMATCH");
            a.scope = scope;
            a.deadline = scope.expires;
            ws.serializeAttachment(a);
            await this.ctx.storage.sync();
            ws.send(JSON.stringify({ type: "authenticated" }));
            return;
          }
          if (!a.scope) throw new Error("UNAUTHENTICATED");
          this.check(a.scope);
          if (m.type === "credit") {
            const f = this.flows.get(ws);
            if (
              !f ||
              !Number.isInteger(m.bytes) ||
              m.bytes <= 0 ||
              m.bytes > f.outstanding
            )
              throw new Error("INVALID_CREDIT");
            f.outstanding -= m.bytes;
            this.drain(ws, f);
            return;
          }
          throw new Error("INVALID_MESSAGE");
        }
        if (!a.scope) throw new Error("UNAUTHENTICATED");
        this.check(a.scope);
        if (a.lane === "presence") throw new Error("WRONG_LANE");
        const reader = this.readers.get(ws) ?? new MessageReader(132 * 1024);
        this.readers.set(ws, reader);
        const m = (await reader.accept(message)) as
          | { type: string; sequence?: number; command?: unknown }
          | undefined;
        if (!m) return;
        this.check(a.scope);
        await this.archiveBarrier();
        this.check(a.scope);
        const state = this.load();
        if (m.type === "resume") {
          a.ready = true;
          ws.serializeAttachment(a);
          const since = m.sequence ?? 0;
          if (
            !Number.isSafeInteger(since) ||
            since < 0 ||
            since > state.sequence
          )
            throw new Error("SEQUENCE_GAP");
          if (
            since === 0 ||
            since <
              Number(
                this.meta("importSequence", String(state.shared.revision)),
              ) ||
            state.sequence - since > 500
          ) {
            await this.send(ws, {
              type: "snapshot",
              replica: {
                sequence: state.sequence,
                shared: state.shared,
                personal: state.personal.get(a.scope.memberId),
              },
            });
          } else
            for (const seq of this.ctx.storage.sql
              .exec<{
                sequence: number;
              }>(
                "SELECT DISTINCT sequence FROM journal WHERE sequence>? ORDER BY sequence",
                since,
              )
              .toArray())
              await this.send(ws, {
                type: "event",
                event: this.visible(
                  this.readEvent(seq.sequence),
                  a.scope.memberId,
                ),
              });
          await this.send(ws, {
            type: "ready",
            companionProfileVersion: 1,
            companionDiscoveryVersion: 1,
            companionWardrobeVersion: 1, companionWorkflowVersion: 1, nativeCalendarVersion: 1, planDecisionVersion: 1, goalEnvelopeVersion: 1, taskPlannerVersion: 1,
            herculesActionsEnabled: herculesActionsEnabled(a.scope.environment, this.env.HERCULES_ACTIONS_ENABLED),
            sequence: state.sequence,
            hash: await digest({
              sequence: state.sequence,
              shared: state.shared,
              personal: state.personal.get(a.scope.memberId),
            }),
          });
          return;
        }
        if (m.type !== "command" || !a.ready) throw new Error("SYNC_REQUIRED");
        const command = parseCommand(m.command);
        requestId = command.id;
        if (this.meta("importedReceiptsReady") !== "2") throw new Error("IMPORT_RECEIPT_REPAIR_REQUIRED");
        admission = true;
        if (this.ctx.storage.sql.exec("SELECT 1 FROM legacy_reservations WHERE digest=?", await reservationDigest(a.scope, command.id)).toArray().length)
          throw new Error("IMPORTED_CONFIRMATION_EXISTS");
        const hash = await intentDigest(command, a.scope.memberId);
        this.check(a.scope);
        const old = this.ctx.storage.sql
          .exec<{
            actor: string;
            digest: string;
            data: string;
          }>("SELECT actor,digest,data FROM receipts WHERE id=?", command.id)
          .toArray()[0];
        if (old) {
          this.metric("receipt-replayed");
          if (old.actor !== a.scope.memberId || old.digest !== hash)
            throw new Error("REQUEST_ID_REUSED");
          await this.send(ws, { type: "ack", receipt: JSON.parse(old.data) });
          return;
        }
        admission = true;
        // Pause new actions without losing accepted receipts or the ability to cancel pending claims.
        if(command.steps.some(step=>step.kind==='executeHerculesAction')&&!herculesActionsEnabled(a.scope.environment, this.env.HERCULES_ACTIONS_ENABLED))throw new Error('HERCULES_ACTIONS_PAUSED');
        const prepared = await prepareCommand(
          state,
          command,
          a.scope,
          () => this.check(a.scope!),
          (id) => {
            const original = this.ctx.storage.sql
              .exec<{
                id: string;
                data: string;
              }>(
                "SELECT id,data FROM receipts WHERE actor=? AND json_extract(data,'$.undoEligible')=1 AND id NOT IN (SELECT substr(key,6) FROM meta WHERE key LIKE 'undo:%') ORDER BY sequence DESC LIMIT 1",
                a.scope!.memberId,
              )
              .toArray()[0];
            if (!original || original.id !== id)
              throw new Error("UNDO_NOT_LATEST");
            return JSON.parse(original.data) as Receipt;
          },
          (id) => this.restorePoint(id),
          this.booksGuards,
        );
        this.check(a.scope);
        const eventText = JSON.stringify(prepared.event),
          eventHash = await digest(prepared.event);
        this.check(a.scope);
        commitAttempted = true;
        this.ctx.storage.transactionSync(() => {
          if (command.steps[0]!.kind === "undoConfirm")
            this.set(`undo:${command.steps[0]!.args[0]}`, command.id);
          this.writeProjection("shared", prepared.event.shared);
          this.writeProjection(a.scope!.memberId, prepared.event.personal!);
          for (let at = 0; at < eventText.length; at += 60000)
            this.ctx.storage.sql.exec(
              "INSERT INTO journal VALUES (?,?,?)",
              prepared.receipt.sequence,
              at / 60000,
              eventText.slice(at, at + 60000),
            );
          this.ctx.storage.sql.exec(
            "INSERT INTO receipts VALUES (?,?,?,?,?)",
            command.id,
            a.scope!.memberId,
            hash,
            prepared.receipt.sequence,
            JSON.stringify(prepared.receipt),
          );
          this.ctx.storage.sql.exec(
            "INSERT INTO archive VALUES (?,?)",
            prepared.receipt.sequence,
            eventHash,
          );
          this.set("sequence", String(prepared.receipt.sequence));
        });
        await this.ctx.storage.sync();
        this.state = {
          sequence: prepared.receipt.sequence,
          shared: prepared.shared,
          personal: new Map(state.personal).set(
            a.scope.memberId,
            prepared.personal,
          ),
        };
        const archiveStarted = performance.now();
        await this.archiveBarrier();
        this.check(a.scope);
        this.metric("accepted", {
          elapsedMs: performance.now() - receivedAt,
          archiveMs: performance.now() - archiveStarted,
          eventBytes: new TextEncoder().encode(eventText).length,
          sequence: prepared.receipt.sequence,
        });
        for (const peer of this.ctx.getWebSockets()) {
          const pa = peer.deserializeAttachment() as Attachment;
          if (pa.ready && pa.scope) {
            try {
              this.check(pa.scope);
              await this.send(peer, {
                type: "event",
                event: this.visible(prepared.event, pa.scope.memberId),
              });
            } catch {
              peer.close(4003, "AUTH_EXPIRED");
            }
          }
        }
        await this.send(ws, { type: "ack", receipt: prepared.receipt });
        if (prepared.receipt.sequence % 200 === 0) await this.checkpoint();
        await this.schedule();
      } catch (error) {
        if (commitAttempted || (!admission && requestId)) {
          this.metric("uncertain-retry");
          this.state = undefined;
          ws.close(1012, "RETRY_SAME_COMMAND");
          return;
        }
        const message = error instanceof Error ? error.message : "SYNC_FAILED";
        try {
          ws.send(
            JSON.stringify({
              type: "error",
              id: requestId,
              definitive:
                admission &&
                ![
                  "AUTH_EXPIRED",
                  "UNAUTHENTICATED",
                  "MEMBERSHIP_CHANGED",
                ].includes(message),
              code: /^[A-Z_]+$/.test(message)
                ? message
                : "BUSINESS_RULE_REJECTED",
              message: /^[A-Z_]+$/.test(message)
                ? undefined
                : message.slice(0, 300),
            }),
          );
        } catch {}
        if (!requestId) ws.close(4000, "RECONNECT");
      }
    }).finally(() => {
      this.queued--;
      const pending = (this.socketQueued.get(ws) ?? 1) - 1;
      if (pending) this.socketQueued.set(ws, pending);
      else this.socketQueued.delete(ws);
    });
  }
  private visible(event: AcceptedEvent, member: string): AcceptedEvent {
    return event.memberId === member
      ? event
      : {
          sequence: event.sequence,
          shared: event.shared,
          acceptedAt: event.acceptedAt,
        };
  }
  private readEvent(sequence: number): AcceptedEvent {
    return JSON.parse(
      this.ctx.storage.sql
        .exec<{ data: string }>(
          "SELECT data FROM journal WHERE sequence=? ORDER BY part",
          sequence,
        )
        .toArray()
        .map((r) => r.data)
        .join(""),
    );
  }
  webSocketClose(ws: WebSocket) {
    this.readers.delete(ws);
    this.flows.delete(ws);
    try {
      ws.close(1000, "CLOSED");
    } catch {}
  }
  webSocketError(ws: WebSocket) {
    this.webSocketClose(ws);
  }
  private async schedule() {
    const hasImmediateWork = this.ctx.getWebSockets().length
      || this.ctx.storage.sql.exec("SELECT 1 FROM archive LIMIT 1").toArray().length
      || this.ctx.storage.sql.exec("SELECT 1 FROM checkpoint_outbox LIMIT 1").toArray().length;
    const state = this.meta("initialized") ? this.load() : undefined;
    const activationAt = state?.shared.planActivationJobs?.filter((job) => job.state === "pending")
      .map((job) => planActivationInstant(job.activateOn)).concat([...(state?.personal.values() ?? [])].flatMap((personal) =>
        (personal.planVersions ?? []).filter((version) => version.scope === "personal" && version.state === "scheduled")
          .map((version) => planActivationInstant(`${version.monthKey}-01`)))).sort((left, right) => left - right)[0];
    const desired = hasImmediateWork ? Date.now() + 5000 : activationAt;
    if (desired === undefined) return;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || desired < current - 1000) await this.ctx.storage.setAlarm(desired);
  }
  // R2 is part of acknowledgement durability. No public state or receipt may
  // pass this barrier while its checkpoint/event is still only in SQLite.
  private async archiveBarrier() {
    if (this.meta("checkpointRequired")) await this.checkpoint();
    const prefix = encodeURIComponent(this.meta("scope"));
    const proofKeys=this.ctx.storage.sql.exec<{key:string}>("SELECT DISTINCT key FROM import_proof_outbox").toArray();
    for(const {key} of proofKeys){
      const body=this.ctx.storage.sql.exec<{data:string}>("SELECT data FROM import_proof_outbox WHERE key=? ORDER BY part",key).toArray().map(row=>row.data).join('');
      await this.env.LEDGER_ARCHIVE.put(`${prefix}/${key}`,JSON.stringify(await seal(JSON.parse(body))));
      this.ctx.storage.sql.exec("DELETE FROM import_proof_outbox WHERE key=?",key);
    }
    const checkpointId = this.ctx.storage.sql
      .exec<{ id: number }>("SELECT max(id) id FROM checkpoint_outbox")
      .toArray()[0]?.id;
    if (checkpointId) {
      const body = this.ctx.storage.sql
        .exec<{ data: string }>(
          "SELECT data FROM checkpoint_outbox WHERE id=? ORDER BY part",
          checkpointId,
        )
        .toArray()
        .map((row) => row.data)
        .join("");
      const checkpoint = JSON.parse(body) as Sealed<Checkpoint>;
      const point = checkpoint.data.restorePoints?.find(
        (point) => point.sourceRevision === checkpoint.data.sequence,
      );
      if (point)
        await this.env.LEDGER_ARCHIVE.put(
          `${prefix}/restore/${point.id}`,
          body,
        );
      await this.env.LEDGER_ARCHIVE.put(`${prefix}/checkpoint`, body);
      this.set(
        "restorePoints",
        JSON.stringify(checkpoint.data.restorePoints ?? []),
      );
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec(
          "DELETE FROM checkpoint_outbox WHERE id<=?",
          checkpointId,
        );
        this.set("checkpointRequired", "");
      });
      await this.ctx.storage.sync();
    }
    const jobs = this.ctx.storage.sql
      .exec<{
        sequence: number;
        hash: string;
      }>("SELECT sequence,hash FROM archive ORDER BY sequence")
      .toArray();
    for (const row of jobs) {
      const event = this.readEvent(row.sequence);
      if ((await digest(event)) !== row.hash)
        throw new Error("ARCHIVE_CHECKSUM");
      const receipt = this.ctx.storage.sql
        .exec<{
          data: string;
        }>("SELECT data FROM receipts WHERE sequence=?", row.sequence)
        .toArray()[0];
      const record = await seal<ArchiveRecord>({
        scope: this.meta("scope"),
        authorityInstance: this.meta("authorityInstance"),
        event,
        receipt: receipt ? JSON.parse(receipt.data) : null,
      });
      await this.env.LEDGER_ARCHIVE.put(
        `${prefix}/events/${row.sequence}`,
        JSON.stringify(record),
      );
      await this.env.LEDGER_ARCHIVE.put(
        `${prefix}/tip`,
        JSON.stringify({
          version: 2,
          scope: this.meta("scope"),
          authorityInstance: this.meta("authorityInstance"),
          sequence: row.sequence,
        }),
      );
      this.ctx.storage.sql.exec(
        "DELETE FROM archive WHERE sequence=?",
        row.sequence,
      );
      await this.ctx.storage.sync();
    }
  }
  async alarm() {
    return this.serial(async () => {
      this.ctx.storage.sql.exec(
        "DELETE FROM tickets WHERE expires<=?",
        Date.now(),
      );
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment() as Attachment;
        if (a.deadline <= Date.now()) ws.close(4003, "AUTH_EXPIRED");
      }
      try {
        await this.activateDuePlans();
        await this.archiveBarrier();
      } finally {
        if (
          this.ctx.getWebSockets().length ||
          this.ctx.storage.sql.exec("SELECT 1 FROM archive LIMIT 1").toArray()
            .length ||
          this.ctx.storage.sql
            .exec("SELECT 1 FROM checkpoint_outbox LIMIT 1")
            .toArray().length
        )
          await this.ctx.storage.setAlarm(Date.now() + 5000);
        else await this.schedule();
      }
    });
  }
}
