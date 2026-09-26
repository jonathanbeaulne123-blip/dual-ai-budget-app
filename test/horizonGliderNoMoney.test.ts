import {readdirSync,readFileSync,statSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

/**
 * Play earns nothing (passes/02-movers.md rule 10, FLIGHT.md §7): no file under src/harbour/horizon/movers/** imports
 * the books. A static fence over every import specifier (static, dynamic, `import type`, `export … from`), resolved
 * against the importing file: nothing under src/core/**, src/ledgerSync/**, src/harbour/data/reading.ts, and no
 * import path matching /fund|ledger|money|balance/.
 */
const root=process.cwd(),movers=join(root,'src','harbour','horizon','movers');
function walk(dir:string):string[]{
  return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):/\.(ts|tsx|js|mjs)$/.test(name)?[path]:[];});
}
const importsOf=(source:string)=>[...source.matchAll(/(?:\bfrom|\bimport\s*\(|^\s*import)\s*["']([^"']+)["']/gm)].map(m=>m[1]!);
const resolved=(file:string,specifier:string)=>specifier.startsWith('.')?relative(root,resolve(dirname(file),specifier)).replace(/\\/g,'/'):specifier;
const MONEY_FENCE:{name:string;test:(path:string)=>boolean}[]=[
  {name:'src/core/**',test:p=>/^src\/core(\/|\.ts$|$)/.test(p)},
  {name:'src/ledgerSync/**',test:p=>/^src\/ledgerSync(\/|$)/.test(p)},
  {name:'src/harbour/data/reading.ts',test:p=>/^src\/harbour\/data\/reading(\.ts)?$/.test(p)},
  {name:'/fund|ledger|money|balance/ in the path',test:p=>/fund|ledger|money|balance/i.test(p)},
];

describe('the movers never import the books',()=>{
  const files=walk(movers);
  it('covers the glider, the parachute and the shared seam',()=>{
    const names=files.map(f=>relative(movers,f).replace(/\\/g,'/'));
    for(const expected of ['registry.ts','shared/mode.ts','shared/wind.ts','glider/wing.ts','glider/chute.ts','glider/controller.ts','glider/env.ts','glider/index.ts'])expect(names).toContain(expected);
  });
  it('resolves relative specifiers before judging them (the fence is not fooled by ../../..)',()=>{
    const file=join(movers,'glider','x.ts');
    expect(MONEY_FENCE.some(f=>f.test(resolved(file,'../../../../core/types.ts')))).toBe(true);
    expect(MONEY_FENCE.some(f=>f.test(resolved(file,'../../../../ledgerSync/worldPresenceWire.ts')))).toBe(true);
    expect(MONEY_FENCE.some(f=>f.test(resolved(file,'../../../data/reading.ts')))).toBe(true);
    expect(MONEY_FENCE.some(f=>f.test(resolved(file,'../../fundBook.ts')))).toBe(true);
    expect(MONEY_FENCE.some(f=>f.test(resolved(file,'./wing.ts')))).toBe(false);
  });
  for(const file of files){
    it(`${relative(root,file).replace(/\\/g,'/')} imports nothing that reads money`,()=>{
      const bad=importsOf(readFileSync(file,'utf8')).map(s=>({s,p:resolved(file,s)})).filter(({p})=>MONEY_FENCE.some(f=>f.test(p)));
      expect(bad).toEqual([]);
    });
  }
});
