import {decodeNestSource} from '../src/hearthside/nestDesignBinding.ts';
import {visibleNestSource,assertNestDocumentVisible,migrateNestDesign} from '../src/hearthside/nestDesignSource.ts';
import {readSharedLifeRestorePreview,type RestoreDesignAccess} from '../src/hearthside/sharedLifeRestore.ts';
import {rejectLegacyWinPublication} from '../src/hearthside/winMemory.ts';
import {createEncounterDesign,encounterDesignIdentity} from '../src/hearthside/encounterDesign.ts';
import {commitHearthside} from '../src/hearthside/commands.ts';
import {identifier,object} from '../src/hearthside/contracts.ts';
import {ENCOUNTER_WARDROBE} from '../src/hearthside/encounterWardrobe.ts';
import {decodeEncounterCommand,encounterCompositionDigest,type EncounterRevealBinding,type EncounterCommand} from '../src/hearthside/encounterContracts.ts';
import {guestSourceCatalogue} from './hearthsideGuestSource.ts';
import {captureGuestSources,validateGuestSources} from '../src/hearthside/guestProjection.ts';
import {decodeGuestPrepare,decodeGuestSourceProof,type GuestPrepareInput,type GuestSourceProof} from '../src/hearthside/guestContracts.ts';
import type {WorkspaceEnv} from './workspace/env.ts';
import {consumeWorkspaceRpc} from '../src/hearthside/workspaceRpc.ts';
import {decodeWorkspaceExperienceReference,personalWorkspaceExperienceContext,workspaceExperienceContext,workspaceExperienceDigest,type WorkspaceExperienceContext,type WorkspaceExperienceReference} from '../src/hearthside/workspaceContext.ts';
import {decodePersonalLife} from '../src/hearthside/personalLifeContracts.ts';
import {acceptWorkspacePublicationState} from '../src/hearthside/workspacePublicationState.ts';
import {decodeArtifactPublication,decodePreparedExperienceArtifact,artifactPublication,type ArtifactPublication,type ArtifactPublicationReceipt} from '../src/hearthside/workspacePublication.ts';
import {decodeRecordedRoom} from '../src/hearthside/roomHistory.ts';
import {decodeStudioHandoff} from '../src/hearthside/studioHandoff.ts';
import {validateMemoryCandidate} from '../src/hearthside/commands.ts';
import {decodeMemoryPublicationBinding,memoryCompositionDigest,type MemoryPublicationBinding,type MemoryPublicationCandidate,type VaultMemoryCandidateValidation,type VaultMemoryEvidence} from '../src/hearthside/memoryPublication.ts';
import {decodeHearthside,memoryKeptByEveryone,type MemoryComposition,type HearthsideContentSnapshot} from '../src/hearthside/contracts.ts';
/// <reference path="./ledger-platform.d.ts" />
import {herculesActionsEnabled} from '../src/core/herculesActionPolicy.ts';
import { compareImportParity } from "../src/ledgerSync/importParity.ts";
import { IncrementalBooksGuard } from "../src/core/booksValidation.ts";
import {
  seal,
  restoreArchive,
  assertRecoveredPersonalDesignArchives,
  type Checkpoint,
  type Sealed,
  type ArchiveRecord,
  type RestorePointSummary,
} from "../src/ledgerSync/backup.ts";
import type {
  DurableObjectState,
  DurableObjectNamespace,
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
import { executeHerculesReadToolPlan, HERCULES_READ_TOOL_NAMES } from "../src/core/herculesTools.ts";
import { executeWorkspaceActionQuery, isWorkspaceActionQuery } from "../src/workspace/actionQueries.ts";
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
  canonical,
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
  WIRE_LIMIT,
} from "../src/ledgerSync/wire.ts";
import { importLegacy, supabase, type AuthEnv } from "./ledgerSyncAuth.ts";
import { importReservationDigests, reservationDigest } from "./ledgerReservations.ts";
import {HearthsideAcceptanceStore} from './hearthsideAcceptanceStore.ts';
import type {VaultReference} from '../src/hearthside/vaultContracts.ts';
import { HearthsideDesignStore } from './hearthsideDesignStore.ts';
import { acceptKittyDesignOperation, projectKittyDesign, createKittyDesignDocument, migrateLegacyKittyStudio, snapshotKittyDesignRevision, type KittyDesignReceipt } from '../src/hearthside/design.ts';
import { decodeKittyDesignOperation, designId, designInteger, designRecord, KittyDesignError, type KittyDesignDocument } from '../src/hearthside/designContracts.ts';
import { kittyDesignReference } from '../src/hearthside/design.ts';
import { applyAcceptedDesignReference } from '../src/hearthside/designProjection.ts';
import type { DesignArchiveReference } from '../src/hearthside/designArchive.ts';
import { decodeCreativePresence, type CreativeTarget } from '../src/hearthside/creativePresence.ts';
import { decodeWorldPresence, worldPeerKey, WORLD_MIN_GAP_MS, WORLD_TARGET_MS, type WorldTarget } from '../src/ledgerSync/worldPresenceWire.ts';
type Env = AuthEnv & { HEARTHSIDE_GUESTS_ENABLED?:string; HEARTHSIDE_GUEST_PUBLICATION?:string;  HERCULES_SHARED_WORKSPACES?:WorkspaceEnv['HERCULES_SHARED_WORKSPACES']; HERCULES_WORKSPACE_ENABLED?:string; LEDGER_ARCHIVE: R2Bucket; HEARTHSIDE_DESIGN_WRITES?:string; HEARTHSIDE_VAULT_PUBLICATION?:string; HEARTHSIDE_VAULTS?:DurableObjectNamespace; HERCULES_ACTIONS_ENABLED?: string; HERCULES_EXTERNAL_CALENDAR_WRITES?: string; HERCULES_WORKSPACES?: DurableObjectNamespace; HERCULES_WORKSPACE_EXECUTION?: string };
type Attachment = {
  scope?: Scope;
  deadline: number;
  ready: boolean;
  lane?: "ledger" | "presence";
  presenceAt?: number;
  creative?: {target:CreativeTarget;seenAt:number};
  previewAt?:number;
  creativeJoinAt?:number;
  /** The world-presence lane's joined target: which shared place this socket's body is standing in. */
  world?: {target:WorldTarget;seenAt:number};
  worldStepAt?:number;
  worldJoinAt?:number;
};
export class LedgerRoom extends DurableObject<Env> {
  private designs:HearthsideDesignStore;
  private vaultAcceptances:HearthsideAcceptanceStore;
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
    this.designs=new HearthsideDesignStore(ctx.storage.sql,env.LEDGER_ARCHIVE);
    this.vaultAcceptances=new HearthsideAcceptanceStore(ctx.storage.sql,env.LEDGER_ARCHIVE);
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
      for(const row of household.kittyNestDesigns??[]){if(!row.designRef)continue;const doc=this.designs.read(row.designRef.designId);if(!doc||!doc.nest||doc.nest.view!==row.visibility||doc.nest.designKey!==row.bankKey||doc.scope.ownerMemberId!==(row.visibility==='personal'?row.createdBy:null)||doc.revision<row.designRef.revision)throw Error('DESIGN_ARCHIVE_RESTORE_REQUIRED');}
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
      for(const row of household.kittyNestDesigns??[]){if(!row.designRef)continue;const doc=this.designs.read(row.designRef.designId);if(!doc||!doc.nest||doc.nest.view!==row.visibility||doc.nest.designKey!==row.bankKey||doc.scope.ownerMemberId!==(row.visibility==='personal'?row.createdBy:null)||doc.revision<row.designRef.revision)throw Error('DESIGN_ARCHIVE_RESTORE_REQUIRED');}
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
      designs: this.designs.references(),
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
      const restoredDesigns:Array<{document:KittyDesignDocument;reference:DesignArchiveReference}>=[];
      for(const reference of restored.designs??[])restoredDesigns.push({reference,document:await this.designs.recover(`${scope.environment}/${scope.householdId}`,reference)});
      assertRecoveredPersonalDesignArchives(restored,restoredDesigns);
      this.check(scope);
      this.ctx.storage.transactionSync(() => {
        for(const {document,reference} of restoredDesigns)this.designs.commit(document,reference,restored.sequence,{actor:'authority-recovery',request:'archive-recovery'});
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
  private hearthsideMember(scope:Scope){
    this.check(scope);const state=this.load(),personal=state.personal.get(scope.memberId);
    if(!personal||!state.shared.members.some(member=>member.active&&member.id===scope.memberId))throw Error('FORBIDDEN');
    return {state,household:assembleHousehold(state.shared,personal,{linked:true})};
  }
  private sharedLifeRestoreDesignAccess(scope:Scope):RestoreDesignAccess {
    return reference=>{try{const {household}=this.hearthsideMember(scope);const document=this.designs.read(reference.documentId);
      if(!document||document.scope.environment!==scope.environment||document.scope.householdId!==scope.householdId||document.scope.ownerMemberId!==null)return false;
      assertNestDocumentVisible(household,scope.memberId,document);snapshotKittyDesignRevision(document,reference.pieceId,reference.revision);
      return projectKittyDesign(document).pieces.some(p=>p.piece.id===reference.pieceId&&p.status!=='archived');
    }catch{return false;}};
  }
  async sharedLifeRestorePreview(scope:Scope,input:unknown){
    return this.serial(async()=>{this.hearthsideMember(scope);await this.archiveBarrier();this.hearthsideMember(scope);
      return readSharedLifeRestorePreview(input,{scope,current:()=>this.hearthsideMember(scope).household,assertCurrent:()=>{this.hearthsideMember(scope);},point:id=>this.restorePoint(id),designAccess:this.sharedLifeRestoreDesignAccess(scope),audienceEpoch:()=>Number(this.meta("acl","1"))});
    });
  }
  private memoryDesigns(scope:Scope,memory:MemoryComposition){
    for(const ref of memory.designs){const document=this.designs.read(ref.documentId);
      if(!document||document.scope.ownerMemberId!==null||document.scope.environment!==scope.environment||document.scope.householdId!==scope.householdId)throw Error('HEARTHSIDE_SHARED_DESIGN_REQUIRED');
      assertNestDocumentVisible(this.hearthsideMember(scope).household,scope.memberId,document);snapshotKittyDesignRevision(document,ref.pieceId,ref.revision);
    }
  }
  async workspaceExperience(scope:Scope,raw:WorkspaceExperienceReference){
    return this.serial(async()=>{const reference=decodeWorkspaceExperienceReference(raw);
      if(reference.audience==='personal'&&reference.ownerMemberId!==scope.memberId)throw Error('FORBIDDEN');
      const read=():WorkspaceExperienceContext=>{const {household}=this.hearthsideMember(scope);
        if(reference.audience==='personal'){
          const personal=decodePersonalLife(household.personalLife,scope.memberId),experience=personal.experiences.find(row=>row.id===reference.id&&row.state!=='archived');
          if(!experience)throw Error('EXPERIENCE_CONTEXT_CHANGED');return personalWorkspaceExperienceContext(experience,scope.memberId);
        }
        const experience=household.hearthside?.experiences.find(row=>row.id===reference.id&&row.state!=='archived');
        if(!experience)throw Error('EXPERIENCE_CONTEXT_CHANGED');return workspaceExperienceContext(experience);
      };
      const before=read();await this.archiveBarrier();const accepted=read();
      if(workspaceExperienceDigest(before)!==workspaceExperienceDigest(accepted))throw Error('EXPERIENCE_CONTEXT_CHANGED');return accepted;
    });
  }
  async workspaceAcceptArtifact(scope:Scope,publication:ArtifactPublication){return this.recordWorkspacePublication(scope,publication,'accepted');}
  async workspaceWithdrawArtifact(scope:Scope,publication:ArtifactPublication){return this.recordWorkspacePublication(scope,publication,'withdrawn');}
  private async recordWorkspacePublication(scope:Scope,raw:ArtifactPublication,mode:'accepted'|'withdrawn'):Promise<ArtifactPublicationReceipt>{
    return this.serial(async()=>{
      const publication=decodeArtifactPublication(raw),check=()=>{this.hearthsideMember(scope);if(scope.environment!=='development'||this.env.HERCULES_WORKSPACE_ENABLED!=='true'||!this.env.HERCULES_SHARED_WORKSPACES)throw Error('WORKSPACE_PUBLICATION_DISABLED');};
      check();if(publication.sharedBy!==scope.memberId||publication.state!==mode)throw Error('HEARTHSIDE_ARTIFACT_AUTHOR_REQUIRED');
      const namespace=this.env.HERCULES_SHARED_WORKSPACES!,shared=namespace.get(namespace.idFromName(`${scope.environment}/${scope.householdId}`));
      const value=consumeWorkspaceRpc(await shared.preparedExperienceFor(scope,publication.id));check();
      if(!value)throw Error('ARTIFACT_SOURCE_FORBIDDEN');const copy=decodePreparedExperienceArtifact(value);
      if(mode==='withdrawn'?copy.state!=='withdrawn':copy.state==='withdrawn')throw Error('ARTIFACT_WITHDRAWN');
      if(canonical(artifactPublication(copy,mode))!==canonical(publication))throw Error('ARTIFACT_COPY_CHANGED');
      await this.archiveBarrier();check();
      const id='HS-ARTIFACT-'+await digest([publication.id,mode]),prior=this.ctx.storage.sql.exec<{data:string}>('SELECT data FROM receipts WHERE id=?',id).toArray()[0];
      if(prior){const receipt=JSON.parse(prior.data) as Receipt;if(receipt.actor!==scope.memberId||receipt.digest!==await digest(publication))throw Error('ARTIFACT_RECEIPT_MISMATCH');check();return {version:1,id:publication.id,publication,acceptedSequence:receipt.sequence};}
      const {state,household}=this.hearthsideMember(scope),next=acceptWorkspacePublicationState(household,publication,scope.memberId);
      next.commandReceipts=[];next.restorePoints=[];next.revision=state.sequence+1;next.baseRevision=state.sequence+1;assertAcceptableBooks(next);
      const split=splitForSync(next,scope.memberId),acceptedAt=new Date().toISOString(),event:AcceptedEvent={sequence:next.revision,shared:difference(state.shared,split.shared),acceptedAt};
      const kind=mode==='accepted'?'acceptHearthsideWorkspaceArtifact':'withdrawHearthsideWorkspaceArtifact';
      const receipt:Receipt={id,sequence:event.sequence,digest:await digest(publication),actor:scope.memberId,postedIds:[],warnings:[],undo:{id,label:mode==='accepted'?'Shared a reviewed artifact':'Withdrew a shared artifact',postedIds:[],actorMemberId:scope.memberId,commandKind:kind},commandKind:kind};
      const eventText=JSON.stringify(event),eventHash=await digest(event);check();if(this.load().sequence!==state.sequence)throw Error('HEARTHSIDE_CHANGED');
      this.ctx.storage.transactionSync(()=>{
        this.writeProjection('shared',event.shared);
        for(let at=0;at<eventText.length;at+=60000)this.ctx.storage.sql.exec('INSERT INTO journal VALUES (?,?,?)',event.sequence,at/60000,eventText.slice(at,at+60000));
        this.ctx.storage.sql.exec('INSERT INTO receipts VALUES (?,?,?,?,?)',id,receipt.actor,receipt.digest,receipt.sequence,JSON.stringify(receipt));
        this.ctx.storage.sql.exec('INSERT INTO archive VALUES (?,?)',receipt.sequence,eventHash);this.set('sequence',String(receipt.sequence));
      });
      this.state={sequence:receipt.sequence,shared:split.shared,personal:state.personal};
      await this.ctx.storage.sync();await this.archiveBarrier();check();
      for(const peer of this.ctx.getWebSockets()){const attachment=peer.deserializeAttachment() as Attachment;if(attachment.ready&&attachment.scope){try{this.check(attachment.scope);await this.send(peer,{type:'event',event:this.visible(event,attachment.scope.memberId)});}catch{peer.close(4003,'AUTH_EXPIRED');}}}
      await this.schedule();check();return {version:1,id:publication.id,publication,acceptedSequence:receipt.sequence};
    });
  }
  async vaultEncounterContext(scope:Scope,id:string){
    return this.serial(async()=>{const {state}=this.hearthsideMember(scope),encounter=state.shared.hearthside?.encounters?.find(e=>e.id===identifier(id));
      const members=state.shared.members.filter(m=>m.active).map(m=>m.id).sort();
      if(!encounter||canonical(members)!==canonical(encounter.participantMemberIds)||!members.includes(scope.memberId))throw Error('ENCOUNTER_SCOPE_CHANGED');
      return {id:encounter.id,packId:encounter.packId,participantMemberIds:members,wardrobeIds:ENCOUNTER_WARDROBE.map(w=>w.id)};
    });
  }
  /** Fresh HTTP Auth and private audience verification precede the serialized canonical write. */
  async encounterCommand(scope:Scope,authorization:string,raw:unknown){
    const value=object(raw,['version','id','operation']);if(value.version!==1)throw Error('HEARTHSIDE_UPDATE_REQUIRED');
    const requestId=identifier(value.id),id='HS-ENCOUNTER-'+requestId,op=decodeEncounterCommand(value.operation),hash=await digest({version:1,id:requestId,operation:op});
    const check=()=>{this.hearthsideMember(scope);if(scope.environment!=='development'||this.env.HEARTHSIDE_VAULT_PUBLICATION!=='true'&&!['encounter.pause'].includes(op.kind))throw Error('PUBLICATION_DISABLED');};
    const previous=()=>{const row=this.ctx.storage.sql.exec<{data:string}>('SELECT data FROM receipts WHERE id=?',id).toArray()[0];if(!row)return null;const r=JSON.parse(row.data) as Receipt;if(r.actor!==scope.memberId||r.digest!==hash)throw Error('REQUEST_ID_REUSED');return r;};
    const before=await this.serial(async()=>{check();await this.archiveBarrier();check();const {state}=this.hearthsideMember(scope);return {receipt:previous(),encounter:state.shared.hearthside?.encounters?.find(e=>e.id===op.id)??null,members:state.shared.members.filter(m=>m.active).map(m=>m.id).sort()};});
    if(before.receipt)return {version:1,receipt:before.receipt};
    const binding=op.kind==='encounter.reveal'?op.binding:['encounter.choose','encounter.keep','encounter.outcome','encounter.create-piece'].includes(op.kind)?before.encounter?.reveal:null;
    // This RPC calls back into vaultEncounterContext. Never run it under serial().
    if(binding)await this.memoryVault(scope).authorizeEncounterRevealFor(scope,binding,authorization);
    return this.serial(async()=>{check();await this.archiveBarrier();check();const prior=previous();if(prior)return {version:1,receipt:prior};
      const {state,household}=this.hearthsideMember(scope),current=state.shared.hearthside?.encounters?.find(e=>e.id===op.id)??null;
      if(canonical(current)!==canonical(before.encounter)||canonical(state.shared.members.filter(m=>m.active).map(m=>m.id).sort())!==canonical(before.members))throw Error('ENCOUNTER_CHANGED');
      if(binding){const evidence=consumeWorkspaceRpc(await this.memoryVault(scope).checkEncounterRevealFor(scope,binding));if(canonical(evidence)!==canonical(binding))throw Error('REVEAL_REQUIRED');check();}
      if(op.kind==='encounter.outcome'){
        const o=op.outcome;
        if(o.kind==='design'){const d=this.designs.read(o.designId!);if(!d||d.scope.ownerMemberId!==null||d.scope.environment!==scope.environment||d.scope.householdId!==scope.householdId||!projectKittyDesign(d).pieces.some(p=>p.piece.id===o.id&&p.status!=='archived'))throw Error('OUTCOME_REVIEW_REQUIRED');snapshotKittyDesignRevision(d,o.id,o.revision);}
        else{const m=state.shared.hearthside?.memories.find(m=>m.id===o.id&&m.revision===o.revision);if(!m||!memoryKeptByEveryone(m,before.members))throw Error('OUTCOME_REVIEW_REQUIRED');this.memoryDesigns(scope,m);if(m.publication&&!await this.memoryVault(scope).isMemoryActiveFor(scope,m.publication))throw Error('OUTCOME_REVIEW_REQUIRED');}
      }
      let creative:KittyDesignDocument|null=null,working=household,operation:EncounterCommand=op;
      if(op.kind==='encounter.create-piece'){
        if(this.env.HEARTHSIDE_DESIGN_WRITES!=='true'||!current||current.keptMemberIds.length!==2||current.pausedMemberIds.length||await encounterCompositionDigest(current)!==op.digest)throw Error('OUTCOME_REVIEW_REQUIRED');
        const ids=encounterDesignIdentity(scope.environment,scope.householdId,current.id,op.digest),existing=this.designs.read(ids.designId);
        const priorOutcome=current.outcomes.find(o=>o.kind==='design'&&o.id===ids.pieceId&&o.designId===ids.designId&&o.recipeDigest===op.digest);
        if(existing&&!priorOutcome)throw Error('ENCOUNTER_DESIGN_ID_CONFLICT');
        if(!existing){creative=await createEncounterDesign(current,scope,new Date().toISOString());working=applyAcceptedDesignReference(household,creative,null);}
        operation={kind:'encounter.outcome',id:op.id,digest:op.digest,outcome:priorOutcome??{kind:'design',id:ids.pieceId,designId:ids.designId,revision:creative!.revision,recipeDigest:op.digest}};
      }
      const next=commitHearthside(working,{version:1,id:requestId,scope:{environment:scope.environment,householdId:scope.householdId,memberId:scope.memberId},operation}).household;
      next.commandReceipts=[];next.restorePoints=[];next.revision=state.sequence+1;next.baseRevision=next.revision;assertAcceptableBooks(next);
      const split=splitForSync(next,scope.memberId),event:AcceptedEvent={sequence:next.revision,shared:difference(state.shared,split.shared),acceptedAt:new Date().toISOString()};
      const receipt:Receipt={id,sequence:event.sequence,digest:hash,actor:scope.memberId,postedIds:[],warnings:[],undo:{id,label:'Shared encounter',postedIds:[],actorMemberId:scope.memberId,commandKind:'hearthsideEncounter'},commandKind:'hearthsideEncounter'};
      const creativeReference=creative?await this.designs.prepare(creative,null):null;
      const eventText=JSON.stringify(event),eventHash=await digest(event);check();if(this.load().sequence!==state.sequence)throw Error('ENCOUNTER_CHANGED');
      this.ctx.storage.transactionSync(()=>{if(creative&&creativeReference){this.designs.commit(creative,creativeReference,event.sequence,{actor:scope.memberId,request:id});this.ctx.storage.sql.exec('INSERT INTO creative_broadcast VALUES (?)',event.sequence);}
        this.writeProjection('shared',event.shared);
        for(let at=0;at<eventText.length;at+=60000)this.ctx.storage.sql.exec('INSERT INTO journal VALUES (?,?,?)',event.sequence,at/60000,eventText.slice(at,at+60000));
        this.ctx.storage.sql.exec('INSERT INTO receipts VALUES (?,?,?,?,?)',id,receipt.actor,hash,receipt.sequence,JSON.stringify(receipt));
        this.ctx.storage.sql.exec('INSERT INTO archive VALUES (?,?)',receipt.sequence,eventHash);this.set('sequence',String(receipt.sequence));});
      this.state={sequence:receipt.sequence,shared:split.shared,personal:state.personal};if(creative&&creativeReference)this.designs.remember(creative,creativeReference);await this.ctx.storage.sync();await this.archiveBarrier();check();
      for(const peer of this.ctx.getWebSockets()){const a=peer.deserializeAttachment() as Attachment;if(a.ready&&a.scope){try{this.check(a.scope);await this.send(peer,{type:'event',event:this.visible(event,a.scope.memberId)});}catch{peer.close(4003,'AUTH_EXPIRED');}}}
      await this.schedule();return {version:1,receipt};
    });
  }
  async validateVaultMemoryCandidate(scope:Scope,candidate:unknown,expectedRevision:number):Promise<VaultMemoryCandidateValidation>{
    return this.serial(async()=>{
      const {household}=this.hearthsideMember(scope),value=validateMemoryCandidate(household,scope.memberId,candidate,expectedRevision);
      this.memoryDesigns(scope,value);const compositionDigest=await memoryCompositionDigest(value);this.hearthsideMember(scope);
      return {candidate:value,compositionDigest};
    });
  }
  private async memoryAccessNow(scope:Scope,raw:MemoryPublicationBinding,mediaId:string|null){
    const binding=decodeMemoryPublicationBinding(raw),{state}=this.hearthsideMember(scope),memory=state.shared.hearthside?.memories.find(m=>m.id===binding.memoryId);
    const current=Boolean(memory&&memory.publication&&!memory.withdrawn&&memory.revision===binding.memoryRevision&&canonical(memory.publication)===canonical(binding)&&(mediaId===null||memory.media.some(m=>m.contentId===mediaId))&&await memoryCompositionDigest(memory)===binding.compositionDigest);
    this.hearthsideMember(scope);
    return {current,kept:current&&memoryKeptByEveryone(memory!,state.shared.members.filter(m=>m.active).map(m=>m.id))};
  }
  async vaultMemoryAccess(scope:Scope,binding:MemoryPublicationBinding,mediaId:string|null){
    return this.serial(()=>this.memoryAccessNow(scope,binding,mediaId));
  }
  /** Guest service gets a detached allowlist, never a household replica or private media capability. */
  private async guestCatalogue(scope:Scope){
    const captured=await this.serial(async()=>{this.guestScope(scope);await this.archiveBarrier();const {state}=this.hearthsideMember(scope);this.guestScope(scope);
      return {sequence:state.sequence,state:decodeHearthside(state.shared.hearthside),memberIds:state.shared.members.filter(m=>m.active).map(m=>m.id)};
    });
    const catalogue=guestSourceCatalogue(captured.state,captured.memberIds,{
      piece:(designId,pieceId,revision)=>this.serial(async()=>{this.guestScope(scope);const document=this.designs.read(designId);
        if(!document||document.scope.environment!==scope.environment||document.scope.householdId!==scope.householdId||document.scope.ownerMemberId!==null)return null;
        const current=projectKittyDesign(document).pieces.find(p=>p.piece.id===pieceId);if(!current)return null;
        try{assertNestDocumentVisible(this.hearthsideMember(scope).household,scope.memberId,document);const snapshot=snapshotKittyDesignRevision(document,pieceId,revision);return {revision,shared:true,archived:current.status==='archived',piece:snapshot.piece,...(snapshot.appearance?{ornament:snapshot.appearance}:{})};}catch{return null;}
      }),
      active:binding=>this.memoryVault(scope).isMemoryActiveFor(scope,binding),
      media:(id,publicationId)=>this.memoryVault(scope).mediaFor(scope,id,publicationId,'active'),
    });
    return {catalogue,unchanged:()=>this.serial(async()=>{this.guestScope(scope);return this.load().sequence===captured.sequence;})};
  }
  private guestScope(scope:Scope){this.hearthsideMember(scope);if(scope.environment!=='development'||this.env.HEARTHSIDE_GUESTS_ENABLED!=='true')throw Error('GUEST_DISABLED');}
  async captureGuestSource(scope:Scope,raw:GuestPrepareInput){
    if(this.env.HEARTHSIDE_GUEST_PUBLICATION!=='true')throw Error('GUEST_PUBLICATION_DISABLED');
    const input=decodeGuestPrepare(raw),source=await this.guestCatalogue(scope),capture=await captureGuestSources(input,source.catalogue);
    if(!await source.unchanged())throw Error('GUEST_SOURCE_CHANGED');return capture;
  }
  async validateGuestSource(scope:Scope,raw:GuestSourceProof,mode:'activation'|'visit'){
    try{if(mode!=='activation'&&mode!=='visit')return false;const proof=decodeGuestSourceProof(raw),source=await this.guestCatalogue(scope);
      return await validateGuestSources(proof,source.catalogue,mode)&&await source.unchanged();
    }catch{return false;}
  }
  private memoryVault(scope:Scope){
    if(!this.env.HEARTHSIDE_VAULTS)throw Error('HEARTHSIDE_CONTENT_PUBLICATION_REQUIRED');
    return this.env.HEARTHSIDE_VAULTS.get(this.env.HEARTHSIDE_VAULTS.idFromName(`${scope.environment}/${scope.householdId}`)) as unknown as {
      checkMemoryPublicationFor(scope:Scope,binding:MemoryPublicationBinding,candidate:MemoryPublicationCandidate,mode:'compose'|'keep'):Promise<VaultMemoryEvidence>;
      checkEncounterRevealFor(scope:Scope,binding:EncounterRevealBinding):Promise<EncounterRevealBinding>;
      authorizeEncounterRevealFor(scope:Scope,binding:EncounterRevealBinding,authorization:string):Promise<EncounterRevealBinding>;
      isMemoryRevokedFor(scope:Scope,binding:MemoryPublicationBinding):Promise<boolean>;
      isMemoryActiveFor(scope:Scope,binding:MemoryPublicationBinding):Promise<boolean>;
      mediaFor(scope:Scope,id:string,publicationId:string,mode:'active'):Promise<Response>;
    };
  }
  /** Trusted Vault RPC only. These private receipts never enter the household journal. */
  async acceptVaultPublication(scope:Scope,reference:VaultReference){
    return this.serial(async()=>{
      const check=()=>{this.check(scope);if(scope.environment!=='development'||(reference.kind==='guest'?this.env.HEARTHSIDE_GUEST_PUBLICATION!=='true'||this.env.HEARTHSIDE_GUESTS_ENABLED!=='true':this.env.HEARTHSIDE_VAULT_PUBLICATION!=='true'))throw Error('PUBLICATION_DISABLED');if(!this.load().shared.members.some(member=>member.active&&member.id===scope.memberId))throw Error('FORBIDDEN');};
      check();if(reference.kind==='shared-memory'&&(!reference.memory||!(await this.memoryAccessNow(scope,reference.memory,null)).kept))throw Error('HEARTHSIDE_MEMORY_REVIEW_REQUIRED');
      const accepted=await this.vaultAcceptances.accept(scope,reference,check);await this.ctx.storage.sync();check();return accepted;
    });
  }
  async vaultMediaReferenced(scope:Scope,mediaId:string){
    return this.serial(async()=>{
      this.check(scope);const state=this.load();if(!state.shared.members.some(member=>member.active&&member.id===scope.memberId))throw Error('FORBIDDEN');
      return Boolean(state.shared.hearthside?.memories.some(memory=>!memory.withdrawn&&memory.media.some(media=>media.contentId===mediaId)));
    });
  }
  /** Creative documents share authenticated authority and durability, never financial commands. */
  async design(scope:Scope, raw:unknown) {
    return this.serial(async()=>{
      this.check(scope);
      await this.archiveBarrier();
      this.check(scope);
      const state=this.load(), personal=state.personal.get(scope.memberId);
      if(!personal || !state.shared.members.some(member=>member.active&&member.id===scope.memberId))throw Error('FORBIDDEN');
      designRecord(raw,['version','kind','designId','bankId','audience','nestSource','operation','pieceId','revision','knownRevision'],['version','kind']);
      if(raw.version!==1)throw Error('KITTY_DESIGN_UPDATE_REQUIRED');
      const household=assembleHousehold(state.shared,personal,{linked:true});
      const reply=(document:KittyDesignDocument,receipt:KittyDesignReceipt|null,sequence:number)=>{
        if(raw.knownRevision!==undefined){
          designInteger(raw.knownRevision);
          if(raw.knownRevision>document.revision)throw Error('DESIGN_REVISION_AHEAD');
          return {version:1,delta:{designId:document.id,baseRevision:raw.knownRevision,revision:document.revision,entries:document.operations.slice(raw.knownRevision as number)},receipt,sequence};
        }
        return {version:1,document,receipt,sequence};
      };
      const read=(id:string)=>{
        const document=this.designs.read(id);
        if(!document || document.scope.ownerMemberId!==null&&document.scope.ownerMemberId!==scope.memberId)throw Error('DESIGN_NOT_FOUND');
        if(document.scope.environment!==scope.environment||document.scope.householdId!==scope.householdId)throw Error('SCOPE_MISMATCH');
        assertNestDocumentVisible(household,scope.memberId,document);return document;
      };
      if(raw.kind==='read'||raw.kind==='snapshot') {
        designRecord(raw,raw.kind==='read'?['version','kind','designId','knownRevision']:['version','kind','designId','pieceId','revision'],raw.kind==='read'?['version','kind','designId']:['version','kind','designId','pieceId','revision']);designId(raw.designId);
        const document=read(raw.designId);
        if(raw.kind==='snapshot'){designId(raw.pieceId);designInteger(raw.revision);return {version:1,snapshot:snapshotKittyDesignRevision(document,raw.pieceId,raw.revision),sequence:state.sequence};}
        return reply(document,null,state.sequence);
      }
      if(this.env.HEARTHSIDE_DESIGN_WRITES!=='true'||scope.environment==='production')throw Error('KITTY_DESIGN_WRITES_PAUSED');
      let document:KittyDesignDocument,bankId:string|null,id:string,creativeReceipt:KittyDesignReceipt|null=null;
      if(raw.kind==='create') {
        designRecord(raw,['version','kind','designId','bankId','audience','nestSource'],['version','kind','designId','bankId']);designId(raw.designId);if(raw.bankId!==null)designId(raw.bankId);if(raw.audience!==undefined&&raw.audience!=='personal')throw Error('DESIGN_AUDIENCE_CONFLICT');
        bankId=raw.bankId as string|null;
        const nest=raw.nestSource===undefined?null:visibleNestSource(household,scope.memberId,decodeNestSource(raw.nestSource));
        if(nest&&bankId!==null)throw Error('DESIGN_NEST_GOAL_CONFLICT');
        if(raw.audience==='personal'&&(bankId!==null||nest))throw Error('DESIGN_AUDIENCE_CONFLICT');
        if(nest){const existing=this.designs.forNest(nest.source,nest.source.view==='personal'?scope.memberId:null);if(existing){document=read(existing.id);return {version:1,document,receipt:null,sequence:state.sequence};}if(nest.row.designRef)throw Error('DESIGN_BANK_REFERENCE_RECOVERY_REQUIRED');}
        const goal=bankId===null?null:household.goals.find(g=>g.id===bankId&&(g.shared||g.ownerMemberId===scope.memberId));
        if(bankId!==null&&!goal)throw Error('DESIGN_BANK_UNAVAILABLE');
        if(goal?.envelope?.designRef){document=read(goal.envelope.designRef.designId);return {version:1,document,receipt:null,sequence:state.sequence};}
        const bankHistory=bankId===null?null:this.designs.forBank(bankId);
        if(bankHistory)throw Error('DESIGN_BANK_REFERENCE_RECOVERY_REQUIRED');
        const ownerMemberId=raw.audience==='personal'||goal&&!goal.shared||nest?.source.view==='personal'?scope.memberId:null;
        const prior=this.designs.header(raw.designId);
        if(prior){document=read(raw.designId);if(prior.bank!==bankId||document.scope.ownerMemberId!==ownerMemberId||JSON.stringify(document.nest??null)!==JSON.stringify(nest?.source??null))throw Error('DESIGN_ID_CONFLICT');return {version:1,document,receipt:null,sequence:state.sequence};}
        const designScope={environment:scope.environment,householdId:scope.householdId,ownerMemberId};
        document=nest?migrateNestDesign(household,scope.memberId,raw.designId,nest.source):goal?migrateLegacyKittyStudio(raw.designId,designScope,goal.envelope?.studio,`migration:${await digest([raw.designId,bankId])}`):createKittyDesignDocument(raw.designId,designScope);
        id=`design-create:${document.id}`;
      } else if(raw.kind==='operate') {
        designRecord(raw,['version','kind','operation','knownRevision'],['version','kind','operation']);const operation=decodeKittyDesignOperation(raw.operation);
        if(raw.knownRevision!==undefined)designInteger(raw.knownRevision);
        document=read(operation.designId);if(raw.knownRevision!==undefined&&raw.knownRevision>document.revision)throw Error('DESIGN_REVISION_AHEAD');bankId=this.designs.header(document.id)!.bank;
        const acceptance=acceptKittyDesignOperation(document,operation,{environment:scope.environment,householdId:scope.householdId,actorId:scope.memberId,order:document.revision+1,acceptedAt:new Date().toISOString()});
        if(acceptance.duplicate)return reply(document,acceptance.receipt,state.sequence);
        document=acceptance.document;creativeReceipt=acceptance.receipt;id=`design-op:${await digest([document.id,operation.id])}`;
      } else throw Error('KITTY_DESIGN_OPERATION_UNSUPPORTED');
      const intentHash=await digest({scope:`${scope.environment}/${scope.householdId}`,actor:scope.memberId,raw});
      const existingReceipt=this.ctx.storage.sql.exec('SELECT id FROM receipts WHERE id=?',id).toArray()[0];
      if(existingReceipt)throw Error('DESIGN_RECEIPT_CONFLICT');
      const acceptedAt=new Date().toISOString();
      const projected=applyAcceptedDesignReference(household,document,bankId,acceptedAt);
      const split=splitForSync({...projected,revision:state.sequence+1,baseRevision:state.sequence+1,commandReceipts:[],restorePoints:[]},scope.memberId);
      const event:AcceptedEvent={sequence:state.sequence+1,shared:difference(state.shared,split.shared),...(document.scope.ownerMemberId!==null?{personal:difference(personal,split.personal),memberId:scope.memberId}:{}),acceptedAt};
      const receipt:Receipt={id,actor:scope.memberId,digest:intentHash,sequence:event.sequence,postedIds:[],warnings:[],commandKind:'kittyDesignOperation',undo:{id,label:'Creative edit',postedIds:[],actorMemberId:scope.memberId,commandKind:'kittyDesignOperation'},...(document.scope.ownerMemberId!==null?{persistenceScope:'member-personal',personalMemberId:scope.memberId}:{})};
      const eventText=JSON.stringify(event);
      const byteLength=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length;
      if(byteLength({event,receipt})>WIRE_LIMIT-256*1024 || [...state.personal].some(([member,own])=>byteLength({sequence:event.sequence,shared:split.shared,personal:member===scope.memberId&&event.personal?split.personal:own})>WIRE_LIMIT-256*1024))throw Error('HOUSEHOLD_STORAGE_LIMIT');
      const reference=await this.designs.prepare(document,bankId),eventHash=await digest(event);
      this.check(scope);
      this.ctx.storage.transactionSync(()=>{
        this.designs.commit(document,reference,event.sequence,{actor:scope.memberId,request:id});
        this.writeProjection('shared',event.shared);if(event.personal)this.writeProjection(scope.memberId,event.personal);
        for(let at=0;at<eventText.length;at+=60000)this.ctx.storage.sql.exec('INSERT INTO journal VALUES (?,?,?)',event.sequence,at/60000,eventText.slice(at,at+60000));
        this.ctx.storage.sql.exec('INSERT INTO receipts VALUES (?,?,?,?,?)',id,receipt.actor,receipt.digest,receipt.sequence,JSON.stringify(receipt));
        this.ctx.storage.sql.exec('INSERT INTO archive VALUES (?,?)',event.sequence,eventHash);this.set('sequence',String(event.sequence));
        this.ctx.storage.sql.exec('INSERT INTO creative_broadcast VALUES (?)',event.sequence);
      });
      this.state={sequence:event.sequence,shared:split.shared,personal:event.personal?new Map(state.personal).set(scope.memberId,split.personal):state.personal};
      await this.ctx.storage.sync();
      this.designs.remember(document,reference);
      // Publish only after both the immutable design and accepted ledger event are recoverable.
      await this.archiveBarrier();this.check(scope);
      await this.schedule();
      return reply(document,creativeReceipt,event.sequence);
    }).catch(error=>{if(error instanceof KittyDesignError)throw Error(error.code);throw error;});
  }
  /** Workspace reads never activate a Plan or import/bootstrap financial state. */
  async workspaceQuery(scope: Scope, query: { name: string; args: Record<string, unknown>; view: 'personal' | 'household' }) {
    return this.serial(async () => {
      this.check(scope);
      await this.archiveBarrier();
      this.check(scope);
      if (!['personal', 'household'].includes(query.view) || !((HERCULES_READ_TOOL_NAMES as readonly string[]).includes(query.name) || isWorkspaceActionQuery(query.name))) throw new Error('INVALID_READ');
      const state = this.load();
      const personal = state.personal.get(scope.memberId);
      if (!state.shared || !personal) throw new Error('LEDGER_NOT_READY');
      const household = assembleHousehold(state.shared, personal, { linked: true });
      if (isWorkspaceActionQuery(query.name)) return { scope: query.view, acceptedSequence: state.sequence, observedAt: new Date().toISOString(),
        ...executeWorkspaceActionQuery(query.name, query.args, { household, memberId: scope.memberId, view: query.view, today: todayKey(new Date(), 'America/Toronto') }) };
      const result = executeHerculesReadToolPlan(household, { calls: [{ id: 'workspace-read', name: query.name, args: query.args }] }, todayKey(new Date(), 'America/Toronto'), { memberId: scope.memberId, view: query.view });
      return { scope: query.view, acceptedSequence: state.sequence, observedAt: new Date().toISOString(), results: result.results };
    });
  }
  /** A fresh shared-story read does not activate plans, bootstrap books, or expose private media. */
  async hearthsideContent(scope:Scope):Promise<HearthsideContentSnapshot>{
    return this.serial(async()=>{
      this.check(scope);await this.archiveBarrier();this.check(scope);const state=this.load();
      const memberIds=state.shared.members.filter(member=>member.active).map(member=>member.id);
      if(!memberIds.includes(scope.memberId)||!state.personal.has(scope.memberId))throw Error('FORBIDDEN');
      return {version:1,environment:scope.environment,householdId:scope.householdId,sequence:state.sequence,memberIds,state:decodeHearthside(state.shared.hearthside)};
    });
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
    /**
     * The world-presence lane (`src/ledgerSync/worldPresenceWire.ts`): a live
     * body walking the island. It sits beside the creative lane on the same
     * `?lane=presence` socket, is bounded to 1 KiB a frame, and obeys the same
     * three rules the other presence lanes do:
     *
     *  - the payload is **re-built here**, never forwarded. A client's own
     *    `memberId` is ignored; identity comes from the authenticated scope.
     *  - every coordinate is validated and clamped by `decodeWorldPresence`
     *    before it is looked at, so an absurd position is rejected rather than
     *    broadcast, and an out-of-range one is pulled back onto the island.
     *  - every peer is `check()`ed again immediately before the send, so a
     *    membership change mid-walk closes the peer instead of leaking a frame.
     *
     * Nothing here reads or writes ledger state beyond the active-member test
     * the other presence lanes already make.
     */
    if(typeof message==='string'&&message.length<=1024&&message.includes('"world-')){
      try{
        const raw=JSON.parse(message);
        if(typeof raw.type==='string'&&raw.type.startsWith('world-')){
          const input=decodeWorldPresence(raw),a=ws.deserializeAttachment() as Attachment;
          if(a.lane!=='presence'||!a.scope)throw Error('FORBIDDEN');
          this.check(a.scope);
          if(!this.load().shared.members.some(member=>member.active&&member.id===a.scope!.memberId))throw Error('FORBIDDEN');
          const at=Date.now(),previous=a.world;
          if(input.type==='world-leave')delete a.world;
          else if(input.type==='world-join'){
            // A re-join is also the lane's heartbeat; throttled so it cannot be a flood.
            if(at-(a.worldJoinAt??0)<WORLD_MIN_GAP_MS)return;
            a.worldJoinAt=at;a.world={target:input.target,seenAt:at};
          } else {
            if(!a.world||at-a.world.seenAt>WORLD_TARGET_MS)throw Error('WORLD_JOIN_REQUIRED');
            if(at-(a.worldStepAt??0)<WORLD_MIN_GAP_MS)return;
            a.worldStepAt=at;a.world.seenAt=at;
          }
          ws.serializeAttachment(a);
          const target=a.world?.target??previous?.target;
          if(!target)return;
          const deviceId=worldPeerKey(a.scope.memberId,target.deviceId);
          const payload=input.type==='world-leave'
            ?{type:'world-left',deviceId}
            :{type:'world-peer',memberId:a.scope.memberId,deviceId,placeId:target.placeId,seenAt:at,
              // Rebuilt field by field from the *decoded* input, never forwarded:
              // the act is one of eight validated words and `p` has been pulled
              // onto 0…1, exactly as the coordinates are clamped onto the island.
              ...(input.type==='world-step'?{x:input.x,z:input.z,yaw:input.yaw,moving:input.moving,
                ...(input.act?{act:input.act,p:input.p??0}:{}),...(input.y!==undefined?{y:input.y}:{}),...(input.avatar?{avatar:input.avatar}:{})}:{})};
          const frame=JSON.stringify(payload);
          for(const peer of this.ctx.getWebSockets()){
            const p=peer.deserializeAttachment() as Attachment;
            // Scoped exactly as the creative lane is: only sockets standing in the same place hear it.
            if(peer===ws||p.lane!=='presence'||!p.scope||!p.world||at-p.world.seenAt>WORLD_TARGET_MS||p.world.target.placeId!==target.placeId)continue;
            try{
              this.check(p.scope);
              peer.send(frame);
              // A joiner is told who is already here, so a body does not wait a whole heartbeat to appear.
              if(input.type==='world-join')ws.send(JSON.stringify({type:'world-peer',memberId:p.scope.memberId,deviceId:worldPeerKey(p.scope.memberId,p.world.target.deviceId),placeId:p.world.target.placeId,seenAt:p.world.seenAt}));
            }catch{peer.close(4003,'ACCESS_CHANGED');}
          }
          return;
        }
      }catch{ws.close(4000,'INVALID_WORLD_PRESENCE');return;}
    }
    if(typeof message==='string'&&message.length<=8192){
      try{
        const value=JSON.parse(message);
        if(typeof value.type==='string'&&value.type.startsWith('creative-')){
          const input=decodeCreativePresence(value),a=ws.deserializeAttachment() as Attachment;
          if(a.lane!=='presence'||!a.scope)throw Error('FORBIDDEN');this.check(a.scope);
          if(!this.load().shared.members.some(member=>member.active&&member.id===a.scope!.memberId))throw Error('FORBIDDEN');
          const previous=a.creative;
          if(input.type==='creative-leave')delete a.creative;
          else if(input.type==='creative-join'){
            const header=this.designs.header(input.target.designId);
            if(!header || header.owner!==null&&header.owner!==a.scope.memberId)throw Error('DESIGN_NOT_FOUND');
            if(Date.now()-(a.creativeJoinAt??0)<40)return;
            a.creativeJoinAt=Date.now();a.creative={target:input.target,seenAt:Date.now()};
          } else {
            if(!a.creative||Date.now()-a.creative.seenAt>12000)throw Error('CREATIVE_JOIN_REQUIRED');
            if(input.stroke!==null&&Date.now()-(a.previewAt??0)<40)return;
            a.previewAt=Date.now();a.creative.seenAt=Date.now();
          }
          ws.serializeAttachment(a);
          const current=a.creative,target=current?.target??previous?.target;
          if(!target)return;
          const deviceId=`${a.scope.memberId}:${target.deviceId}`;
          const payload=input.type==='creative-leave'?{type:'creative-left',deviceId}:{type:'creative-peer',memberId:a.scope.memberId,deviceId,target,seenAt:Date.now(),...(input.type==='creative-preview'?{gestureId:input.gestureId,stroke:input.stroke}:{})};
          for(const peer of this.ctx.getWebSockets()){
            const p=peer.deserializeAttachment() as Attachment;
            if(peer===ws||p.lane!=='presence'||!p.scope||!p.creative||Date.now()-p.creative.seenAt>12000||p.creative.target.designId!==target.designId||p.creative.target.pieceId!==target.pieceId)continue;
            try{this.check(p.scope);peer.send(JSON.stringify(payload));if(input.type==='creative-join')ws.send(JSON.stringify({type:'creative-peer',memberId:p.scope.memberId,deviceId:`${p.scope.memberId}:${p.creative.target.deviceId}`,target:p.creative.target,seenAt:p.creative.seenAt}));}catch{peer.close(4003,'ACCESS_CHANGED');}
          }
          return;
        }
      }catch{ws.close(4000,'INVALID_CREATIVE_PRESENCE');return;}
    }
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
            hearthsideVersion: 1,
            personalLifeVersion: 1,
            kittyDesignVersion: 1, nestDesignVersion:1,
            companionPlayVersion: 1,
            companionDiscoveryVersion: 1,
            companionWardrobeVersion: 1, companionWorkflowVersion: 1, nativeCalendarVersion: 1, planDecisionVersion: 1, goalEnvelopeVersion: 1, taskPlannerVersion: 1, kittyNestVersion: 1, chapterAgreementVersion: 1, pathWorldVersion: 1, pathEraVersion: 1,
            fundModelVersion: 2,
            chapterVersion: 1,
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
        rejectLegacyWinPublication(command.steps);
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
          bankId=>{const document=this.designs.forBank(bankId);return document?{ownerMemberId:document.scope.ownerMemberId,reference:kittyDesignReference(document)}:null;},
          this.sharedLifeRestoreDesignAccess(a.scope),
          ()=>Number(this.meta("acl","1")),
        );
        this.check(a.scope);
        if(command.steps.some(step=>step.kind==='commitHearthside'&&String((step.args[0] as {operation?:{kind?:string}})?.operation?.kind).startsWith('encounter.')))throw Error('HEARTHSIDE_ENCOUNTER_AUTHORITY_REQUIRED');
        // Private media evidence is supplied only by the Vault, after ordinary canonical admission.
        for(const step of command.steps){
          if(step.kind!=='commitHearthside')continue;
          const op=(step.args[0] as {operation?:{kind?:string;id?:string;expectedRevision?:number;value?:MemoryComposition}})?.operation;
          if(op?.kind==='room.capture'||op?.kind==='room.keep'){
            const frame=op.kind==='room.capture'?decodeRecordedRoom(op.value):prepared.shared.hearthside?.roomHistory?.find(row=>row.id===op.id);
            if(!frame)throw Error('HEARTHSIDE_ROOM_HISTORY_MISSING');
            for(const item of frame.items){if(!item.design)continue;const document=this.designs.read(item.design.documentId);
              if(!document||document.scope.ownerMemberId!==null||document.scope.environment!==a.scope.environment||document.scope.householdId!==a.scope.householdId)throw Error('HEARTHSIDE_SHARED_DESIGN_REQUIRED');
              snapshotKittyDesignRevision(document,item.design.pieceId,item.design.revision);
            }
          }
          if(op?.kind==='studio.handoff'){
            const handoff=decodeStudioHandoff(op.value),document=this.designs.read(handoff.design.documentId);
            if(!document||document.scope.ownerMemberId!==null||document.scope.environment!==a.scope.environment||document.scope.householdId!==a.scope.householdId)throw Error('HEARTHSIDE_SHARED_DESIGN_REQUIRED');
            snapshotKittyDesignRevision(document,handoff.design.pieceId,handoff.design.revision);
            if(!handoff.withdrawn&&!projectKittyDesign(document).pieces.some(row=>row.piece.id===handoff.design.pieceId&&row.status!=='archived'))throw Error('HEARTHSIDE_PIECE_UNAVAILABLE');
          }
          if(!op||!['memory.compose','memory.keep','memory.withdraw'].includes(op.kind??''))continue;
          const id=op.kind==='memory.compose'?op.value?.id:op.id;
          const memory=prepared.shared.hearthside?.memories.find(m=>m.id===id);
          if(!memory)throw Error('HEARTHSIDE_MEMORY_MISSING');this.memoryDesigns(a.scope,memory);
          if(op.kind==='memory.withdraw'){
            const previous=state.shared.hearthside?.memories.find(m=>m.id===id);
            if(previous?.publication&&!await this.memoryVault(a.scope).isMemoryRevokedFor(a.scope,previous.publication))throw Error('HEARTHSIDE_REVOKE_ACCESS_FIRST');
          }else if(memory.media.length){
            if(this.env.HEARTHSIDE_VAULT_PUBLICATION!=='true'||a.scope.environment!=='development'||!memory.publication)throw Error('HEARTHSIDE_CONTENT_PUBLICATION_REQUIRED');
            const mode=op.kind==='memory.compose'?'compose':'keep',evidence=await this.memoryVault(a.scope).checkMemoryPublicationFor(a.scope,memory.publication,memory,mode);
            if(canonical(evidence.binding)!==canonical(memory.publication)||canonical([...evidence.mediaIds].sort())!==canonical([...new Set(memory.media.map(m=>m.contentId))].sort())||mode==='keep'&&evidence.approvedMemberId!==a.scope.memberId)throw Error('HEARTHSIDE_MEMORY_REVIEW_REQUIRED');
            if(await memoryCompositionDigest(memory)!==memory.publication.compositionDigest)throw Error('HEARTHSIDE_MEMORY_REVIEW_REQUIRED');
          }
          this.hearthsideMember(a.scope);
          if(this.load().sequence!==state.sequence)throw Error('HEARTHSIDE_CHANGED');
          if(op.kind==='memory.compose')validateMemoryCandidate(assembleHousehold(state.shared,state.personal.get(a.scope.memberId)!,{linked:true}),a.scope.memberId,op.value,op.expectedRevision!);
        }
        const eventText = JSON.stringify(prepared.event),
          eventHash = await digest(prepared.event);
        this.check(a.scope);
        // Workspace proposals use the existing command writer, with their current
        // private review checked at the final server admission point as well.
        if(command.steps.some(step=>step.kind==='executeHerculesAction')){
          const claim=state.personal.get(a.scope.memberId)?.companionProfile?.workflows?.find(r=>r.value?.submission?.id===command.id)?.value;
          if(claim?.workspaceConfirmationId){
            if(claim.workspaceConfirmationId!==command.id || !this.env.HERCULES_WORKSPACES || this.env.HERCULES_WORKSPACE_EXECUTION!=='true')throw new Error('WORKSPACE_ACTION_PAUSED');
            const workspace=this.env.HERCULES_WORKSPACES.get(this.env.HERCULES_WORKSPACES.idFromName(`${a.scope.environment}/${a.scope.householdId}/${a.scope.memberId}`)) as unknown as {authorizeActionFor(scope:Scope,id:string):Promise<unknown>};
            await workspace.authorizeActionFor(a.scope,command.id);
            this.check(a.scope);
          }
        }
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
        designs: this.designs.eventReferences(row.sequence),
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
    // A failed R2 barrier leaves this outbox intact. Receipt recovery must also wake existing peers.
    for(const {sequence} of this.ctx.storage.sql.exec<{sequence:number}>('SELECT sequence FROM creative_broadcast ORDER BY sequence').toArray()){
      const event=this.readEvent(sequence);
      for(const peer of this.ctx.getWebSockets()){
        const attachment=peer.deserializeAttachment() as Attachment;
        if(attachment.ready&&attachment.scope&&attachment.lane!=='presence')try{this.check(attachment.scope);await this.send(peer,{type:'event',event:this.visible(event,attachment.scope.memberId)});}catch{peer.close(4003,'AUTH_EXPIRED');}
      }
      this.ctx.storage.sql.exec('DELETE FROM creative_broadcast WHERE sequence=?',sequence);
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
