import {readdirSync,readFileSync,statSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {describe,expect,it} from 'vitest';

/** Cooking outcomes are recreational. This direct-import boundary includes every
 * kitchen module, including presentation and storage, without sharing legacy mover checks. */
const root=resolve(__dirname,'..'),kitchen=join(root,'src/harbour/horizon/kitchen');
const rel=(path:string)=>relative(root,path).split(sep).join('/');
function walk(dir:string):string[]{return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):/\.(ts|tsx|js|mjs)$/.test(name)?[path]:[];});}
function stripComments(source:string):string{
  let result='',i=0;
  while(i<source.length){
    const c=source[i]!,next=source[i+1];
    if(c==='/'&&next==='/'){while(i<source.length&&source[i]!=='\n')i++;continue;}
    if(c==='/'&&next==='*'){const end=source.indexOf('*/',i+2);i=end<0?source.length:end+2;result+=' ';continue;}
    if(c==='\''||c==='"'||c==='`'){let end=i+1;while(end<source.length&&source[end]!==c){if(source[end]==='\\')end++;end++;}result+=source.slice(i,end+1);i=end+1;continue;}
    result+=c;i++;
  }
  return result;
}
const imports=(source:string)=>[...stripComments(source).matchAll(/(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m=>(m[1]??m[2]??m[3])!);
function forbidden(from:string,specifier:string){
  const path=specifier.startsWith('.')?rel(resolve(dirname(from),specifier)):specifier;
  return /^(?:src\/)?(?:core|ledgerSync|workers)(?:\/|$)/.test(path)||/(?:^|\/)house\/books(?:\/|\.|$)/.test(path)||/^src\/harbour\/data\//.test(path)||/fund|ledger|money|balance/i.test(path);
}

describe('Yacht Kitchen never reads or writes household finances',()=>{
  const files=walk(kitchen);
  it('covers the entire kitchen tree including state, configuration, controls and private storage',()=>{
    expect(files.map(rel)).toEqual(expect.arrayContaining(['config','model','input','storage'].map(name=>`src/harbour/horizon/kitchen/${name}.ts`)));
  });
  it('imports no finance, task-command, household-reading or hosted-write modules',()=>{
    const hits=files.flatMap(file=>imports(readFileSync(file,'utf8')).filter(specifier=>forbidden(file,specifier)).map(specifier=>`${rel(file)}: ${specifier}`));
    expect(hits).toEqual([]);
  });
  it('cannot transmit service state or progression through network calls',()=>{
    const network=/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(|\b(?:sendBeacon|postMessage)\s*\(/g;
    const hits=files.flatMap(file=>(stripComments(readFileSync(file,'utf8')).match(network)??[]).map(call=>`${rel(file)}: ${call}`));
    expect(hits).toEqual([]);
  });
  it('keeps service outcomes independent of ambient clocks and randomness',()=>{
    const source=stripComments(readFileSync(join(kitchen,'model.ts'),'utf8'));
    expect(source).not.toMatch(/Math\.random|performance\.now|Date\.now|crypto\.getRandomValues/);
  });
  it('resolves imports and ignores comments without hiding string or dynamic-import specifiers',()=>{
    const from=join(kitchen,'model.ts');
    for(const path of ['../../../core/commands.ts','../../../ledgerSync/push.ts','../../../../workers/write.ts','../../../house/books/write.ts','../../data/reading.ts'])expect(forbidden(from,path),path).toBe(true);
    expect(forbidden(from,'./storage.ts')).toBe(false);
    expect(imports("// import 'ignored';\nimport type {X} from '../../../core/types.ts'; export {y} from './config.ts'; const m=import('../../../ledgerSync/push.ts');")).toEqual(['../../../core/types.ts','./config.ts','../../../ledgerSync/push.ts']);
  });
});
