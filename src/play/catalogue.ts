import type {PlayArea,PlayDiscovery,PlayReward} from '../core/playContracts.ts';
export const AREAS:{id:PlayArea;name:string;note:string;glyph:string}[]=[
 {id:'dressing',name:'Dress',note:'A little time in the mirror',glyph:'✧'}, {id:'gallery',name:'Gallery',note:'The household, beautifully framed',glyph:'▧'}, {id:'banks',name:'Kitty Banks',note:'A place for what comes next',glyph:'◒'}, {id:'cabinet',name:'Curiosities',note:'Objects with something up their sleeves',glyph:'✦'}, {id:'window',name:'Window seat',note:'A moment of mischief',glyph:'☼'}, {id:'desk',name:'Our desk',note:'The practical things, together',glyph:'▤'}];
export const REWARDS:{id:PlayReward;name:string;milestone:string;feature:string;icon:string}[]=[
 {id:'camera',name:'The Curator’s Camera',milestone:'Share three distinct looks of your own.',feature:'A timed three-shot portrait booth. Keep a favourite or print the whole contact sheet.',icon:'◉'},
 {id:'theatre',name:'The Velvet Theatre',milestone:'Display four distinct household portraits.',feature:'Direct a miniature outfit revue, complete with curtains, lighting and a finale.',icon:'♜'},
 {id:'key',name:'The Curious Key',milestone:'Discover six of the room’s little secrets.',feature:'A mechanical cabinet with three arrangements to solve and replay.',icon:'⚿'},
 {id:'orrery',name:'The Household Orrery',milestone:'Complete a shared Sitdown.',feature:'Arrange three shared ambitions into an orbiting constellation.',icon:'☉'},
 {id:'lantern',name:'The Celebration Lantern',milestone:'Bring a shared bank to its saved target.',feature:'Compose a room-light celebration and a commemorative portrait.',icon:'✺'},
 {id:'projector',name:'The Keepsake Projector',milestone:'Commemorate a shared goal with a recorded purchase.',feature:'Project a small exhibition with your own caption and shared portraits.',icon:'▣'}];
export const DISCOVERIES:{id:PlayDiscovery;name:string;hint:string;reaction:string;theme?:string}[]=[
 {id:'portrait',name:'A familiar face',hint:'Admire a shared portrait.',reaction:'He knows that pose. Naturally, he does it better.'},
 {id:'drawer',name:'Something in the drawer',hint:'The wardrobe drawer is not quite closed.',reaction:'A tiny toy mouse. He was keeping that for an occasion.'},
 {id:'bell',name:'At your service',hint:'There is a little service bell.',reaction:'One moment. The household manager is arriving.'},
 {id:'mirror',name:'A second opinion',hint:'Wear some glasses and inspect the mirror.',reaction:'A double take. Yes, those are exceptionally good glasses.'},
 {id:'spool',name:'A loose thread',hint:'That spool looks ready to roll.',reaction:'The spool escapes. Hercules has the situation almost under control.'},
 {id:'lamp',name:'Behind the frame',hint:'Try the lamp beside the gallery.',reaction:'A tiny paw-print constellation appears behind the frame.'},
 {id:'latch',name:'The cabinet’s secret',hint:'The brass latch has a little give.',reaction:'A hidden drawer, just large enough for a cat’s important business.',theme:'classic'},
 {id:'tea',name:'Tea for the manager',hint:'Someone has set out a miniature cup.',reaction:'He inspects the tea service. The saucer passes.',theme:'classic'},
 {id:'paper',name:'A folded world',hint:'One paper corner lifts away from the wall.',reaction:'A whole little garden unfolds from a single card.',theme:'taylor'},
 {id:'ribbon',name:'Curtain call',hint:'A ribbon hangs a little lower than the rest.',reaction:'A bow becomes a curtain. His entrance was inevitable.',theme:'taylor'},
 {id:'lighthouse',name:'A light across the room',hint:'The little lighthouse has a turning cap.',reaction:'The beam finds Hercules, who was already striking a pose.',theme:'newfoundland'},
 {id:'boat',name:'Fair weather sailor',hint:'A tiny boat waits by the window.',reaction:'A boat, a breeze, and a captain who prefers to stay indoors.',theme:'newfoundland'}];
export const THEME_COPY={classic:{title:'The little cabinet of wonders',subtitle:'Warm wood, good company, and room for your favourite things.'},taylor:{title:'A world, folded just for us',subtitle:'Paper stages, ribbon curtains, and a cat born for the close-up.'},newfoundland:{title:'The harbour room',subtitle:'A light in the window. A place for every small adventure.'}};
