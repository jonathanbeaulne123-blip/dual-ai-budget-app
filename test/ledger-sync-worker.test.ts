import { digest } from "../src/ledgerSync/patch.ts";
import { it, expect } from "vitest";
import { catalogHousehold, postEntry } from "../src/core/index.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture } from "../src/ledgerSync/protocol.ts";
import { encodeMessage, MessageReader } from "../src/ledgerSync/wire.ts";
const base = process.env.HEARTH_LEDGER_WORKER_URL;
it.skipIf(!base)('imported receipt UUID remains reserved after a v2 posting and reconnect', async () => {
  const id = crypto.randomUUID();
  const legacy = { confirmationId:id, identityHash:'original-legacy-hash',auditHash:'original-audit',commandKind:'postEntry',postedIds:['TXN-OLD-PRIVATE-ID'],revision:1,acceptedAt:'2026-09-01T12:00:00Z' };
  const h = {...catalogHousehold(),householdId:`HH-RECEIPT-${crypto.randomUUID()}`,commandReceipts:[legacy],revision:1,baseRevision:1};
  const headers = {Authorization:'Bearer local:MEM-001','Content-Type':'application/json'};
  const imported = await fetch(`${base}/ledger-sync/v2/development/${h.householdId}/import`,{method:'POST',headers,body:JSON.stringify(h)});
  expect(imported.status).toBe(200);
  const c = await connection(h.householdId,'MEM-001');
  try {
    const command = await commandFromCapture(capturedIntent(postEntry(h,{date:'2026-09-07',type:'expense',amount:'2.00',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true}).household)!,c.scope,crypto.randomUUID());
    await c.send({type:'command',command});
    expect((await c.next('ack')).receipt.sequence).toBe(2);
    await c.send({type:'command',command:{...command,id}});
    const refusal = await c.next('error');
    expect(refusal).toMatchObject({code:'IMPORTED_CONFIRMATION_EXISTS',definitive:true});
    const resolution = await fetch(`${base}/ledger-sync/v2/development/${h.householdId}/receipt?id=${id}`,{headers});
    expect(await resolution.json()).toEqual({version:1,confirmationId:id,revision:1,acceptedAt:legacy.acceptedAt,reserved:true});
  } finally { c.ws.close(); }
  const again = await connection(h.householdId,'MEM-001');
  try {
    expect(again.initial.replica.sequence).toBe(2);
    expect(again.initial.replica.shared.commandReceipts).toEqual([]);
    expect(JSON.stringify(again.initial)).not.toContain("TXN-OLD-PRIVATE-ID");
  } finally { again.ws.close(); }
});
async function connection(
  householdId: string,
  memberId: string,
  recovery = false,
) {
  const query = recovery ? "?recovery=1" : "";
  const scope = { environment: "development" as const, householdId };
  const headers = { Authorization: `Bearer local:${memberId}` };
  const response = await fetch(
    `${base}/ledger-sync/v2/development/${householdId}/ticket${query}`,
    { method: "POST", headers },
  );
  expect(response.status).toBe(200);
  const { ticket } = (await response.json()) as { ticket: string };
  const ws = new WebSocket(
    `${base!.replace("http", "ws")}/ledger-sync/v2/development/${householdId}/socket${query}`,
  );
  ws.binaryType = "arraybuffer";
  const reader = new MessageReader();
  let tail = Promise.resolve();
  const messages: any[] = [];
  const failures: unknown[] = [];
  ws.addEventListener("message", (event) => {
    tail = tail
      .then(async () => {
        if (typeof event.data === "string") {
          messages.push(JSON.parse(event.data));
          return;
        }
        const data = event.data as ArrayBuffer;
        const message = await reader.accept(data);
        ws.send(JSON.stringify({ type: "credit", bytes: data.byteLength }));
        if (message) messages.push(message);
      })
      .catch((e) => {
        failures.push(e);
      });
  });
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.send(JSON.stringify({ type: "auth", ticket }));
  const next = async (type: string) => {
    for (let i = 0; i < 500; i++) {
      if (failures.length) throw failures[0];
      const index = messages.findIndex((m) => m.type === type);
      if (index >= 0) return messages.splice(index, 1)[0];
      const error = messages.find((m) => m.type === "error");
      if (error) throw new Error(JSON.stringify(error));
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`No ${type}: ${JSON.stringify(messages)}`);
  };
  const send = async (value: unknown) => {
    for (const frame of await encodeMessage(value)) ws.send(frame);
  };
  await next("authenticated");
  await send({ type: "resume", sequence: 0 });
  const initial = await next("snapshot");
  await next("ready");
  return { scope, ws, next, send, messages, initial, headers };
}
it.skipIf(!base)(
  "real SQLite Worker: concurrent confirms, personal isolation, lost ACK replay and membership invalidation",
  async () => {
    const h = {
      ...catalogHousehold(),
      householdId: `HH-PROOF-${crypto.randomUUID()}`,
      revision: 0,
      baseRevision: 0,
    };
    for (const actor of ["MEM-001", "MEM-002"]) {
      const r = await fetch(
        `${base}/ledger-sync/v2/development/${h.householdId}/import`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer local:${actor}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(h),
        },
      );
      expect(r.status, await r.text()).toBe(200);
    }
    const a = await connection(h.householdId, "MEM-001"),
      b = await connection(h.householdId, "MEM-002");
    const input = (
      note: string,
      createdBy: string,
      visibility: "household" | "personal" = "household",
    ) => ({
      date: "2026-09-07",
      type: "expense" as const,
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note,
      createdBy,
      visibility,
      confirmDuplicate: true,
    });
    try {
      const ca = await commandFromCapture(
        capturedIntent(postEntry(h, input("milk", "MEM-001")).household)!,
        a.scope,
        crypto.randomUUID(),
      );
      const cb = await commandFromCapture(
        capturedIntent(postEntry(h, input("bread", "MEM-002")).household)!,
        b.scope,
        crypto.randomUUID(),
      );
      await Promise.all([
        a.send({ type: "command", command: ca }),
        b.send({ type: "command", command: cb }),
      ]);
      const aa = await a.next("ack"),
        bb = await b.next("ack");
      expect([aa.receipt.sequence, bb.receipt.sequence].sort()).toEqual([1, 2]);
      for (let i = 0; i < 2; i++) {
        const event = await b.next("event");
        if (event.event.memberId !== "MEM-002")
          expect(event.event.personal).toBeUndefined();
      }
      a.ws.close();
      const reconnected = await connection(h.householdId, "MEM-001");
      try {
        expect(reconnected.initial.replica.sequence).toBe(2);
        await reconnected.send({
          type: "command",
          command: { ...ca, observedSequence: 2 },
        });
        const replay = await reconnected.next("ack");
        expect(replay.receipt).toEqual(aa.receipt);
        const replica = reconnected.initial.replica;
        expect(
          replica.shared.transactions.filter((t: any) =>
            ["milk", "bread"].includes(t.note),
          ),
        ).toHaveLength(2);
        const merged = { ...h, ...replica.shared };
        const personal = postEntry(
          merged,
          input("private secret", "MEM-001", "personal"),
        );
        const cp = await commandFromCapture(
          capturedIntent(personal.household)!,
          a.scope,
          crypto.randomUUID(),
        );
        await reconnected.send({ type: "command", command: cp });
        await reconnected.next("ack");
        const remote = await b.next("event");
        expect(JSON.stringify(remote)).not.toContain("private secret");
        expect(remote.event.sequence).toBe(3);
        const snapshot = await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/snapshot`,
          { headers: b.headers },
        );
        const view = (await snapshot.json()) as any;
        expect(view.sequence).toBe(3);
        expect(JSON.stringify(view)).not.toContain("private secret");
        expect(view.personal.memberId).toBe("MEM-002");
        const closed = new Promise<void>((resolve) =>
          b.ws.addEventListener("close", () => resolve(), { once: true }),
        );
        const revoke = await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/revoke`,
          { method: "POST", headers: a.headers },
        );
        expect(revoke.status).toBe(200);
        await closed;
      } finally {
        reconnected.ws.close();
      }
    } finally {
      a.ws.close();
      b.ws.close();
    }
  },
  30000,
);

