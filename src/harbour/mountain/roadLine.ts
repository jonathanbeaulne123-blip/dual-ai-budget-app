/**
 * The mountain road alignment: plan waypoints with authored elevations, eased into a
 * continuous centreline, and the bridge spans along it. Uphill from the town foot.
 */
import {authorCurve,type Point3} from './math.ts';
import {islandHeight} from './islandShape.ts';
/** The road foot meets town grade exactly: no step between the mountain road and the town lane. */
const FOOT_Y=islandHeight(-26,-44);

export type RoadWaypoint={at:readonly[number,number];y:number;tag?:string;halfWidth?:number};
type Authored={at:readonly[number,number];y:number|null;tag?:string};
/** A waypoint; `y` null means "on the even grade between the neighbouring anchors". */
const A=(x:number,z:number,y:number|null,tag?:string):Authored=>({at:[x,z],y,...(tag?{tag}:{})});
/** Anchors fix the elevation at features (the foot, bridge decks, districts, the summit); every other
 * waypoint takes the even grade between anchors, so no leg is steeper than its neighbours. */
function anchored(list:readonly Authored[]):RoadWaypoint[]{
  const s=[0];for(let i=1;i<list.length;i++)s.push(s[i-1]!+Math.hypot(list[i]!.at[0]-list[i-1]!.at[0],list[i]!.at[1]-list[i-1]!.at[1]));
  return list.map((w,i)=>{if(w.y!==null)return {at:w.at,y:w.y,...(w.tag?{tag:w.tag}:{})};
    let a=i,b=i;while(list[a]!.y===null)a--;while(list[b]!.y===null)b++;
    const t=(s[i]!-s[a]!)/(s[b]!-s[a]!);return {at:w.at,y:list[a]!.y!+(list[b]!.y!-list[a]!.y!)*t,...(w.tag?{tag:w.tag}:{})};});
}
const W=(x:number,z:number,y:number,tag?:string,halfWidth?:number):RoadWaypoint=>({at:[x,z],y,...(tag?{tag}:{}),...(halfWidth?{halfWidth}:{})});

/** Uphill. Tags name the features the race, bridges and paths hang from. */
export const ROAD_WAYPOINTS:readonly RoadWaypoint[]=anchored([
  A(-26,-44,FOOT_Y,'foot'),
  // Up the west bank past the Northlight lookout, over the river on the harbour bridge.
  A(-26.6,-48,FOOT_Y+.1),A(-27.4,-53,null),A(-27.6,-58,null),A(-26,-64,null),A(-22,-70,null),A(-15,-75,6.2,'bf-west'),A(-6,-78,null),A(4,-78.5,7.1,'bf-east'),A(14,-75.5,null),A(25,-71,null),
  // Neighbourhood switchbacks: three legs up the lower east slope, hairpins of ~9 unit radius.
  A(36,-65,null),A(48,-62.5,null),A(60,-64,8.2,'hairpin-1'),A(69,-69,null),A(70,-77,null),A(62,-82,null),
  A(48,-82,null),A(34,-82.5,null),A(24,-86,14.8,'hairpin-2'),A(19,-93,null),A(24,-100,null),A(36,-101,null),
  // East flank sweep: past Hearth Terrace and the sunny shelf, round the east arm.
  A(52,-100,19.2,'hearth'),A(66,-104,null),A(81,-112,null),A(90,-124,null),A(93,-137,27,'shelf'),A(93,-150,null),
  A(89,-162,null),A(79,-166,null),A(68,-163,null),A(56,-158,35.2,'library'),A(42,-162,null),A(32,-172,null),A(30,-182,40.8,'b2-east'),A(7,-191.5,null),
  // High timber bridge west-south-west across the gorge (a gentle arc), then the meadow sweep.
  A(-16,-194,43.6,'b2-west'),A(-34,-200,null),A(-50,-197.5,null),A(-64,-192.5,null),A(-80,-193,null),A(-94,-199,null,'clearing'),A(-100,-213,null),
  A(-93,-228,null),A(-78,-235.5,null,'glasshouse'),A(-62,-237,null),A(-47,-232.5,null),A(-30,-224.5,69,'b3-west'),
  // Metal-and-glass bridge in front of the dam, bowed toward town like the dam, then the loop up to Reservoir Heights.
  A(-4,-213,null),A(22,-210.5,71,'b3-east'),A(40,-213,null),A(58,-208.5,null),A(75,-209,null),A(86,-219,null),A(89,-232,null),A(82,-244,null),A(71,-250,null),A(62,-250,88.8,'reservoir'),
  // Alpine bends to the summit.
  A(47,-255,null),A(45,-264,null),A(55,-271,null),A(69,-272.5,null),A(80,-276,96.6,'high-terrace'),A(85,-284,null),A(77,-291.5,null),A(58,-291,null),A(39,-286.5,null),A(25,-290.5,null),A(17,-293.5,104.2,'summit'),
]);
export const ROAD_STEP=1;
const authored=authorCurve(ROAD_WAYPOINTS.map(w=>[w.at[0],w.y,w.at[1]] as Point3),ROAD_STEP,26,true);
export const ROAD_CENTRE:readonly Point3[]=authored.points;
export const ROAD_SAMPLE_STEP=authored.step;
/** Arc length of each waypoint along the centreline. */
export const ROAD_WAY_S:readonly number[]=authored.wayS;
export const roadTagS=(tag:string)=>{const i=ROAD_WAYPOINTS.findIndex(w=>w.tag===tag);if(i<0)throw new Error(`road tag ${tag}`);return ROAD_WAY_S[i]!;};

