import {afterEach,expect,it,vi} from 'vitest';
import {WorkspaceClient} from '../src/workspace/client.ts';
afterEach(()=>vi.unstubAllGlobals());
const snapshot={version:1,sequence:7,projects:[],executionEnabled:false};
it('does not dispatch a cancelled write when its token resolves after a new effect generation starts',async()=>{
 let release!:(token:string)=>void,tokens=0;const calls:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);return Response.json(calls.length===1?snapshot:{version:1,sequence:7,events:[]});}));
 const client=new WorkspaceClient('/workspace',()=>++tokens===1?new Promise<string>(resolve=>{release=resolve;}):Promise.resolve('synthetic-current'));
 const old=client.request({commandId:'cancelled',projectId:'private',expectedRevision:0,command:{type:'create',id:'private',title:'Cancelled source'}}),rejected=expect(old).rejects.toThrow('account changed');
 client.cancelRequests();
 expect(await client.request()).toEqual(snapshot);
 release('synthetic-old');await rejected;
 expect(await client.request()).toEqual(snapshot);
 expect(calls).toEqual(['/workspace','/workspace?after=7']);
 expect(vi.mocked(fetch).mock.calls.every(([,init])=>init?.method==='GET')).toBe(true);
});
it('does not replace the new cache with an old response body after effect cancellation',async()=>{
 let body!:(value:unknown)=>void,oldSignal:AbortSignal|undefined;const calls:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{calls.push(url);if(calls.length===1){oldSignal=init?.signal as AbortSignal;return {ok:true,json:()=>new Promise(resolve=>{body=resolve;})}as Response;}return Response.json(calls.length===2?snapshot:{version:1,sequence:7,events:[]});}));
 const client=new WorkspaceClient('/workspace',async()=>'synthetic');
 const old=client.request(),rejected=expect(old).rejects.toThrow('account changed');
 await vi.waitFor(()=>expect(body).toBeTypeOf('function'));
 client.cancelRequests();expect(oldSignal?.aborted).toBe(true);
 expect(await client.request()).toEqual(snapshot);
 body({...snapshot,sequence:99,projects:[{id:'PRIVATE_OLD_CANARY'}]});await rejected;
 expect(await client.request()).toEqual(snapshot);expect(calls.at(-1)).toBe('/workspace?after=7');
});
