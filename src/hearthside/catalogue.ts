import type { HearthsideRoom } from './contracts.ts';
export const ROOMS: Record<HearthsideRoom, {name:string; invitation:string; object:string}> = {
  common:{name:'Common room',invitation:'A little space for us.',object:'Our table'},
  studio:{name:'Studio',invitation:'Make something only we could make.',object:'The making table'},
  conservatory:{name:'Conservatory',invitation:'Leave room for what might be.',object:'Our possibilities'},
  theatre:{name:'Theatre',invitation:'Keep the parts we want to remember.',object:'Our story'},
};
export const JOURNEYS = [
  {id:'make-happen',label:'Make something happen',room:'conservatory',prompt:'Something we would love to do'},
  {id:'leave-something',label:'Leave something for you',room:'common',prompt:'A little note for you'},
  {id:'make-together',label:'Make something together',room:'studio',prompt:'Something made by both of us'},
  {id:'little-time',label:'A little time together',room:'common',prompt:'An evening that feels like us'},
  {id:'care-for-life',label:'Care for our everyday life',room:'common',prompt:'Something practical we can make easier'},
  {id:'remember',label:'Remember something',room:'theatre',prompt:'An ordinary day worth keeping'},
] as const;
export const WORLD_MATERIALS = {
  classic:{wall:'#eee1c9',wood:'#775440',light:'#ffe9b0',cloth:'#f8f0df',garden:'#728774',ink:'#362d2a'},
  taylor:{wall:'#f6dcdf',wood:'#956372',light:'#ffda97',cloth:'#fff1ed',garden:'#a1b5a1',ink:'#472d43'},
  newfoundland:{wall:'#d7e5df',wood:'#546f74',light:'#fff2cf',cloth:'#f5ead5',garden:'#68837a',ink:'#233b45'},
};
