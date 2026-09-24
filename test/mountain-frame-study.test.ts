import {describe,it,expect} from 'vitest';
import {createFrameStudy} from '../src/harbour/mountain/performance.ts';
const resources={calls:70,geometries:100,textures:8};
describe('manual mountain frame evidence',()=>{
  it('measures actual painted intervals, including long stalls, and bounded resource peaks',()=>{
    const study=createFrameStudy();study.start('iPhone lap 1');
    [0,20,40,80,1080].forEach((n,i)=>study.frame(n,i+1,{...resources,geometries:100+i}));
    const result=study.stop();expect(result.samples).toBe(4);expect(result.elapsedMs).toBe(1080);
    expect(result.p95Ms).toBe(1000);expect(result.paintedFps).toBeCloseTo(4000/1080);
    expect(result.over33msPercent).toBe(50);expect(result.peak?.geometries).toBe(104);
    expect(result.note).toContain('not GPU bytes');
  });
  it('marks interruptions rather than counting hidden time as a frame or claiming continuous evidence',()=>{
    const study=createFrameStudy();study.start('Traversal');study.frame(0,1,resources);study.frame(20,1,resources);
    study.interrupt();study.frame(10_000,1,resources);study.frame(10_020,1,resources);
    const result=study.stop();expect(result.samples).toBe(2);expect(result.elapsedMs).toBe(40);expect(result.interruptions).toBe(1);
    study.frame(11_000,1,resources);expect(study.snapshot()).toEqual(result);
    study.start('New lap');expect(study.snapshot().samples).toBe(0);expect(study.snapshot().first).toBeNull();
  });
  it('bounds long captures and keeps reported resources immutable',()=>{
    const study=createFrameStudy();study.start('Repeated laps');
    for(let i=0;i<19_000;i++)study.frame(i*16,1,resources);
    const result=study.snapshot();expect(result.samples).toBe(18_000);expect(result.capped).toBe(true);expect(result.recording).toBe(false);
    result.peak!.calls=900;expect(study.snapshot().peak?.calls).toBe(70);
  });
});