it.skipIf(!base)(
  "archive failures block exposure; import retries archive their baseline; empty authority retains an unacknowledged durable receipt",
  async () => {
    const legacyId = crypto.randomUUID();
    const h = {
      ...catalogHousehold(),
      householdId: `HH-FAULT-${crypto.randomUUID()}`,
      commandReceipts: [{confirmationId:legacyId,identityHash:'legacy',auditHash:'legacy',commandKind:'postEntry',postedIds:['PRIVATE-LEGACY-ID'],revision:0,acceptedAt:'2026-09-01T00:00:00Z'}],
      revision: 0,
      baseRevision: 0,
    };
    const headers = {
      Authorization: "Bearer local:MEM-001",
      "Content-Type": "application/json",
    };
    const fault = async (stage: string) => {
      expect(
        (
          await fetch(`${base}/test/fault/${h.householdId}`, {
            method: "POST",
            body: stage,
          })
        ).status,
      ).toBe(200);
    };
    await fault("checkpoint");
    const imported = await fetch(
      `${base}/ledger-sync/v2/development/${h.householdId}/import`,
      { method: "POST", headers, body: JSON.stringify(h) },
    );
    expect(imported.status).toBe(409);
    expect(
      (
        await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/snapshot`,
          { headers },
        )
      ).status,
    ).toBe(409);
    await fault("");
    const a = await connection(h.householdId, "MEM-001");
    const archive = (await (
      await fetch(`${base}/test/archive/${h.householdId}`)
    ).json()) as any;
    expect(archive.checkpoint.data.sequence).toBe(0);
    const preview = postEntry(h, {
      date: "2026-09-07",
      type: "expense",
      amount: "4",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "durability fault",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const command = await commandFromCapture(
      capturedIntent(preview.household)!,
      a.scope,
      crypto.randomUUID(),
    );
    await fault("tip");
    let closed = new Promise<void>((resolve) =>
      a.ws.addEventListener("close", () => resolve(), { once: true }),
    );
    await a.send({ type: "command", command });
    await closed;
    expect(
      a.messages.some((message) => ["event", "ack"].includes(message.type)),
    ).toBe(false);
    expect(
      (
        await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/snapshot`,
          { headers },
        )
      ).status,
    ).toBe(409);
    expect((await fetch(`${base}/ledger-sync/v2/development/${h.householdId}/receipt?id=${command.id}`, { headers })).status).toBe(409);
    const incomplete = (await (
      await fetch(`${base}/test/archive/${h.householdId}`)
    ).json()) as any;
    expect(incomplete.tip).toBeNull();
    // Upload succeeds, but the storage adapter fails before any broadcast/ACK.
    await fault("after-tip");
    expect(
      (
        await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/snapshot`,
          { headers },
        )
      ).status,
    ).toBe(409);
    const durable = (await (
      await fetch(`${base}/test/archive/${h.householdId}`)
    ).json()) as any;
    expect(durable.tip.sequence).toBe(1);
    await fault("");
    expect(
      (await fetch(`${base}/test/fence/${h.householdId}`, { method: "POST" }))
        .status,
    ).toBe(200);
    const restored = await fetch(
      `${base}/ledger-sync/v2/development/${h.householdId}/restore?recovery=1`,
      { method: "POST", headers },
    );
    expect(restored.status, await restored.text()).toBe(200);
    const recovered = await connection(h.householdId, "MEM-001", true);
    try {
      expect(recovered.initial.replica.sequence).toBe(1);
      await recovered.send({ type: "command", command });
      const ack = await recovered.next("ack");
      expect(ack.receipt.id).toBe(command.id);
      expect(ack.receipt.sequence).toBe(1);
      await recovered.send({type:'command',command:{...command,id:legacyId.toUpperCase()}});
      expect(await recovered.next('error')).toMatchObject({code:'IMPORTED_CONFIRMATION_EXISTS',definitive:true});
      const legacyResolution = await fetch(`${base}/ledger-sync/v2/development/${h.householdId}/receipt?recovery=1&id=${legacyId.toUpperCase()}`, {headers});
      expect(await legacyResolution.json()).toEqual({version:1,confirmationId:legacyId.toUpperCase(),reserved:true});
      expect(JSON.stringify(recovered.initial)).not.toContain('PRIVATE-LEGACY-ID');
      expect(
        recovered.initial.replica.shared.transactions.filter(
          (row: any) => row.note === "durability fault",
        ),
      ).toHaveLength(1);
      const imported = await fetch(
        `${base}/ledger-sync/v2/development/${h.householdId}/import?recovery=1`,
        {
          method: "POST",
          headers: { ...headers, Authorization: "Bearer local:MEM-002" },
          body: JSON.stringify(h),
        },
      );
      expect(imported.status, await imported.text()).toBe(200);
      const points = (await (
        await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/points?recovery=1`,
          { headers },
        )
      ).json()) as any[];
      expect(points.map((point) => point.sourceRevision)).toEqual([0, 1]);
      expect(new Set(points.map((point) => point.id)).size).toBe(2);
      const restore = {
        version: 2,
        id: crypto.randomUUID(),
        ...recovered.scope,
        observedSequence: 1,
        steps: [
          {
            kind: "restoreSharedPoint",
            args: [points[0].id, "MEM-001"],
            previewIds: [],
            reviewed: [],
            resources: [
              { key: "lifecycle-sequence", hash: await digest(1) },
              { key: "restore-point", hash: await digest(null) },
            ],
          },
        ],
      };
      await recovered.send({ type: "command", command: restore });
      expect((await recovered.next("ack")).receipt.sequence).toBe(2);
    } finally {
      recovered.ws.close();
    }
  },
  30000,
);

