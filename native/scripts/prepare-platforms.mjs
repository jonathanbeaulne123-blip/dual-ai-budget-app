import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (...args) => {
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules/@capacitor/cli/bin/capacitor'), ...args], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
for (const platform of ['ios', 'android']) {
  try { await access(resolve(root, platform)); } catch { run('add', platform); }
}
try {
  const html = await readFile(resolve(root, '../dist/index.html'), 'utf8');
  if (!html.includes('<html') || !html.includes('<script')) throw new Error('No built React entry');
} catch {
  throw new Error('Build the shared Hearth React app in the repository root before syncing native companions. No placeholder application will be copied.');
}
run('sync');
