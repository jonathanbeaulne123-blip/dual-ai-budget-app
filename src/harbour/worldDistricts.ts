/** Lightweight location labels shared with the flat Desk. No terrain imports. */
export type WorldPoint3 = readonly [number, number, number];
export type Biome = 'garden' | 'orchard' | 'woods' | 'meadow' | 'alpine' | 'summit';
export type District = { id: string; name: string; at: WorldPoint3; radius: number; biome: Biome; destination: string; words: string };

/** Uphill order; coordinates are the existing Mountain v2 centres. */
export const DISTRICTS: readonly District[] = [
  {id:'hearth',name:'Hearth Terrace',at:[56,19.2,-114],radius:14,biome:'garden',destination:'kitchen',words:'A sheltered front garden above the harbour. Come home by the long way.'},
  {id:'orchard',name:'Orchard Hollow',at:[-68,28,-124],radius:18,biome:'orchard',destination:'cottage',words:'Apple blossom, clover and a sunny doorstep for Hercules, tucked into a hollow.'},
  {id:'library',name:'Library Woods',at:[48,35,-176],radius:14,biome:'woods',destination:'library',words:'A reading courtyard among the birches, with a balcony over the gorge.'},
  {id:'glasshouse',name:'Glasshouse Meadows',at:[-72,62,-214],radius:20,biome:'meadow',destination:'glasshouse',words:'Broad flowering terraces. Plans take root beside the water.'},
  {id:'reservoir',name:'Reservoir Heights',at:[54,90,-244],radius:15,biome:'alpine',destination:'loft-banks',words:'Exposed stone beside the glass dam, which holds a visible picture of the shared Fund.'},
  {id:'summit',name:'Summit Commons',at:[2,104,-294],radius:15,biome:'summit',destination:'journey',words:'A windswept crown. The whole neighbourhood below, and a new way down ahead.'},
];