/** Orchard Lane: leaves the main road above the second hairpin and crosses the lower gorge
 * on the masonry bridge to Orchard Hollow. Narrower than the main road. */
const laneJunction=(()=>{let best=ROAD_CENTRE[0]!,d=Infinity;for(const p of ROAD_CENTRE){const e=Math.hypot(p[0]-19.5,p[2]+95);if(e<d){d=e;best=p;}}return best;})();
export const ORCHARD_LANE_WAYPOINTS:readonly RoadWaypoint[]=[
  W(laneJunction[0],laneJunction[2],laneJunction[1],'junction'),W(13,-101,16.8),W(6,-108,17.6,'b0-east'),W(-18,-115,19.4,'b0-west'),
  W(-34,-117,21.6),W(-48,-114,24),W(-58,-115,26.6),W(-62,-118,27.6,'orchard'),
];
export const ORCHARD_LANE_HALF_WIDTH=3.2;
const lane=authorCurve(ORCHARD_LANE_WAYPOINTS.map(w=>[w.at[0],w.y,w.at[1]] as Point3),ROAD_STEP,16);
export const ORCHARD_LANE_CENTRE:readonly Point3[]=lane.points;
export const ORCHARD_LANE_WAY_S:readonly number[]=lane.wayS;
export const laneTagS=(tag:string)=>{const i=ORCHARD_LANE_WAYPOINTS.findIndex(w=>w.tag===tag);if(i<0)throw new Error(`lane tag ${tag}`);return ORCHARD_LANE_WAY_S[i]!;};
/** Tagged bridge spans (the actual spans grow to the rims where the ground meets the deck). */
export const BRIDGE_TAGS=[
  {id:'b-foot',name:'Harbour bridge',type:'masonry' as const,line:'road' as const,from:'bf-west',to:'bf-east'},
  {id:'b0',name:'Orchard masonry bridge',type:'masonry' as const,line:'lane' as const,from:'b0-east',to:'b0-west'},
  {id:'b2',name:'High woodland bridge',type:'timber' as const,line:'road' as const,from:'b2-east',to:'b2-west'},
  {id:'b3',name:'Dam glass bridge',type:'metal-glass' as const,line:'road' as const,from:'b3-west',to:'b3-east'},
] as const;
