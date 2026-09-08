import { LedgerSyncClient } from '../../src/ledgerSync/client.ts';
import { LedgerStore } from '../../src/ledgerSync/localStore.ts';
import { saveBoardTask, removeBoardTask, saveBoardMilestone, removeBoardMilestone, type Household } from '../../src/core/index.ts';
import type { ClientOptions } from '../../src/ledgerSync/client.ts';

// Only bundled by the loopback test server. No production entrypoint imports this.
const target = window as any;
let client: LedgerSyncClient;
let household: Household;
let scope: ClientOptions['scope'];
let generation = 0;
const commands = { saveBoardTask, removeBoardTask, saveBoardMilestone, removeBoardMilestone };
target.boardProof = {
  async start(nextScope: ClientOptions['scope']) {
    if (client) await client.destroy();
    const current = ++generation;
    scope = nextScope;
    target.status = 'starting';
    target.replica = undefined;
    target.rejected = [];
    client = new LedgerSyncClient({
      scope,
      token: async () => `local:${scope.memberId}`,
      adopt: async next => { if (current === generation) { household = next; target.replica = next; } },
      rejectedChanged: entries => { if (current === generation) target.rejected = entries; },
      status: status => { if (current === generation) target.status = status; },
    });
    void client.start().catch(error => { target.startError = String(error); });
  },
  async submit(kind: keyof typeof commands, input: any, wait = false) {
    const id = crypto.randomUUID();
    const candidate = (commands[kind] as Function)(household, { memberId: scope.memberId, ...input }).household;
    const completion = client.confirm(candidate, id);
    void completion.catch(() => {});
    if (wait) { await completion; return id; }
    const store = await LedgerStore.open(scope);
    try {
      for (let n = 0; n < 200; n++) {
        if ((await store.load()).pending.some(command => command.id === id)) return id;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error('Board command was not durably queued');
    } finally { store.close(); }
  },
  async stored(otherScope = scope) {
    const store = await LedgerStore.open(otherScope);
    try { return { ...await store.load(), rejected: await store.rejected() }; }
    finally { store.close(); }
  },
  async retire() { await client.destroy(); ++generation; },
  retry() { client.retryPending(); },
};
