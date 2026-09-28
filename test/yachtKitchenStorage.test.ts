import {describe,expect,it} from 'vitest';
import {createKitchenStorage,KITCHEN_REWARDS,type KitchenStorageBackend} from '../src/harbour/horizon/kitchen/storage.ts';
import type {KitchenResult,KitchenState} from '../src/harbour/horizon/kitchen/types.ts';

function backend(){
  const data=new Map<string,string>(),writes:string[]=[];
  const store:KitchenStorageBackend={getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes.push(value);data.set(key,value);}};
  return {data,writes,store};
}
const result=(id='run-1',patch:Partial<KitchenResult>={}):KitchenResult=>({id,service:'lunch',players:1,score:240,served:4,missed:1,bestSequence:3,stars:2,recipes:['salad','bruschetta'],...patch});
const session=():KitchenState=>({version:1,phase:'paused',service:'lunch',players:1,assists:{forgiveness:1,hazards:true,patience:1,warning:'normal',prep:'toggle'},seed:42,elapsed:30,remaining:210,score:0,served:0,missed:0,sequence:0,bestSequence:0,chefs:[{id:0,label:'Chef 1',pose:{x:0,y:3.85,z:-8,yaw:0},held:null,target:null,selection:0,task:null,connected:true,ready:true}],items:{},orders:[],stationIds:[],fires:{},events:[],eventSeq:0,nextId:1,nextOrderAt:35,tutorial:0,trolley:{dock:0,secured:false,progress:0},pauseReason:'Interrupted service',result:null});

describe('kitchen recreational progress and session persistence',()=>{
  it('writes completion, best score, rewards and interrupted-session removal atomically once',()=>{
    const b=backend(),storage=createKitchenStorage('person-a',b.store);expect(storage.saveSession(session())).toBe(true);
    const progress=storage.complete(result());expect(progress.unlocks).toEqual(['chef-apron','galley-sea-glass']);expect(storage.loadSession()).toBeNull();
    expect(Object.keys(progress.completed)).toEqual(['run-1']);expect(progress.best.lunch?.score).toBe(240);
    expect(b.writes).toHaveLength(2);expect(JSON.parse(b.writes[1]!)).toMatchObject({session:null,progress:{completed:{'run-1':result()}}});
    storage.complete(result());expect(b.writes).toHaveLength(2);
    const reload=createKitchenStorage('person-a',b.store);expect(reload.complete(result())).toEqual(progress);expect(b.writes).toHaveLength(2);
  });

  it('isolates identities and protects internal snapshots from caller mutation',()=>{
    const b=backend(),a=createKitchenStorage('person-a',b.store),other=createKitchenStorage('person-b',b.store);
    a.complete(result());const progress=a.loadProgress();progress.unlocks.push('invented');delete progress.completed['run-1'];
    expect(a.loadProgress().unlocks).not.toContain('invented');expect(a.loadProgress().completed['run-1']).toBeDefined();expect(other.loadProgress().completed).toEqual({});
    const snapshot=session();a.saveSession(snapshot);snapshot.chefs[0]!.held='invented';expect((a.loadSession() as KitchenState).chefs[0]!.held).toBeNull();
    const loaded=a.loadSession() as KitchenState;loaded.remaining=0;expect((a.loadSession() as KitchenState).remaining).toBe(210);
  });

  it('keeps the best run and grants each supported cosmetic from qualifying results',()=>{
    const b=backend(),storage=createKitchenStorage('progress',b.store);
    storage.complete(result());storage.complete(result('lower',{score:100,stars:1}));
    storage.complete(result('sunset',{service:'sunset'}));storage.complete(result('captain',{service:'banquet',stars:3}));
    const progress=createKitchenStorage('progress',b.store).loadProgress();
    expect(progress.best.lunch?.id).toBe('run-1');expect(progress.unlocks).toEqual(KITCHEN_REWARDS.map(r=>r.id));expect(Object.keys(progress.completed)).toHaveLength(4);
  });

  it('does not erase a new interrupted session when an old result-screen event repeats',()=>{
    const b=backend(),storage=createKitchenStorage('progress',b.store);storage.complete(result());storage.saveSession(session());storage.complete(result());
    expect(storage.loadSession()).toEqual(session());expect(createKitchenStorage('progress',b.store).loadSession()).toEqual(session());
  });

  it('reports denied and unavailable storage without throwing or inventing durable success',()=>{
    const denied:KitchenStorageBackend={getItem(){throw new Error('denied');},setItem(){throw new Error('quota');}};
    const storage=createKitchenStorage('progress',denied);expect(storage.status()).toBe('read');expect(storage.saveSession(session())).toBe(false);expect(storage.status()).toBe('write');
    expect(storage.complete(result()).completed['run-1']).toBeDefined();expect(storage.failed()).toBe(true);
    const unavailable=createKitchenStorage('progress',null);expect(unavailable.failed()).toBe(true);expect(unavailable.status()).toBe('unavailable');expect(unavailable.saveSession(null)).toBe(false);
  });

  it('retries a failed complete write without duplicating its score or rewards',()=>{
    const b=backend();let fail=true;
    const store:KitchenStorageBackend={getItem:b.store.getItem,setItem(k,v){if(fail)throw new Error('full');b.store.setItem(k,v);}};
    const storage=createKitchenStorage('progress',store);storage.complete(result());expect(storage.failed()).toBe(true);expect(b.data.has('progress')).toBe(false);
    fail=false;storage.complete(result());expect(storage.failed()).toBe(false);expect(b.writes).toHaveLength(1);
    const progress=createKitchenStorage('progress',store).loadProgress();expect(Object.keys(progress.completed)).toHaveLength(1);expect(progress.unlocks).toHaveLength(2);
  });

  it('rejects corrupt JSON and inconsistent schema atomically without rewriting stored data',()=>{
    const b=backend();b.data.set('progress','{bad');const corrupt=createKitchenStorage('progress',b.store);expect(corrupt.status()).toBe('corrupt');expect(corrupt.loadSession()).toBeNull();expect(b.data.get('progress')).toBe('{bad');
    const good=createKitchenStorage('good',b.store);good.complete(result());
    const tampered=JSON.parse(b.data.get('good')!);tampered.progress.unlocks.push('unknown-upgrade');b.data.set('progress',JSON.stringify(tampered));
    const invalid=createKitchenStorage('progress',b.store);expect(invalid.status()).toBe('corrupt');expect(invalid.loadProgress().completed).toEqual({});
    tampered.progress.unlocks.pop();tampered.session={version:1,remaining:1};b.data.set('progress',JSON.stringify(tampered));
    expect(createKitchenStorage('progress',b.store).status()).toBe('corrupt');
  });

  it('rejects invalid result IDs, conflicting duplicate events and partial snapshots',()=>{
    const b=backend(),storage=createKitchenStorage('progress',b.store);storage.complete(result());
    storage.complete(result('run-1',{score:999}));expect(storage.status()).toBe('invalid');expect(storage.loadProgress().best.lunch?.score).toBe(240);
    storage.complete(result('__proto__'));expect(Object.keys(storage.loadProgress().completed)).toEqual(['run-1']);
    storage.complete(result('invalid',{score:NaN}));expect(storage.loadProgress().completed.invalid).toBeUndefined();
    expect(storage.saveSession({version:1} as KitchenState)).toBe(false);expect(storage.loadSession()).toBeNull();expect(b.writes).toHaveLength(1);
    const invalid=session();invalid.chefs[0]!.pose.x=NaN;expect(storage.saveSession(invalid)).toBe(false);expect(storage.loadSession()).toBeNull();expect(b.writes).toHaveLength(1);
  });
});
