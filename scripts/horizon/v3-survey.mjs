// Usage: node scripts/horizon/v3-survey.mjs "x,z;x,z;..." [radius]   |   node scripts/horizon/v3-survey.mjs --landforms
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { unlink } from 'node:fs/promises';
const root = process.cwd(), output = resolve(tmpdir(), `v3-survey-${process.pid}.mjs`);
try {
  await build({ entryPoints: [resolve(root, 'scripts/horizon/v3-survey-entry.ts')], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'warning' });
  const mod = await import(pathToFileURL(output).href);
  if (process.argv.includes('--landforms')) { console.log(JSON.stringify(mod.landforms, null, 1)); }
  else if (process.argv.includes('--grid')) { const [x0, x1, z0, z1, step] = process.argv[process.argv.indexOf('--grid') + 1].split(',').map(Number); const { writeFileSync } = await import('node:fs'); writeFileSync(process.argv[process.argv.indexOf('--grid') + 2], JSON.stringify(mod.grid(x0, x1, z0, z1, step))); }
  else {
    const pts = process.argv[2].split(';').map(s => s.split(',').map(Number));
    for (const r of mod.survey(pts, Number(process.argv[3] ?? 25))) console.log(JSON.stringify(r));
  }
} finally { await unlink(output).catch(() => {}); }
