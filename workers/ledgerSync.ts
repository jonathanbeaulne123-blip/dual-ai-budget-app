import type { DurableObjectNamespace } from "@cloudflare/workers-types/index.ts";
import { authorizeRequest, supabase, type AuthEnv } from "./ledgerSyncAuth.ts";
import type { LedgerRoom } from "./ledgerRoom.ts";
export { LedgerRoom } from "./ledgerRoom.ts";
type Env = AuthEnv & {
  LEDGER_ROOMS: DurableObjectNamespace<LedgerRoom>;
  LEDGER_SYNC_ENABLED?: string;
};
export async function handleLedgerSync(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/ledger-sync/")) return null;
  const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  if (!env.LEDGER_ROOMS || env.LEDGER_SYNC_ENABLED === "false")
    return json({ error: "LEDGER_SYNC_UNAVAILABLE" }, 503);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin)
    return json({ error: "ORIGIN_DENIED" }, 403);
  if (url.pathname === "/ledger-sync/config")
    return json({ version: 2, enabled: true });
  const path = url.pathname.match(
    /^\/ledger-sync\/v2\/(development|production)\/(HH-[a-zA-Z0-9_-]{1,96})\/(ticket|socket|snapshot|import|revoke|restore|create|delete|points|receipt)$/,
  );
  if (!path) return json({ error: "NOT_FOUND" }, 404);
  const environment = path[1]!,
    householdId = path[2]!,
    action = path[3]!;
  if (environment === "production")
    return json({ error: "PRODUCTION_DISABLED" }, 403);
  const room = env.LEDGER_ROOMS.get(
    env.LEDGER_ROOMS.idFromName(`${environment}/${householdId}`),
    { locationHint: "enam" },
  );
  try {
    if (action === "socket")
      return (await room.fetch(
        request as unknown as import("@cloudflare/workers-types/index.ts").Request,
      )) as unknown as Response;
    if (action === "delete" && request.method === "POST") {
      const token = request.headers
        .get("Authorization")
        ?.match(/^Bearer (\S+)$/)?.[1];
      if (!token) throw new Error("UNAUTHENTICATED");
      let subject: string | undefined;
      try {
        const authorized = await authorizeRequest(
          request,
          env,
          environment,
          householdId,
        );
        const owner = await room.deletionOwner();
        if (owner && owner !== authorized.scope.subject)
          throw new Error("DELETION_IN_PROGRESS");
        if (!owner) await room.ensureImported(authorized.scope, token);
        await room.beginDelete(authorized.scope);
        subject = authorized.scope.subject;
      } catch (error) {
        if (
          !["FORBIDDEN", "UNAUTHENTICATED"].includes(
            error instanceof Error ? error.message : "",
          )
        )
          throw error;
      }
      const local =
        env.LEDGER_SYNC_LOCAL_AUTH === "true" &&
        ["localhost", "127.0.0.1"].includes(url.hostname) &&
        token.startsWith("local:");
      const result = local
        ? { subject: subject ?? token }
        : await supabase(env, "/rest/v1/rpc/delete_ledger_sync_v2", token, {
            p_household_id: householdId,
          });
      return json(
        await room.finishDelete(
          result.subject,
          `${environment}/${householdId}`,
        ),
      );
    }
    if (action === "create" && request.method === "POST") {
      const token = request.headers
        .get("Authorization")
        ?.match(/^Bearer (\S+)$/)?.[1];
      if (!token) throw new Error("UNAUTHENTICATED");
      const reader = request.body?.getReader();
      if (!reader) throw new Error("INVALID_CREATE");
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 32 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("IMPORT_TOO_LARGE");
        }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const { household, memberId } = JSON.parse(
        new TextDecoder().decode(bytes),
      );
      if (
        household?.householdId !== householdId ||
        household?.environment !== environment
      )
        throw new Error("SCOPE_MISMATCH");
      const local =
        env.LEDGER_SYNC_LOCAL_AUTH === "true" &&
        ["localhost", "127.0.0.1"].includes(url.hostname);
      if (!local) await room.registerCreation(token, household, memberId);
      const { scope } = await authorizeRequest(
        request,
        env,
        environment,
        householdId,
      );
      if (scope.memberId !== memberId) throw new Error("SCOPE_MISMATCH");
      await room.ensureImported(scope, token, local ? household : undefined);
      return json(await room.snapshot(scope));
    }
    const { scope, token, roster } = await authorizeRequest(
      request,
      env,
      environment,
      householdId,
    );
    if (action === "receipt" && request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id || id.length > 256) return json({ error: "INVALID_RECEIPT_ID" }, 400);
      return json(await room.resolveReceipt(scope, id));
    }
    if (action === "points" && request.method === "GET")
      return json(await room.listRestorePoints(scope));
    if (action === "ticket" && request.method === "POST") {
      await room.ensureImported(scope, token);
      if (roster) await room.reconcileMembers(scope, roster);
      return json({ ticket: await room.ticket(scope), scope });
    }
    if (action === "snapshot" && request.method === "GET") {
      await room.ensureImported(scope, token);
      if (roster) await room.reconcileMembers(scope, roster);
      return json(await room.snapshot(scope));
    }
    if (action === "import" && request.method === "POST") {
      const local =
        env.LEDGER_SYNC_LOCAL_AUTH === "true" &&
        environment === "development" &&
        ["localhost", "127.0.0.1"].includes(url.hostname);
      if (!local) return json({ error: "LOCAL_IMPORT_ONLY" }, 403);
      if (Number(request.headers.get("Content-Length") ?? 0) > 32 * 1024 * 1024)
        return json({ error: "IMPORT_TOO_LARGE" }, 413);
      await room.ensureImported(scope, token, await request.json());
      return json({ imported: true });
    }
    if (action === "restore" && request.method === "POST") {
      if (scope.role !== "owner") throw new Error("FORBIDDEN");
      return json(await room.restore(scope));
    }
    if (action === "revoke" && request.method === "POST") {
      if (scope.role !== "owner") throw new Error("FORBIDDEN");
      // Local epoch invalidation requires every survivor to obtain a fresh scope.
      await room.revoke(Date.now());
      return json({ revoked: true });
    }
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "REQUEST_FAILED";
    const code = /^[A-Z_]+$/.test(raw) ? raw : "REQUEST_FAILED";
    return json(
      { error: code },
      code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : 409,
    );
  }
}
