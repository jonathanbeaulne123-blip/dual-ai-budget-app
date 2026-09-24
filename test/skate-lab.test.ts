/**
 * Skate Lab: every named scenario runs headless on the real driver and shows
 * what it says it shows; and the lab is dev-only (fenced from src/ and the build).
 */
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';
import {describe,expect,it} from 'vitest';
import {createLabCore} from './browser/skateLabCore.ts';
import {LAB_SCENARIOS} from './browser/skateLabScenarios.ts';

function inOrder(kinds:string[],seq:string[]):boolean{let i=0;for(const k of kinds)if(i<seq.length&&k===seq[i])i++;return i===seq.length;}

describe('skate lab · scenarios (headless, real driver)',()=>{
  for(const sc of LAB_SCENARIOS){
    it(`${sc.name}: ${sc.title}`,()=>{
      const lab=createLabCore();lab.load(sc.load);lab.script(sc.script);lab.step(sc.frames);
      const kinds=lab.kinds();
      if(process.env.LAB_DEBUG)console.log(sc.name,kinds.join(' '));
      expect(inOrder(kinds,sc.expect.seq),`${sc.name}: ${kinds.join(' ')}`).toBe(true);
      for(const n of sc.expect.not??[])expect(kinds.some(k=>k===n||k.startsWith(n+':')),`${sc.name} has ${n}: ${kinds.join(' ')}`).toBe(false);
      expect(lab.trace()).toHaveLength(sc.frames);
      expect(lab.trace().every(f=>Number.isFinite(f.present.x)&&Number.isFinite(f.present.y))).toBe(true);
    });
  }
  it('is deterministic: the same scenario twice gives the same trace',()=>{
    const run=()=>{const lab=createLabCore(),sc=LAB_SCENARIOS.find(s=>s.name==='line')!;lab.load(sc.load);lab.script(sc.script);lab.step(sc.frames);return JSON.stringify(lab.trace());};
    expect(run()).toBe(run());
  });
});

describe('skate lab · dev only',()=>{
  const root=join(__dirname,'..');
  const walk=(dir:string):string[]=>readdirSync(dir).flatMap(n=>{const p=join(dir,n);return statSync(p).isDirectory()?walk(p):[p];});
  it('nothing under src/ imports the lab',()=>{
    const offenders=walk(join(root,'src')).filter(f=>/\.(ts|tsx)$/.test(f)).filter(f=>/from\s+['"][^'"]*(skateLab|skate-lab)/.test(readFileSync(f,'utf8'))).map(f=>relative(root,f));
    expect(offenders).toEqual([]);
  });
  it('the production build has no lab entry (vite input is index.html; no lab html in the root)',()=>{
    const config=readFileSync(join(root,'vite.config.ts'),'utf8');
    expect(config).not.toMatch(/skate-?lab/i);
    expect(readFileSync(join(root,'index.html'),'utf8')).not.toMatch(/skate-?lab/i);
    expect(existsSync(join(root,'skate-lab.html'))).toBe(false);
  });
  it('a built dist (when present) carries no lab code',()=>{
    const dist=join(root,'dist');
    if(!existsSync(dist))return;
    const hits=walk(dist).filter(f=>/\.(js|html)$/.test(f)).filter(f=>/skateLab|__skate-lab/.test(readFileSync(f,'utf8')));
    expect(hits).toEqual([]);
  });
});
