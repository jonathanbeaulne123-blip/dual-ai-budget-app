/** One local metre-space plan drives floors, collision, furnishings and future station anchors.
 * +z is the bow. Each deck is connected by real stair treads (no room scene swaps). */
export type Point = {x:number;y:number;z:number};
export type Rect = {x0:number;x1:number;z0:number;z1:number};
export type Floor = Rect & {id:string;y:number;rise?:number};
export type Fixture = Rect & {id:string;y:number;height:number;kind:'wall'|'rail'|'door'|'bed'|'seat'|'table'|'counter'|'machine';label?:string};
export const DECK={lower:.65,main:3.85,upper:7.05} as const;
export const YACHT_SIZE={width:14,length:44};
export const HELM:Point={x:0,y:DECK.upper,z:6};
export const BOARDING:Point={x:0,y:.65,z:-22};
export const LADDER:Point={x:0,y:-.5,z:-23.1};
export const inside=(r:Rect,x:number,z:number,margin=0)=>x>=r.x0-margin&&x<=r.x1+margin&&z>=r.z0-margin&&z<=r.z1+margin;
export const FLOORS:Floor[]=[
 {id:'lower',x0:-6.4,x1:6.4,z0:-20,z1:18,y:DECK.lower},
 {id:'swim-platform',x0:-5,x1:5,z0:-23,z1:-20,y:DECK.lower},
 // Open aft stairwell, middle service stairwell and upper stairwell retain headroom.
 {id:'main-port',x0:-7,x1:-4,z0:-20,z1:20,y:DECK.main},
 {id:'main-starboard',x0:4,x1:7,z0:-20,z1:20,y:DECK.main},
 {id:'main-aft-port',x0:-4,x1:-1.3,z0:-20,z1:-13,y:DECK.main},
 {id:'main-aft-starboard',x0:1.3,x1:4,z0:-20,z1:-13,y:DECK.main},
 {id:'main-aft',x0:-4,x1:4,z0:-13,z1:-3,y:DECK.main},
 {id:'main-centre',x0:-4,x1:1.5,z0:-3,z1:4,y:DECK.main},
 {id:'main-fore',x0:-4,x1:4,z0:4,z1:20,y:DECK.main},
 {id:'aft-stairs',x0:-1.3,x1:1.3,z0:-20,z1:-13,y:DECK.lower,rise:3.2},
 {id:'service-stairs',x0:1.5,x1:4,z0:-3,z1:4,y:DECK.lower,rise:3.2},
 {id:'upper-port',x0:-6,x1:-4,z0:-12,z1:11,y:DECK.upper},
 {id:'upper-starboard',x0:-1.5,x1:6,z0:-12,z1:11,y:DECK.upper},
 {id:'upper-aft',x0:-4,x1:-1.5,z0:-12,z1:-3,y:DECK.upper},
 {id:'upper-fore',x0:-4,x1:-1.5,z0:4,z1:11,y:DECK.upper},
 {id:'upper-stairs',x0:-4,x1:-1.5,z0:-3,z1:4,y:DECK.main,rise:3.2},
];
export function floorHeight(f:Floor,z:number){return f.y+(f.rise?Math.max(0,Math.min(1,(z-f.z0)/(f.z1-f.z0)))*f.rise:0);}
export const FIXTURES:Fixture[]=[];
function box(id:string,x0:number,x1:number,z0:number,z1:number,y:number,height:number,kind:Fixture['kind'],label?:string){FIXTURES.push({id,x0,x1,z0,z1,y,height,kind,label});}
function wallZ(id:string,z:number,x0:number,x1:number,y:number,doorX?:number){
 if(doorX===undefined)box(id,x0,x1,z-.09,z+.09,y,2.55,'wall');
 else {box(id+'-left',x0,doorX-1,z-.09,z+.09,y,2.55,'wall');box(id+'-right',doorX+1,x1,z-.09,z+.09,y,2.55,'wall');box(id+'-door',doorX-1,doorX+1,z-.08,z+.08,y,2.4,'door',id.replaceAll('-',' '));}
}
// Lower accommodation: central 2.6 m passage, every cabin has a 2 m doorway.
for(const x of [-6.4,6.4])box('lower-hull-'+x,x-.1,x+.1,-20,18,DECK.lower,2.9,'wall');
wallZ('transom',-20,-6.4,6.4,DECK.lower,0);wallZ('bow',18,-6.4,6.4,DECK.lower);
for(const side of [-1,1]){
 const x=side*1.5;
 for(const [a,b] of [[-19,-17],[-15,-11],[-9,-5],...(side<0?[[-3,-1],[1,7]]:[[4.5,7]]),[9,13],[15,18]])box(`hall-${side}-${a}`,x-.09,x+.09,a!,b!,DECK.lower,2.55,'wall');
 for(const z of [-16,-10,-4,...(side<0?[0]:[]),8,14])box(`cabin-door-${side}-${z}`,x-.08,x+.08,z-1,z+1,DECK.lower,2.4,'door','Cabin door');
 for(const z of [-13,-7,...(side<0?[3]:[]),11])wallZ(`partition-${side}-${z}`,z,side<0?-6.4:1.5,side<0?-1.5:6.4,DECK.lower);
}
export const ROOMS={
 owner:{x:-4,y:DECK.lower,z:15},guestPort:{x:-4,y:DECK.lower,z:7},guestStarboard:{x:4.5,y:DECK.lower,z:7},
 bathroom:{x:4.5,y:DECK.lower,z:15},crew:{x:-4,y:DECK.lower,z:-10},utility:{x:4.5,y:DECK.lower,z:-10},
 engine:{x:-4,y:DECK.lower,z:-16},shower:{x:4.5,y:DECK.lower,z:-16},
 salon:{x:0,y:DECK.main,z:8},indoorDining:{x:4.5,y:DECK.main,z:6},galley:{x:0,y:DECK.main,z:-8},
 foredeck:{x:0,y:DECK.main,z:17},aftDining:{x:4.7,y:DECK.main,z:-16},sunDeck:{x:3,y:DECK.upper,z:-8},bridge:HELM,
};
for(const [name,p] of Object.entries(ROOMS)){
 if(['owner','guestPort','guestStarboard','crew'].includes(name))box(name+'-bed',p.x-1.1,p.x+1.1,p.z-.8,p.z+1.4,p.y,.6,'bed');
 if(['bathroom','shower'].includes(name)){box(name+'-basin',5.3,6.1,p.z-1,p.z,p.y,.9,'counter');box(name+'-shower',3.5,5,p.z+1,p.z+2.4,p.y,2.2,'machine');}
 if(['utility','engine'].includes(name))box(name+'-equipment',p.x-1,p.x+1,p.z-.5,p.z+.7,p.y,1.3,'machine');
}
// Main weather house: real openings from aft and fore, open side promenade.
for(const x of [-5.6,5.6])box('main-side-'+x,x-.08,x+.08,-12.5,12.5,DECK.main,2.65,'wall');
wallZ('salon-fore',12.5,-5.6,5.6,DECK.main,0);
// Galley has TWO 2 m through routes and a service pass into the dining salon.
wallZ('galley-aft',-12.5,-5.6,5.6,DECK.main,0);
box('galley-divider-port',-5.6,-3.9,-3.3,-3.1,DECK.main,2.5,'wall');
box('galley-divider-mid',-1.6,1.3,-3.75,-2.65,DECK.main,.9,'counter');
box('salon-sofa',-5,-3,6,10,DECK.main,.65,'seat','Salon sofa');
box('salon-table',-.8,1.2,7,9,DECK.main,.75,'table');
box('indoor-table',3.2,4.8,5,9,DECK.main,.8,'table');
box('aft-table',3.8,5.5,-18.5,-15.5,DECK.main,.8,'table');
box('aft-seat',5.8,6.5,-18.5,-15.5,DECK.main,.5,'seat','Outdoor dining seat');
box('sun-seat',2,4,-10,-8,DECK.upper,.5,'seat','Sun deck seat');
box('helm-console',-1.2,1.2,7,8,DECK.upper,1,'counter');
// Safe rails with an open swim platform and wide stair gates; jumping can clear them.
for(const [level,y,width,z0,z1] of [['main',DECK.main,7,-20,20],['upper',DECK.upper,6,-12,11]] as const){
 for(const x of [-width,width])box(level+'-rail-'+x,x-.06,x+.06,z0,z1,y,.85,'rail');
 box(level+'-bow-rail',-width,width,z1-.06,z1+.06,y,.85,'rail');
 for(const [a,b] of [[-width,-1.4],[1.4,width]])box(level+'-aft-rail-'+a,a!,b!,z0-.06,z0+.06,y,.85,'rail');
}
export type GalleyStation={id:string;label:string;role:'storage'|'cold'|'prep'|'cook'|'plate'|'wash'|'waste'|'serve'|'return';at:Point;approach:Point;surface:Point;size:[number,number];facing:number};
const station=(id:string,label:string,role:GalleyStation['role'],x:number,z:number,dx:number,dz:number):GalleyStation=>({id:`yacht.galley.${id}`,label,role,at:{x,y:DECK.main,z},approach:{x:x+dx,y:DECK.main,z:z+dz},surface:{x,y:DECK.main+.9,z},size:[1.45,1.1],facing:Math.atan2(-dx,-dz)});
export const GALLEY:GalleyStation[]=[
 station('pantry','Ingredient pantry','storage',-4.7,-11,1.3,0),station('cold','Cold storage','cold',-4.7,-8.8,1.3,0),
 station('prep-port','Preparation','prep',-4.7,-6.6,1.3,0),station('hob','Cooking range','cook',4.7,-10.6,-1.3,0),
 station('plate','Plating','plate',4.7,-8.4,-1.3,0),station('wash','Wash and reset','wash',4.7,-6.2,-1.3,0),
 station('waste','Waste','waste',2.4,-11.6,0,1.3),station('prep-island','Shared preparation','prep',0,-8.2,0,1.4),
 station('serve','Serve to dining','serve',0,-3.2,0,-1.3),station('return','Return dishes','return',0,-3.2,0,1.3),
];
for(const s of GALLEY.filter(s=>!['serve','return'].includes(s.role)))box(s.id,s.at.x-.725,s.at.x+.725,s.at.z-.55,s.at.z+.55,DECK.main,s.role==='cold'?2.4:.9,s.role==='cold'?'machine':'counter',s.label);
export const SEATS=FIXTURES.filter(f=>f.kind==='seat').map(f=>({id:f.id,label:f.label!,at:{x:(f.x0+f.x1)/2,y:f.y+.5,z:(f.z0+f.z1)/2},stand:{x:f.id==='salon-sofa'?-2.1:f.id==='aft-seat'?6.1:f.x0-.8,y:f.y,z:f.id==='aft-seat'?-14.5:(f.z0+f.z1)/2}}));
