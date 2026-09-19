import {describe,expect,it} from "vitest";
import {housePath,parseHouseRoute} from "../src/hearthside/houseRoutes.ts";
import {houseLifeRoute,houseRouteFromLife,readHouseReturn,saveHouseReturn,type HouseIdentity} from "../src/house/navigation.ts";
import {houseCameraRoute,houseCameraSlot,houseReturnSlot,needsHouseReturnCapture} from "../src/house/returnCache.ts";
const identity:HouseIdentity={environment:"development",householdId:"HH-house",memberId:"MEM-one",scope:"personal"};
const storage=()=>{const rows=new Map<string,string>();return {getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>{rows.set(key,value);},removeItem:(key:string)=>{rows.delete(key);}};};
describe("one scoped house navigator",()=>{
  it("round trips object, focused surface, scope and time without a second address",()=>{
    const route={room:"together" as const,level:"middle" as const,householdId:identity.householdId,scope:"personal" as const,object:"piece/PIECE-1/DESIGN-1",surface:"pottery",time:"2026-09"};
    expect(parseHouseRoute(housePath(route),identity.householdId)).toEqual(route);
    expect(houseLifeRoute(route)).toMatchObject({room:"studio",surface:"studio",object:{kind:"piece",id:"PIECE-1",designId:"DESIGN-1"}});
  });
  it("round trips a Studio selection while retaining its experience and original return",()=>{
    const local=storage();
    const origin={room:"together" as const,level:"middle" as const,householdId:identity.householdId,scope:"personal" as const};
    const first={...origin,surface:"pottery",object:"experience/EXP-1",studioSelection:{designId:"DESIGN-A",pieceId:"PIECE-A"}};
    const replacement={...first,studioSelection:{designId:"DESIGN-B",pieceId:"PIECE-B"}};
    expect(parseHouseRoute(housePath(first),identity.householdId)).toEqual(first);
    const life=houseLifeRoute(first);
    expect(life).toMatchObject({room:"studio",surface:"studio",object:{kind:"experience",id:"EXP-1"},studioSelection:{designId:"DESIGN-A",pieceId:"PIECE-A"}});
    expect(houseRouteFromLife(life,"personal")).toEqual(first);
    saveHouseReturn(local,identity,origin,{},houseReturnSlot(first));
    expect(needsHouseReturnCapture(first,replacement)).toBe(false);
    expect(readHouseReturn(local,identity,houseReturnSlot(replacement))?.route).toEqual(origin);
    expect(parseHouseRoute("/house/together/middle?household=HH-house&scope=personal&surface=pottery&design=DESIGN-A",identity.householdId)).toBeNull();
    expect(parseHouseRoute("/house/together/middle?household=HH-house&scope=personal&surface=life&design=DESIGN-A&piece=PIECE-A",identity.householdId)).toBeNull();
  });
  it("places Theatre below and the adjoining Pottery Studio at the common floor",()=>{
    const theatre={room:"together" as const,level:"below" as const,householdId:identity.householdId,scope:"personal" as const,surface:"memories"};
    expect(housePath(theatre)).toContain("room=theatre");
    expect(houseLifeRoute(theatre).room).toBe("theatre");
    expect(houseRouteFromLife({version:1,householdId:identity.householdId,room:"studio",mode:"present",surface:"studio"},"personal")).toMatchObject({level:"middle",surface:"pottery"});
    expect(parseHouseRoute("/house/together/below?household=HH-house&room=studio",identity.householdId)).toMatchObject({level:"below"});
  });
  it("restores only the originating environment, household, member, scope and object",()=>{
    const local=storage(),route={room:"study" as const,level:"middle" as const,householdId:identity.householdId,scope:"personal" as const,object:"experience/EXP-one"};
    saveHouseReturn(local,identity,route,{focus:"books-today",scroll:241,camera:[-3,4,12]},"books");
    expect(readHouseReturn(local,identity,"books")).toMatchObject({route,focus:"books-today",scroll:241,camera:[-3,4,12]});
    for(const change of [{environment:"production" as const},{householdId:"HH-other"},{memberId:"MEM-two"},{scope:"household" as const}])expect(readHouseReturn(local,{...identity,...change},"books")).toBeNull();
    expect(readHouseReturn(local,identity,"pottery")).toBeNull();
  });

  it("keeps an addressed A to B return stack without crossing scope or time",()=>{
    const local=storage();
    const origin={room:"together" as const,level:"middle" as const,householdId:identity.householdId,scope:"personal" as const};
    const first={...origin,surface:"letters",object:"note/NOTE-A"};
    const second={...origin,surface:"letters",object:"note/NOTE-B"};
    saveHouseReturn(local,identity,origin,{focus:"house-action-together-middle-letters"},houseReturnSlot(first));
    saveHouseReturn(local,identity,first,{focus:"house-note-NOTE-A"},houseReturnSlot(second));
    expect(readHouseReturn(local,identity,houseReturnSlot(second))?.route).toEqual(first);
    expect(readHouseReturn(local,identity,houseReturnSlot(first))?.route).toEqual(origin);
    expect(readHouseReturn(local,{...identity,scope:"household"},houseReturnSlot(second))).toBeNull();
    const timed={...second,time:"2026-09"};
    saveHouseReturn(local,identity,houseCameraRoute(timed),{camera:[2,3,4]},houseCameraSlot(timed));
    expect(readHouseReturn(local,identity,houseCameraSlot(timed))?.camera).toEqual([2,3,4]);
    expect(readHouseReturn(local,identity,houseCameraSlot({...timed,time:"2026-10"}))).toBeNull();
  });
  it("retains a focused route separately from its room camera",()=>{
    const local=storage(),focused={room:"together" as const,level:"middle" as const,householdId:identity.householdId,scope:"personal" as const,surface:"pottery",object:"piece/PIECE-1/DESIGN-1"};
    saveHouseReturn(local,identity,focused,{scroll:17});
    saveHouseReturn(local,identity,houseCameraRoute(focused),{camera:[-3,4,12]},houseCameraSlot(focused));
    expect(readHouseReturn(local,identity)?.route).toEqual(focused);
    expect(readHouseReturn(local,identity,houseCameraSlot(focused))?.camera).toEqual([-3,4,12]);
  });
  it("fails closed on an addressed foreign scope and malformed recovered state",()=>{
    expect(parseHouseRoute("/house/home/middle?scope=anything",identity.householdId)).toBeNull();
    expect(parseHouseRoute("/house/home/middle?household=HH-other",identity.householdId)).toBeNull();
    const bad={getItem:()=>'{"version":1}',setItem:()=>{},removeItem:()=>{}};
    expect(readHouseReturn(bad,identity)).toBeNull();
  });
});
