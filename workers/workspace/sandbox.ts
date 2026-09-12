import { Sandbox, getSandbox } from '@cloudflare/sandbox';
export { ContainerProxy } from '@cloudflare/sandbox';
/** No secrets, ledger bindings or generic outbound proxy are exposed to generated code. */
export class HerculesSandbox extends Sandbox { enableInternet = false; }
export async function executeArtifactCode(binding: Parameters<typeof getSandbox<HerculesSandbox>>[0], id: string, code: string) {
  const sandbox = getSandbox(binding, id);
  try {
    await sandbox.writeFile('/tmp/task.py', code);
    const result = await sandbox.exec('timeout 25s python3 -I /tmp/task.py', { timeout: 30000 });
    return { stdout: result.stdout.slice(0, 24000), stderr: result.stderr.slice(0, 4000), exitCode: result.exitCode,
      truncated: result.stdout.length > 24000 || result.stderr.length > 4000, source: 'isolated-python' };
  } finally { await sandbox.destroy(); }
}
