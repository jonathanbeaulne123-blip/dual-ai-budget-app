/**
 * The money fence for the movers (RIDE §10.4, 02-movers "Must not", review R2-06): nothing that moves a
 * rider on the Horizon reads the books. A static scan of every source file under
 * `src/harbour/horizon/movers/**` and of `src/harbour/horizon/runtime/{index,moverInput}.ts`:
 *   1. no import (static, re-export or dynamic) that resolves into `src/core/**`, `src/ledgerSync/**`,
 *      `workers/**`, a `data/` folder two levels up (`../../data/`), or `house/books`;
 *   2. no identifier matching /balance|ledger|amount|cents|fund/i outside comments (string literals are
 *      scanned too, since a property name can hide in one); legitimate exceptions are listed below by file;
 *   3. under `movers/**` only (the kernel's determinism, RIDE §2): no `Math.random`, `performance.now` or `Date.now`.
 * Direct imports only: the fence is on what these files reach for, not on the renderer they share with the House.
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {describe, expect, it} from 'vitest';

const ROOT = resolve(__dirname, '..');
const MOVERS = join(ROOT, 'src/harbour/horizon/movers');
const RUNTIME = ['src/harbour/horizon/runtime/index.ts', 'src/harbour/horizon/runtime/moverInput.ts'].map(p => join(ROOT, p));

function walk(dir:string):string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}
const moverFiles = walk(MOVERS);
const files = [...moverFiles, ...RUNTIME];
const rel = (path:string) => relative(ROOT, path).split(sep).join('/');

/** Blanks out comments; keeps string and template contents (and their quotes) so identifiers inside them are still scanned. */
function stripComments(source:string):string {
  let out = '', i = 0;
  while (i < source.length) {
    const c = source[i]!, n = source[i + 1];
    if (c === '/' && n === '/') { while (i < source.length && source[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2; out += ' '; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== c) { if (source[j] === '\\') j++; j++; }
      out += source.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

const IMPORT = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
function importsOf(path:string):string[] {
  const code = stripComments(readFileSync(path, 'utf8')), out:string[] = [];
  for (const m of code.matchAll(IMPORT)) out.push((m[1] ?? m[2] ?? m[3])!);
  return out;
}
const FORBIDDEN_DIRS = ['src/core/', 'src/ledgerSync/', 'workers/'];
function forbiddenImport(from:string, spec:string):string|null {
  if (spec.includes('../../data/')) return `${spec} (../../data/)`;
  if (/(^|\/)house\/books(\/|\.|$)/.test(spec)) return `${spec} (house/books)`;
  if (!spec.startsWith('.')) return /^(src\/)?(core|ledgerSync)\b|^workers\b/.test(spec) ? spec : null;
  const target = rel(resolve(dirname(from), spec)) + '/';
  const hit = FORBIDDEN_DIRS.find(dir => target.startsWith(dir)) ?? (target.includes('/house/books') ? 'house/books' : null);
  return hit ? `${spec} → ${target} (${hit})` : null;
}

const MONEY = /balance|ledger|amount|cents|fund/i;
/**
 * Legitimate matches, by file: each is a word that is not money.
 * - runtime/index.ts `amount`: the district-card fade's opacity (0..1) in `fade(materials, amount)` and the coarse cards' cross-fade.
 * - board/art/proxy.ts `cameraMount`: the proxy's camera anchor ("camer·aMount" trips /amount/i).
 */
const ALLOWED:Record<string, readonly string[]> = {
  'src/harbour/horizon/movers/board/art/proxy.ts': ['cameraMount'],
  'src/harbour/horizon/runtime/index.ts': ['amount'],
};
function moneyIdentifiers(path:string):string[] {
  const code = stripComments(readFileSync(path, 'utf8')), allowed = new Set(ALLOWED[rel(path)] ?? []);
  const words = new Set(code.match(/[A-Za-z_$][\w$]*/g) ?? []);
  return [...words].filter(w => MONEY.test(w) && !allowed.has(w)).sort();
}

describe('The movers never touch money (static fence)', () => {
  it('scans the movers tree and the runtime hook', () => {
    expect(moverFiles.length).toBeGreaterThan(10);
    expect(moverFiles.map(rel)).toEqual(expect.arrayContaining([
      'src/harbour/horizon/movers/shared/registry.ts', 'src/harbour/horizon/movers/shared/ground/kernel.ts', 'src/harbour/horizon/movers/board/controller.ts',
    ]));
  });
  it('imports nothing from src/core, src/ledgerSync, workers, ../../data/ or house/books', () => {
    const hits = files.flatMap(f => importsOf(f).map(spec => forbiddenImport(f, spec)).filter((h):h is string => h !== null).map(h => `${rel(f)}: ${h}`));
    expect(hits).toEqual([]);
  });
  it('names no balance, ledger, amount, cents or fund outside comments (listed exceptions only)', () => {
    const hits = files.flatMap(f => moneyIdentifiers(f).map(w => `${rel(f)}: ${w}`));
    expect(hits).toEqual([]);
    // Every listed exception is still needed (a stale allowance would hide a new use).
    for (const [file, words] of Object.entries(ALLOWED)) {
      const code = stripComments(readFileSync(join(ROOT, file), 'utf8'));
      for (const w of words) expect(new RegExp(`\\b${w}\\b`).test(code), `${file}: ${w}`).toBe(true);
    }
  });
  it('keeps the movers free of clocks and randomness (Math.random, performance.now, Date.now)', () => {
    const hits = moverFiles.flatMap(f => (stripComments(readFileSync(f, 'utf8')).match(/Math\.random|performance\.now|Date\.now/g) ?? []).map(m => `${rel(f)}: ${m}`));
    expect(hits).toEqual([]);
  });
  it('the scanner itself catches what it fences', () => {
    const at = join(ROOT, 'src/harbour/horizon/movers/board/controller.ts');
    expect(forbiddenImport(at, '../../../../core/ledger.ts')).toMatch(/src\/core\//);
    expect(forbiddenImport(at, '../../../../ledgerSync/pull.ts')).toMatch(/src\/ledgerSync\//);
    expect(forbiddenImport(at, '../../../../../workers/api.ts')).toMatch(/workers\//);
    expect(forbiddenImport(at, '../../data/seed.ts')).toMatch(/\.\.\/\.\.\/data\//);
    expect(forbiddenImport(at, '../../../../house/books/read.ts')).toMatch(/house\/books/);
    expect(forbiddenImport(at, '../shared/mode.ts')).toBeNull();
    expect(stripComments('const a = 1; // balance\n/* ledger */ const b = "x";')).not.toMatch(MONEY);
    expect(stripComments("const s = 'a // b'; const fundId = 1;")).toMatch(/fundId/);
  });
});
