import type {Pose} from '../scene/place.ts';
/** Authored viewpoints shared by the ordinary guide and fictional rehearsal. */
export const MOUNTAIN_TOUR = [
  {id:'arrival',title:'A neighbourhood above the harbour',words:'Follow the river uphill: homes, gardens and the shared Fund all belong to the same place.',pose:{target:[0,43,-112],r:350,theta:.08,phi:1.08}},
  {id:'water',title:'What the water means',words:'The basin shows accepted operating money. Kitty reserves occupy their own chamber. Open the Fund to review a contribution; only confirmation changes accepted water.',pose:{target:[25,81,-239],r:62,theta:.04,phi:1.28}},
  {id:'library',title:'A working destination',words:'The Library keeps its existing books. Open it, use a tool, and return to the same neighbourhood.',pose:{target:[99,54,-174],r:36,theta:.4,phi:1.14}},
  {id:'garden',title:'The same garden through time',words:'Shared work supports growth. Verified sustained deficits can affect peripheral details. Missing evidence freezes the picture; roads and homes remain usable.',pose:{target:[-102,67,-213],r:45,theta:-.18,phi:1.16}},
  {id:'summit',title:'Summit to sea',words:'Start the downhill course when you are ready. The broad road is the main line; the architecture offers optional skill branches.',pose:{target:[5,110,-279],r:45,theta:Math.PI,phi:1.2}},
  {id:'finish',title:'Back to the town square',words:'The waterfront gives you room to stop. Your financial tools are always available, without finishing a race.',pose:{target:[5,1,30],r:62,theta:.15,phi:.95}},
] as const satisfies readonly {id:string;title:string;words:string;pose:Pose}[];
export type MountainTourId=typeof MOUNTAIN_TOUR[number]['id'];
