/**
 * The mountain road alignment: plan waypoints with authored elevations, eased into a
 * continuous centreline, and the bridge spans along it. Uphill from the town foot.
 */
import {authorCurve,type Point3} from './math.ts';
import {islandHeight} from './islandShape.ts';
/** The road foot meets town grade exactly: no step between the mountain road and the town lane. */
const FOOT_Y=islandHeight(20,-46)+.06;

export type RoadWaypoint={at:readonly[number,number];y:number;tag?:string;halfWidth?:number};
const W=(x:number,z:number,y:number,tag?:string,halfWidth?:number):RoadWaypoint=>({at:[x,z],y,...(tag?{tag}:{}),...(halfWidth?{halfWidth}:{})});

/** Uphill. Tags name the features the race, bridges and paths hang from. */
export const ROAD_WAYPOINTS:readonly RoadWaypoint[]=[
  W(20,-46,FOOT_Y,'foot'),
  // Neighbourhood switchbacks: three legs up the lower east slope, hairpins of ~9 unit radius.
  W(23,-55,1.5),W(32,-62,3.1),W(46,-63,5),W(60,-64,6.6,'hairpin-1'),W(69,-69,7.8),W(70,-77,9),W(62,-82,10.2),
  W(48,-82,12),W(34,-82.5,13.6),W(24,-86,14.8,'hairpin-2'),W(19,-93,15.8),W(24,-100,16.8),W(36,-101,18),
  // East flank sweep: past Hearth Terrace and the sunny shelf, round the east arm.
  W(52,-100,19.2,'hearth'),W(68,-103,20.4),W(84,-110,22),W(96,-122,23.8),W(102,-136,25.6,'shelf'),W(104,-150,27.4),
  W(100,-164,29.8),W(86,-166,32),W(72,-162,34.2),W(56,-158,36.2,'library'),W(42,-162,38),W(32,-172,39.8),W(30,-182,41,'b2-east'),
  // High timber bridge west-south-west across the gorge, then the meadow sweep.
  W(-16,-194,44.4,'b2-west'),W(-36,-199,47),W(-58,-200,49.8),W(-80,-196,52.6),W(-98,-202,55,'clearing'),W(-106,-216,57.4),
  W(-98,-230,60),W(-80,-235,62.8,'glasshouse'),W(-58,-232,65.6),W(-40,-228,68),W(-26,-223,69.6,'b3-west'),
  // Metal-and-glass bridge in front of the dam, then the loop up to Reservoir Heights.
  W(24,-211,71.4,'b3-east'),W(44,-208,73.6),W(66,-206,76.2),W(86,-212,79),W(96,-228,82.2),W(90,-244,85.2),W(76,-252,87.8),W(62,-250,89.6,'reservoir'),
  // Alpine bends to the summit.
  W(48,-256,91.4),W(52,-266,93.2),W(66,-272,95.2),W(80,-278,97.4,'high-terrace'),W(74,-288,99.6),W(56,-288,101.6),W(40,-284,103),W(26,-290,104.8),W(14,-298,106.4),W(4,-300,107.2,'summit'),
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
  {id:'b0',name:'Orchard masonry bridge',type:'masonry' as const,line:'lane' as const,from:'b0-east',to:'b0-west'},
  {id:'b2',name:'High woodland bridge',type:'timber' as const,line:'road' as const,from:'b2-east',to:'b2-west'},
  {id:'b3',name:'Dam glass bridge',type:'metal-glass' as const,line:'road' as const,from:'b3-west',to:'b3-east'},
] as const;
