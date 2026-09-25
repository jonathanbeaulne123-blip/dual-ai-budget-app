/**
 * The mountain road alignment: plan waypoints with authored elevations, eased into a
 * continuous centreline, and the bridge spans along it. Uphill from the town foot.
 */
import {authorCurve,type Point3} from './math.ts';
import {islandHeight} from './islandShape.ts';
/** The road foot meets town grade exactly: no step between the mountain road and the town lane. */
const FOOT_Y=islandHeight(-26,-44);

export type RoadWaypoint={at:readonly[number,number];y:number;tag?:string;halfWidth?:number};
const W=(x:number,z:number,y:number,tag?:string,halfWidth?:number):RoadWaypoint=>({at:[x,z],y,...(tag?{tag}:{}),...(halfWidth?{halfWidth}:{})});

/** Uphill. Tags name the features the race, bridges and paths hang from. */
export const ROAD_WAYPOINTS:readonly RoadWaypoint[]=[
  W(-26,-44,FOOT_Y,'foot'),
  // Up the west bank past the Northlight lookout, over the river on the harbour bridge.
  W(-26.6,-48,FOOT_Y+.12),W(-27.4,-53,FOOT_Y+.62),W(-27.6,-58,2.1),W(-25,-66,4),W(-17,-74,5.8,'bf-west'),W(-6,-78,7.3),W(4,-78.5,7.6,'bf-east'),W(15,-74,7.4),W(27,-68,7.3),
  // Neighbourhood switchbacks: three legs up the lower east slope, hairpins of ~9 unit radius.
  W(38,-64,7.3),W(49,-63,7.4),W(60,-64,7.7,'hairpin-1'),W(69,-69,8.5),W(70,-77,9),W(62,-82,10.2),
  W(48,-82,12),W(34,-82.5,13.6),W(24,-86,14.8,'hairpin-2'),W(19,-93,15.8),W(24,-100,16.8),W(36,-101,18),
  // East flank sweep: past Hearth Terrace and the sunny shelf, round the east arm.
  W(52,-100,19.2,'hearth'),W(68,-103,20.4),W(84,-110,22),W(94,-122,23.8),W(99,-136,25.6,'shelf'),W(100,-150,27.4),
  W(96,-163,29.8),W(84,-166,32),W(71,-162,34.2),W(56,-158,36.2,'library'),W(42,-162,38),W(32,-172,39.8),W(30,-182,41,'b2-east'),W(7,-191.5,42.7),
  // High timber bridge west-south-west across the gorge (a gentle arc), then the meadow sweep.
  W(-16,-194,44.4,'b2-west'),W(-36,-196,47),W(-58,-195,49.8),W(-78,-192,52.6),W(-94,-198,55,'clearing'),W(-100,-213,57.4),
  W(-93,-228,60),W(-78,-235.5,62.8,'glasshouse'),W(-60,-234.5,65.6),W(-42,-229,68),W(-26,-223,69.6,'b3-west'),
  // Metal-and-glass bridge in front of the dam, then the loop up to Reservoir Heights.
  W(24,-211,71.4,'b3-east'),W(44,-208,73.6),W(66,-206,76.2),W(84,-213,79),W(93,-228,82.2),W(87,-243,85.2),W(75,-251,87.8),W(62,-250,89.6,'reservoir'),
  // Alpine bends to the summit.
  W(47,-255,91.2),W(45,-264,92.4),W(53,-271,93.8),W(67,-272,95.4),W(79,-275,96.8,'high-terrace'),W(84,-284,98),W(74,-291,99.4),W(57,-289,100.8),W(39,-284,102),W(25,-290,103.4),W(13,-295,104.2,'summit'),
];
export const ROAD_STEP=1;
const authored=authorCurve(ROAD_WAYPOINTS.map(w=>[w.at[0],w.y,w.at[1]] as Point3),ROAD_STEP,26);
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
