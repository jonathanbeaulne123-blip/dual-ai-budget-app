import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Build an explicit container deployment profile without deploying or activating it. */
export function workspaceContainerConfig(base, fragment, root) {
  if (base.name !== 'hearth-books' || base.vars?.HERCULES_WORKSPACE_DATA !== 'synthetic' || base.vars?.HERCULES_WORKSPACE_GOOGLE_WRITES !== 'false') {
    throw new Error('Prepare this profile from the synthetic Development configuration with Google writes off.');
  }
  if (fragment.containers?.length !== 1 || fragment.containers[0].class_name !== 'HerculesSandbox') {
    throw new Error('Expected only the reviewed Hercules Sandbox container.');
  }
  const config = structuredClone({ ...base, containers: fragment.containers });
  config.$schema = resolve(root, config.$schema);
  config.main = resolve(root, config.main);
  config.assets.directory = resolve(root, config.assets.directory);
  config.containers = config.containers.map(container => ({ ...container, image: resolve(root, container.image) }));
  config.d1_databases = config.d1_databases.map(database => ({ ...database, migrations_dir: resolve(root, database.migrations_dir) }));
  return config;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const base = JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'));
  const fragment = JSON.parse(await readFile(resolve(root, 'workers/workspace/container-config.json'), 'utf8'));
  const output = resolve(root, '.wrangler/workspace-deploy.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(workspaceContainerConfig(base, fragment, root), null, 2) + '\n');
  console.log(`Prepared ${output}. Nothing deployed or activated. Containers require a separately authorized Workers Paid plan and release.`);
}
