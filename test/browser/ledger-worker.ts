import { handleLedgerSync } from "../../workers/ledgerSync.ts";
import { LedgerRoom as AuthorityRoom } from "../../workers/ledgerRoom.ts";
import type { DurableObjectState } from "@cloudflare/workers-types/index.ts";
// Fault injection exists only in the local test entrypoint, never workers/site.js.
export class LedgerRoom extends AuthorityRoom {
  constructor(ctx: DurableObjectState, env: any) {
    const bucket = env.LEDGER_ARCHIVE;
    super(ctx, {
      ...env,
      LEDGER_ARCHIVE: new Proxy(bucket, {
        get(target, key) {
          if (key === "put")
            return async (path: string, ...args: any[]) => {
              if (!path.startsWith("development%2FHH-FAULT-"))
                return target.put(path, ...args);
              const prefix = path.split("/")[0],
                fault = await target.get(`fault:${prefix}`),
                stage = fault ? await fault.text() : "";
              if (stage === "checkpoint" && path.endsWith("/checkpoint"))
                throw new Error("TEST_CHECKPOINT_FAILURE");
              if (stage === "tip" && path.endsWith("/tip"))
                throw new Error("TEST_TIP_FAILURE");
              const result = await target.put(path, ...args);
              if (stage === "after-tip" && path.endsWith("/tip"))
                throw new Error("TEST_AFTER_TIP_FAILURE");
              return result;
            };
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
    });
  }
}
export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url),
      test = url.pathname.match(
        /^\/test\/(fault|fence|archive)\/(HH-FAULT-[a-zA-Z0-9-]+)$/,
      );
    if (test) {
      const scope = `development/${test[2]}`,
        prefix = encodeURIComponent(scope);
      if (test[1] === "fault") {
        await env.LEDGER_ARCHIVE.put(`fault:${prefix}`, await request.text());
        return Response.json({ ok: true });
      }
      if (test[1] === "fence") {
        await env.LEDGER_ROOMS.get(
          env.LEDGER_ROOMS.idFromName(scope),
        ).beginDelete({
          environment: "development",
          householdId: test[2],
          memberId: "MEM-001",
          subject: "local:MEM-001",
          role: "owner",
          expires: Date.now() + 60000,
          aclEpoch: Date.now(),
        });
        return Response.json({ ok: true });
      }
      const checkpoint = await env.LEDGER_ARCHIVE.get(`${prefix}/checkpoint`),
        tip = await env.LEDGER_ARCHIVE.get(`${prefix}/tip`);
      return Response.json({
        checkpoint: checkpoint ? await checkpoint.json() : null,
        tip: tip ? await tip.json() : null,
      });
    }
    if (
      url.searchParams.get("recovery") === "1" &&
      url.pathname.includes("/HH-FAULT-")
    ) {
      const namespace = env.LEDGER_ROOMS;
      env = {
        ...env,
        LEDGER_ROOMS: {
          idFromName: (name: string) =>
            namespace.idFromName(`${name}:recovery`),
          get: (...args: any[]) => namespace.get(...args),
        },
      };
    }
    return (
      (await handleLedgerSync(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
};
