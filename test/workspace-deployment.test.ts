import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceContainerConfig } from '../scripts/prepare-workspace-container-deploy.mjs';

const base = JSON.parse(readFileSync(resolve('wrangler.jsonc'), 'utf8'));
const fragment = JSON.parse(readFileSync(resolve('workers/workspace/container-config.json'), 'utf8'));
describe('disabled workspace release and explicit container preparation', () => {
  it('ships no paid container application and keeps execution/disclosure off', () => {
    expect(base.containers).toBeUndefined();
    expect(base.vars).toMatchObject({ HERCULES_WORKSPACE_ENABLED: 'false', HERCULES_WORKSPACE_EXECUTION: 'false', HERCULES_WORKSPACE_DISCLOSURE: 'disabled', HERCULES_WORKSPACE_GOOGLE_WRITES: 'false' });
    expect(base.durable_objects.bindings).toContainEqual({ name: 'LEDGER_ROOMS', class_name: 'LedgerRoom' });
  });
  it('prepares the pinned container without changing identity, money bindings or activation', () => {
    const config = workspaceContainerConfig(base, fragment, '/review');
    expect(config).toMatchObject({ name: base.name, account_id: base.account_id, vars: base.vars, durable_objects: base.durable_objects, r2_buckets: base.r2_buckets, workflows: base.workflows });
    expect(config.containers).toEqual([{ class_name: 'HerculesSandbox', image: '/review/workers/workspace/Dockerfile', max_instances: 3, instance_type: 'lite' }]);
    expect(config.main).toBe('/review/workers/entry.js');
    expect(config.assets.directory).toBe('/review/dist');
    expect(base.containers).toBeUndefined();
    expect(() => workspaceContainerConfig({ ...base, vars: { ...base.vars, HERCULES_WORKSPACE_EXECUTION: 'true' } }, fragment, '/review')).toThrow('disabled');
  });
});
