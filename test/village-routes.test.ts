import { describe, expect, it } from 'vitest';
import { housePath, parseHouseRoute, type HouseRoute } from '../src/hearthside/houseRoutes.ts';
import { houseTargetRoute, houseTabForRoute, houseToolPlace, houseLifeRoute, readHouseReturn, saveHouseReturn, type HouseIdentity } from '../src/house/navigation.ts';
import { houseReturnSlot } from '../src/house/returnCache.ts';
import { VILLAGE_HOUSE_ADDRESSES, villageHouseAddress } from '../src/house/villageLocation.ts';

const householdId = 'HH-village';
const identity: HouseIdentity = { environment: 'development', householdId, memberId: 'MEM-one', scope: 'household' };
const storage = () => { const rows = new Map<string, string>(); return { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => rows.set(key, value), removeItem: (key: string) => rows.delete(key) }; };

describe('Little Harbour physical addresses', () => {
  it('round trips all twelve canonical physical locations', () => {
    expect(VILLAGE_HOUSE_ADDRESSES).toHaveLength(12);
    for (const address of VILLAGE_HOUSE_ADDRESSES) {
      const route: HouseRoute = { householdId, scope: 'household', ...address };
      expect(villageHouseAddress(address.village)).toEqual(address);
      expect(parseHouseRoute(housePath(route), householdId)).toEqual(route);
    }
  });

  it('rejects incompatible, personal, and incomplete Village URLs while keeping legacy routes unchanged', () => {
    const bank = `/house/home/middle?household=${householdId}&scope=household&place=fund-bank&villageRoom=banking-hall`;
    expect(parseHouseRoute(bank, householdId)).toMatchObject({ room: 'home', level: 'middle', village: { place: 'fund-bank', room: 'banking-hall' } });
    for (const path of [
      `/house/study/middle?household=${householdId}&scope=household&place=fund-bank&villageRoom=banking-hall`,
      `/house/home/middle?household=${householdId}&scope=household&place=library&villageRoom=library-floor`,
      `/house/home/middle?household=${householdId}&scope=personal&place=fund-bank&villageRoom=banking-hall`,
      `/house/home/middle?household=${householdId}&scope=household&villageRoom=banking-hall`,
    ]) expect(parseHouseRoute(path, householdId)).toBeNull();
    expect(parseHouseRoute(`/house/study/middle?household=${householdId}&scope=household`, householdId)).toEqual({ room: 'study', level: 'middle', householdId, scope: 'household' });
    expect(() => housePath({ householdId, scope: 'household', room: 'study', level: 'middle', village: { place: 'fund-bank', room: 'banking-hall' } })).toThrow('HOUSE_INVALID_VILLAGE_LOCATION');
  });

  it('requires an explicit household scope for every village location before personal scope can be inferred', () => {
    for (const address of VILLAGE_HOUSE_ADDRESSES) {
      const path = housePath({ householdId, scope: 'household', ...address });
      expect(parseHouseRoute(path.replace('&scope=household', ''), householdId)).toBeNull();
      expect(parseHouseRoute(path.replace('scope=household', 'scope=personal'), householdId)).toBeNull();
      expect(() => housePath({ householdId, ...address })).toThrow('HOUSE_INVALID_VILLAGE_LOCATION');
      expect(() => housePath({ householdId, scope: 'personal', ...address })).toThrow('HOUSE_INVALID_VILLAGE_LOCATION');
    }
    expect(parseHouseRoute(`/house/home/above?household=${householdId}`, householdId)).toEqual({ householdId, room: 'home', level: 'above' });
  });

  it('keeps the physical Bank origin through a tool and restores only finite body state for its identity', () => {
    const bank: HouseRoute = { householdId, scope: 'household', room: 'home', level: 'middle', village: { place: 'fund-bank', room: 'banking-hall' } };
    const books = houseTargetRoute(bank, 'books');
    expect(books).toMatchObject({ ...bank, surface: 'books' });
    expect(parseHouseRoute(housePath(books), householdId)).toEqual(books);
    const local = storage();
    saveHouseReturn(local, identity, bank, { body: { place: 'bank', x: 1.5, z: -2.25, yaw: 0.5 } }, houseReturnSlot(books));
    expect(readHouseReturn(local, identity, houseReturnSlot(books))).toMatchObject({ route: bank, body: { place: 'bank', x: 1.5, z: -2.25, yaw: 0.5 } });
    saveHouseReturn(local, identity, bank, { body: { place: 'bank', x: Number.POSITIVE_INFINITY, z: 0, yaw: 0 } }, 'invalid-body');
    expect(readHouseReturn(local, identity, 'invalid-body')?.body).toBeUndefined();
    expect(readHouseReturn(local, { ...identity, memberId: 'MEM-two' }, houseReturnSlot(books))).toBeNull();
  });
});


it('opens the requested tool from every physical room without changing its origin',()=>{
  const routes=[['books','ledger','study','middle'],['planner','planner','study','above'],['calendar','calendar','study','below'],['loft-banks','home','home','above'],['cellar-bills','home','home','below'],['plan-studio','plan','kitchen-table','below'],['pottery','play','making','above'],['memories','play','together','below']] as const;
  for(const origin of VILLAGE_HOUSE_ADDRESSES)for(const [surface,tab,room,level] of routes){
    const route=houseTargetRoute({...origin,householdId:'HH-1',scope:'household'},surface);
    expect(houseTabForRoute(route)).toBe(tab);expect(houseToolPlace(route)).toEqual({room,level});
    expect(route.village).toEqual(origin.village);expect(route.room).toBe(origin.room);
    if(surface==='memories')expect(houseLifeRoute(route).room).toBe('theatre');
  }
});