it.skipIf(!base)(
  "an owner can restore an archived Shared checkpoint as a new receipt without erasing Personal money",
  async () => {
    const h = {
      ...postEntry(catalogHousehold(), {
        date: "2026-09-07",
        type: "expense",
        amount: "2",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        createdBy: "MEM-001",
        visibility: "personal",
        note: "private preserved",
        confirmDuplicate: true,
      }).household,
      householdId: `HH-RESTORE-${crypto.randomUUID()}`,
      revision: 0,
      baseRevision: 0,
    };
    const headers = {
      Authorization: "Bearer local:MEM-001",
      "Content-Type": "application/json",
    };
    expect(
      (
        await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/create`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ household: h, memberId: "MEM-001" }),
          },
        )
      ).status,
    ).toBe(200);
    const client = await connection(h.householdId, "MEM-001");
    try {
      const posted = postEntry(h, {
        date: "2026-09-07",
        type: "expense",
        amount: "4",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        createdBy: "MEM-001",
        confirmDuplicate: true,
      });
      const command = await commandFromCapture(
        capturedIntent(posted.household)!,
        client.scope,
        crypto.randomUUID(),
      );
      await client.send({ type: "command", command });
      await client.next("ack");
      const points = (await (
        await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/points`,
          { headers },
        )
      ).json()) as any[];
      expect(points).toHaveLength(1);
      expect(points[0].shared).toBeUndefined();
      const restore = {
        version: 2,
        id: crypto.randomUUID(),
        ...client.scope,
        observedSequence: 1,
        steps: [
          {
            kind: "restoreSharedPoint",
            args: [points[0].id, "MEM-001"],
            previewIds: [],
            reviewed: [],
            resources: [
              { key: "lifecycle-sequence", hash: await digest(1) },
              { key: "restore-point", hash: await digest(null) },
            ],
          },
        ],
      };
      await client.send({ type: "command", command: restore });
      expect((await client.next("ack")).receipt.sequence).toBe(2);
      const snapshot = (await (
        await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/snapshot`,
          { headers },
        )
      ).json()) as any;
      expect(snapshot.shared.transactions).toHaveLength(0);
      expect(snapshot.personal.memberId).toBe("MEM-001");
      expect(snapshot.personal.transactions[0].note).toBe("private preserved");
    } finally {
      client.ws.close();
    }
  },
  30000,
);

it.skipIf(!base)(
  "new ledger bootstrap and deletion are scoped and permanently fence old clients",
  async () => {
    const h = {
      ...catalogHousehold(),
      householdId: `HH-CREATE-${crypto.randomUUID()}`,
      revision: 0,
      baseRevision: 0,
    };
    const headers = {
      Authorization: "Bearer local:MEM-001",
      "Content-Type": "application/json",
    };
    const created = await fetch(
      `${base}/ledger-sync/v2/development/${h.householdId}/create`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ household: h, memberId: "MEM-001" }),
      },
    );
    expect(created.status, await created.text()).toBe(200);
    const live = await connection(h.householdId, "MEM-001");
    const closed = new Promise<void>((resolve) =>
      live.ws.addEventListener("close", () => resolve(), { once: true }),
    );
    const removed = await fetch(
      `${base}/ledger-sync/v2/development/${h.householdId}/delete`,
      { method: "POST", headers },
    );
    expect(removed.status, await removed.text()).toBe(200);
    await closed;
    expect(
      (
        await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/snapshot`,
          { headers },
        )
      ).status,
    ).toBe(409);
    const retry = await fetch(
      `${base}/ledger-sync/v2/development/${h.householdId}/delete`,
      { method: "POST", headers },
    );
    expect(retry.status, await retry.text()).toBe(200);
    expect(
      (
        await fetch(
          `${base}/ledger-sync/v2/development/${h.householdId}/create`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ household: h, memberId: "MEM-001" }),
          },
        )
      ).status,
    ).toBe(409);
  },
  30000,
);

