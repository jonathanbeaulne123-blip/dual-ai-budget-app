// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {HerculesWorkspaceRoom} from '../src/workspace/Workspace.tsx';
import {createWorkspaceProject,applyWorkspaceCommand} from '../src/workspace/contracts.ts';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let host:any,root:any,snapshot:any,props:any,deferPost:any,finishPost:any;
const now=new Date().toISOString();
const mk=(id:string,title:string)=>createWorkspaceProject(id,title,'MEM-001',now);
const button=(text:string)=>[...host.querySelectorAll('button')].find((x:any)=>x.textContent===text) as HTMLButtonElement;
async function click(text:string){await act(async()=>button(text).click());}
async function input(el:any,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
const composer=()=>host.querySelector('#hw-message') as HTMLTextAreaElement;
async function render(){await act(async()=>root.render(createElement(HerculesWorkspaceRoom,{...props,key:props.identity})));}
beforeEach(async()=>{
 sessionStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);deferPost=false;finishPost=null;
 snapshot={version:1,sequence:1,executionEnabled:false,projects:[mk('a','Project A'),mk('b','Project B')]};
 props={identity:'review-scope',environment:'development',householdId:'HH-REVIEW',memberId:'MEM-001',view:'personal',mode:'room',getAccessToken:async()=>'test',isCurrent:()=>true,onExpand:vi.fn(),onClose:vi.fn(),onLegacy:vi.fn(),onReview:vi.fn(),openProjectId:'a',onProjectOpened:()=>{props={...props,openProjectId:null};}};
 vi.stubGlobal('fetch',vi.fn(async(_url:any,init:any)=>{
   if(init?.body){const b=JSON.parse(init.body);const update=()=>{const i=snapshot.projects.findIndex((p:any)=>p.id===b.projectId);snapshot.projects[i]=applyWorkspaceCommand(snapshot.projects[i],b.command,b.expectedRevision,now);snapshot.sequence++;return new Response(JSON.stringify(snapshot));};
   if(deferPost)return new Promise(resolve=>finishPost=()=>resolve(update()));return update();}
   return new Response(JSON.stringify(snapshot));}));await render();
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('retains distinct composer drafts across project changes and hidden mode',async()=>{
 await input(composer(),'Alpha instruction');await click('Project BAn open possibility');await input(composer(),'Beta instruction');await click('Project AAn open possibility');expect(composer().value).toBe('Alpha instruction');props={...props,mode:'hidden'};await render();props={...props,mode:'room'};await render();expect(composer().value).toBe('Alpha instruction');await click('Project BAn open possibility');expect(composer().value).toBe('Beta instruction');
});
it('retains artifact and context local drafts across project switches',async()=>{
 snapshot.projects[0].artifacts.push({id:'v1',artifactId:'art',title:'Draft',format:'markdown',content:'Original',parentId:null,createdAt:now,author:'hercules',evidenceIds:[],validation:{status:'passed',details:'OK'}});snapshot.sequence++;await act(async()=>window.dispatchEvent(new Event('focus')));
 await click('Edit');await input(host.querySelector('[aria-label="Edit Draft"]'),'My unsaved revision');await click('Project context');await input(host.querySelector('.hw-context input'),'My unsaved project title');await click('Project BAn open possibility');await click('Project AAn open possibility');expect(host.querySelector('.hw-context input').value).toBe('My unsaved project title');await click('Working area · 1');await click('Edit');expect(host.querySelector('[aria-label="Edit Draft"]').value).toBe('My unsaved revision');
});
it('reopening same Plan project request selects that project again',async()=>{
 await render();await click('Project BAn open possibility');props={...props,mode:'hidden'};await render();props={...props,mode:'room',openProjectId:'a'};await render();expect(host.querySelector('.hw-project-title h2').textContent).toBe('Project A');
});
it('late send completion cannot erase the other project composer',async()=>{
 await click('Project BAn open possibility');await input(composer(),'Same draft');await click('Project AAn open possibility');await input(composer(),'Same draft');deferPost=true;
 await act(async()=>composer().closest('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 await click('Project BAn open possibility');expect(composer().value).toBe('Same draft');await act(async()=>finishPost());expect(composer().value).toBe('Same draft');
});

it('keeps drafts private across identity remount and restores original scope',async()=>{
 await input(composer(),'Private Alpha draft');props={...props,identity:'other-scope',householdId:'HH-OTHER',openProjectId:'a'};await render();expect(composer().value).toBe('');await input(composer(),'Other household draft');props={...props,identity:'review-scope',householdId:'HH-REVIEW',openProjectId:'a'};await render();expect(composer().value).toBe('Private Alpha draft');
});
it('can save an artifact and keep editing the accepted version',async()=>{
 snapshot.projects[0].artifacts.push({id:'v1',artifactId:'art',title:'Draft',format:'markdown',content:'Original',parentId:null,createdAt:now,author:'hercules',evidenceIds:[],validation:{status:'passed',details:'OK'}});snapshot.sequence++;await act(async()=>window.dispatchEvent(new Event('focus')));await click('Edit');await input(host.querySelector('[aria-label="Edit Draft"]'),'First revision');await click('Save edited version');expect(host.textContent).not.toContain('A newer version is available');await click('Edit');await input(host.querySelector('[aria-label="Edit Draft"]'),'Second revision');expect(button('Save edited version').disabled).toBe(false);await click('Save edited version');expect(snapshot.projects[0].artifacts.at(-1).content).toBe('Second revision');
});

it('keeps Google review editable when local validation fails before any request',async()=>{
 snapshot.projects[0].proposals.push({id:'gp',revision:1,artifactVersionId:null,scope:'personal',target:'google',actionId:'calendar-event',values:{title:'Event',content:'Reviewed event',start:'invalid',end:'invalid'},status:'draft',receiptId:null,reviewedRevision:null});snapshot.sequence++;
 props={...props,getGoogleAccessToken:async()=>'google-token'};await render();await act(async()=>window.dispatchEvent(new Event('focus')));await click('Review this change');await click('Confirm this Google change');
 expect(host.textContent).toContain('VALID_EVENT_TIMES_REQUIRED');expect(host.querySelector('[aria-label="Content for Google"]').disabled).toBe(false);expect(button('Cancel review')).toBeDefined();
});
it('uses a new submission identity after editing a proven-unsent Google review',async()=>{
 snapshot.projects[0].proposals.push({id:'gp',revision:1,artifactVersionId:null,scope:'personal',target:'google',actionId:'document',values:{title:'Document',content:'Original reviewed text'},status:'draft',receiptId:null,reviewedRevision:null});snapshot.sequence++;
 const requests:any[]=[];vi.stubGlobal('fetch',vi.fn(async(_url:any,init:any)=>{if(init?.body){const body=JSON.parse(init.body);if(body.operation==='external'){requests.push(body.review);return new Response(JSON.stringify({id:body.review.id,digest:body.confirmDigest,status:requests.length===1?'prepared':'accepted',remoteId:requests.length===1?undefined:'remote'}));}}return new Response(JSON.stringify(snapshot));}));
 props={...props,getGoogleAccessToken:async()=>'google-token'};await render();await act(async()=>window.dispatchEvent(new Event('focus')));await click('Review this change');await click('Confirm this Google change');await input(host.querySelector('[aria-label="Content for Google"]'),'Edited reviewed text');await click('Confirm this Google change');expect(requests).toHaveLength(2);expect(requests[0].id).not.toBe(requests[1].id);
});
it('unlocks the Google review after an explicit stale-source refusal before dispatch',async()=>{
 snapshot.projects[0].proposals.push({id:'gp',revision:1,artifactVersionId:null,scope:'personal',target:'google',actionId:'document',values:{title:'Document',content:'Original reviewed text'},status:'draft',receiptId:null,reviewedRevision:null});snapshot.sequence++;
 vi.stubGlobal('fetch',vi.fn(async(_url:any,init:any)=>{if(init?.body&&JSON.parse(init.body).operation==='external')return new Response(JSON.stringify({error:'ARTIFACT_CHANGED'}),{status:409});return new Response(JSON.stringify(snapshot));}));
 props={...props,getGoogleAccessToken:async()=>'google-token'};await render();await act(async()=>window.dispatchEvent(new Event('focus')));await click('Review this change');await click('Confirm this Google change');expect(host.textContent).toContain('ARTIFACT_CHANGED');expect(host.querySelector('[aria-label="Content for Google"]').disabled).toBe(false);expect(button('Cancel review')).toBeDefined();
});
it('keeps household sharing editable when local disclosure validation fails',async()=>{
 snapshot.projects[0].artifacts.push({id:'v1',artifactId:'art',title:'Draft',format:'markdown',content:'Original',parentId:null,createdAt:now,author:'hercules',evidenceIds:[],validation:{status:'passed',details:'OK'}});snapshot.sequence++;await act(async()=>window.dispatchEvent(new Event('focus')));await click('Review sharing');await input(host.querySelector('[aria-label="Content to share"]'),'');await click('Share this reviewed copy');expect(host.querySelector('[aria-label="Content to share"]').disabled).toBe(false);expect(button('Close review')).toBeDefined();
});

it('uses one refresh flight across focus, reconnect and polling, then accepts a later refresh',async()=>{
 vi.useFakeTimers();let finish!:(response:Response)=>void;
 const fetcher=vi.fn(()=>new Promise<Response>(resolve=>finish=resolve));vi.stubGlobal('fetch',fetcher);
 await act(async()=>window.dispatchEvent(new Event('focus')));
 await act(async()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));await vi.advanceTimersByTimeAsync(10000);});
 expect(fetcher).toHaveBeenCalledTimes(1);
 await act(async()=>finish(new Response(JSON.stringify(snapshot))));
 await act(async()=>window.dispatchEvent(new Event('focus')));expect(fetcher).toHaveBeenCalledTimes(2);
 await act(async()=>finish(new Response(JSON.stringify(snapshot))));
});

it.each([['AUTH_REQUIRED',401,'Reconnect to your Hearth account'],['WORKSPACE_NOT_ACTIVATED',503,'has not been activated']])('separates %s from loading and recovers after reconnect',async(error,status,message)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error}),{status:status as number})));
 props={...props,identity:'failed-opening'};await render();
 expect(host.textContent).not.toContain('Opening your private projects');expect(host.textContent).toContain(message);
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(snapshot))));await click('Reconnect');
 expect(host.querySelector('.hw-notice')).toBeNull();expect(host.textContent).toContain('Project A');
});

it('stops Opening when authentication stalls and can reconnect with the original draft',async()=>{
 vi.useFakeTimers();let release!:(token:string)=>void;
 props={...props,identity:'stalled-auth',getAccessToken:()=>new Promise<string>(resolve=>release=resolve)};await render();
 expect(host.textContent).toContain('Opening your private projects');
 await act(async()=>vi.advanceTimersByTimeAsync(30000));
 expect(host.textContent).not.toContain('Opening your private projects');expect(host.textContent).toContain('could not connect in time');
 props={...props,getAccessToken:async()=>'test'};await render();await click('Reconnect');
 expect(host.querySelector('.hw-notice')).toBeNull();expect(host.textContent).toContain('Project A');
 await act(async()=>release('late-token'));
});
