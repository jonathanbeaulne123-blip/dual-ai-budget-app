import {describe,expect,it} from "vitest";
import {housePath,parseHouseRoute} from "../src/hearthside/houseRoutes.ts";
import {houseLifeRoute,houseRouteFromLife,readHouseReturn,saveHouseReturn,type HouseIdentity} from "../src/house/navigation.ts";
const identity:HouseIdentity={environment:"development",householdId:"HH-house",memberId:"MEM-one",scope:"personal"};
const storage=()=>{const rows=new Map<string,string>();return {getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>{rows.set(key,value);},removeItem:(key:string)=>{rows.delete(key);}};};
describe("one scoped house navigator",()=>{
  it("round trips object, focused surface, scope and time without a second address",()=>{
    const route={room:"together" as const,level:"middle" as const,householdId:identity.householdId,scope:"personal" as const,object:"piece/PIECE-1/DESIGN-1",surface:"pottery",time:"2026-09"};
    expect(parseHouseRoute(housePath(route),identity.householdId)).toEqual(route);
    expect(houseLifeRoute(route)).toMatchObject({room:"studio",surface:"studio",object:{kind:"piece",id:"PIECE-1",designId:"DESIGN-1"}});
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
  it("fails closed on an addressed foreign scope and malformed recovered state",()=>{
    expect(parseHouseRoute("/house/home/middle?scope=anything",identity.householdId)).toBeNull();
    expect(parseHouseRoute("/house/home/middle?household=HH-other",identity.householdId)).toBeNull();
    const bad={getItem:()=>'{"version":1}',setItem:()=>{},removeItem:()=>{}};
    expect(readHouseReturn(bad,identity)).toBeNull();
  });
});