it.skipIf(!base)('full importer parity uses actual SQLite and member-scoped archive for both synthetic members',async()=>{
  const {seedDemoHousehold}=await import('../src/core/index.ts');
  const h=seedDemoHousehold({today:'2026-08-21'});h.householdId=`HH-PARITY-${crypto.randomUUID()}`;
  for(const member of ['MEM-001','MEM-002']){
    const headers={Authorization:`Bearer local:${member}`,'Content-Type':'application/json'};
    const imported=await fetch(`${base}/ledger-sync/v2/development/${h.householdId}/import`,{method:'POST',headers,body:JSON.stringify(h)});
    expect(imported.status).toBe(200);
    const response=await fetch(`${base}/ledger-sync/v2/development/${h.householdId}/parity`,{method:'POST',headers,body:JSON.stringify(h)});
    const report=await response.json() as any;
    expect(response.status,JSON.stringify(report)).toBe(200);expect(report.differences).toEqual([]);expect(report.pass).toBe(true);
    expect(report.financial).toHaveLength(8);expect(report.memberId).toBe(member);
    const other=h.transactions.find(row=>row.visibility==='personal'&&row.createdBy!==member)!;
    const snapshot=await fetch(`${base}/ledger-sync/v2/development/${h.householdId}/snapshot`,{headers});expect(snapshot.status).toBe(200);expect(JSON.stringify(await snapshot.json())).not.toContain(other.id);
    if(member==='MEM-001'){
      // The second member imports after Shared has advanced; parity must use
      // the archived import baseline rather than today's edited projection.
      const live=await connection(h.householdId,member);
      try {
        const intent=capturedIntent(postEntry(h,{date:'2026-09-07',type:'expense',amount:'2.00',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:member,confirmDuplicate:true}).household)!;
        const command=await commandFromCapture(intent,live.scope,crypto.randomUUID());
        await live.send({type:'command',command});
        expect((await live.next('ack')).receipt.sequence).toBeGreaterThan(h.revision??0);
      } finally { live.ws.close(); }
    }
  }
},30000);
