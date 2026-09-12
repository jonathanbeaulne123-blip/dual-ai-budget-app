import {afterEach,expect,it,vi} from 'vitest';
import {WorkspaceClient} from '../src/workspace/client.ts';
import {chatHercules} from '../src/core/herculesChat.ts';
import {herculesBriefing} from '../src/core/herculesPersonality.ts';
import {catalogHousehold} from '../src/core/index.ts';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

it('times out token acquisition and never dispatches a write when the old token finally arrives',async()=>{
 vi.useFakeTimers();let release!:(token:string)=>void;
 const token=vi.fn(()=>new Promise<string>(resolve=>release=resolve));
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const client=new WorkspaceClient('/workspace',token,()=>true,100);
 const outcome=client.request({commandId:'original',projectId:'p',expectedRevision:1,command:{type:'message',id:'message',text:'Changed'}}).catch(error=>error);
 await vi.advanceTimersByTimeAsync(100);
 expect(await outcome).toMatchObject({message:'WORKSPACE_TIMEOUT'});
 release('late-token');await Promise.resolve();await Promise.resolve();
 expect(fetcher).not.toHaveBeenCalled();
});

it('bounds response-body reading and can retry after a stalled response',async()=>{
 vi.useFakeTimers();let signal:AbortSignal|undefined;
 const stalled=new Response('{}');vi.spyOn(stalled,'json').mockImplementation(()=>new Promise(()=>{}));
 const snapshot={version:1,sequence:1,executionEnabled:false,projects:[]};
 const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>{signal=init?.signal??undefined;return stalled;});vi.stubGlobal('fetch',fetcher);
 const client=new WorkspaceClient('/workspace',async()=>'token',()=>true,100);
 const outcome=client.request().catch(error=>error);await vi.advanceTimersByTimeAsync(100);
 expect(await outcome).toMatchObject({message:'WORKSPACE_TIMEOUT'});expect(signal!.aborted).toBe(true);
 fetcher.mockImplementation(async()=>new Response(JSON.stringify(snapshot)));
 expect(await client.request()).toEqual(snapshot);
});

it('checks account scope again after reading a response body',async()=>{
 let current=true,release!:(body:unknown)=>void;
 const response=new Response('{}');vi.spyOn(response,'json').mockImplementation(()=>new Promise(resolve=>release=resolve));
 vi.stubGlobal('fetch',vi.fn(async()=>response));
 const client=new WorkspaceClient('/workspace',async()=>'token',()=>current,1000);
 const outcome=client.request().catch(error=>error);await Promise.resolve();await Promise.resolve();
 current=false;release({version:1,sequence:1,projects:[]});
 expect(await outcome).toMatchObject({message:'Your Hearth account changed. Reopen this workspace.'});
});

it('bounds a legacy model response body and leaves later conversation requests usable',async()=>{
 vi.useFakeTimers();let signal:AbortSignal|undefined;
 const response=new Response('{}',{headers:{'Content-Type':'application/json'}});
 vi.spyOn(response,'json').mockImplementation(()=>new Promise(()=>{}));
 const req={message:'Tell me about a sunny napping spot',briefing:herculesBriefing(catalogHousehold(),'ledger','2026-09-10'),grounded:{spoken:'I am here to help.'}};
 const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>{signal=init?.signal??undefined;return response;});
 const first=chatHercules(req,{fetch:fetcher,timeoutMs:100});await vi.advanceTimersByTimeAsync(100);
 expect((await first).source).toBe('local');expect(signal!.aborted).toBe(true);
 const next=await chatHercules({...req,message:'Tell me about your blanket'},{timeoutMs:100,fetch:async()=>new Response(JSON.stringify({ok:true,provider:'gemini',reply:'The blanket is soft and warm.'}),{headers:{'Content-Type':'application/json'}})});
 expect(next).toMatchObject({source:'ai',provider:'gemini',text:'The blanket is soft and warm.'});
});
