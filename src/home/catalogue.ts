/** Original Hearth catalogue. Blueprints are permanent capabilities, never money. */
export type Family = 'starter'|'established'|'reading'|'garden'|'hosting'|'workshop'|'architecture'|'sanctuary'|'gallery';
export type Tool = 'build'|'furnish'|'finish'|'garden';
export type ModuleKind = 'room'|'porch'|'balcony'|'passage'|'bay'|'greenhouse'|'pergola'|'terrace'|'outbuilding';
export type Blueprint = {id:string;name:string;family:Family;kind:ModuleKind;width:number;depth:number;description:string;workspace?:string;upper?:boolean};
export const BLUEPRINTS:readonly Blueprint[] = [
 {id:'cottage',name:'Hearth cottage',family:'starter',kind:'room',width:16,depth:22,description:'A welcoming personal cottage with access to Hearth’s existing workspaces.',workspace:'conversation'},
 {id:'porch',name:'Welcoming porch',family:'starter',kind:'porch',width:6,depth:4,description:'A sheltered threshold with room for a bench.'},
 {id:'passage',name:'Connecting passage',family:'starter',kind:'passage',width:4,depth:4,description:'A generous doorway at each connected end.'},
 {id:'nook',name:'Small reading room',family:'reading',kind:'room',width:6,depth:6,description:'Keep a small home and make one excellent room.',workspace:'books'},
 {id:'library',name:'Library wing',family:'reading',kind:'room',width:10,depth:8,description:'Books and an open reading aisle.',workspace:'books'},
 {id:'kitchen',name:'Kitchen extension',family:'hosting',kind:'room',width:10,depth:8,description:'Preparation counters, seating and your existing kitchen tools.',workspace:'conversation'},
 {id:'bar',name:'Courtyard bar',family:'hosting',kind:'terrace',width:8,depth:6,description:'A counter, display shelves and space on both sides.'},
 {id:'workshop',name:'Pottery workshop',family:'workshop',kind:'room',width:10,depth:8,description:'Accessible working surfaces and a door to the real Pottery Studio.',workspace:'pottery'},
 {id:'gallery',name:'Pottery gallery',family:'gallery',kind:'room',width:8,depth:8,description:'Display instances of your saved originals.',workspace:'pottery'},
 {id:'music',name:'Music room',family:'architecture',kind:'room',width:8,depth:6,description:'An acoustic room to furnish. Instrument performance is a future activity.'},
 {id:'conservatory',name:'Conservatory',family:'sanctuary',kind:'greenhouse',width:10,depth:8,description:'Glazed walls, plant stands and a connection to the existing botanical space.',workspace:'planner'},
 {id:'greenhouse',name:'Garden greenhouse',family:'garden',kind:'greenhouse',width:6,depth:6,description:'A compact glass garden room.'},
 {id:'guest',name:'Guest cottage',family:'sanctuary',kind:'outbuilding',width:10,depth:8,description:'A detached furnished retreat.'},
 {id:'storage',name:'Cycle and vehicle shed',family:'workshop',kind:'outbuilding',width:8,depth:6,description:'Open circulation and storage for the things you ride.'},
 {id:'bay',name:'Bay-window room',family:'architecture',kind:'bay',width:6,depth:4,description:'A bright projecting window nook.'},
 {id:'balcony',name:'Upper balcony',family:'architecture',kind:'balcony',width:6,depth:4,description:'An upstairs entrance and continuous railings.',upper:true},
 {id:'upper',name:'Upper-floor room',family:'architecture',kind:'room',width:8,depth:8,description:'A supported room with a real stair flight.',upper:true},
 {id:'observatory',name:'Observation nook',family:'sanctuary',kind:'room',width:6,depth:6,description:'A rooftop reading and sky-watching space.',upper:true},
 {id:'pergola',name:'Garden pergola',family:'garden',kind:'pergola',width:8,depth:6,description:'Timber shade for a table and climbing plants.'},
 {id:'terrace',name:'Garden terrace',family:'starter',kind:'terrace',width:8,depth:6,description:'A level outdoor room, ready for planting and company.'},
];
export type Furniture = {id:string;name:string;family:Family;tool:'furnish'|'garden';shape:'seat'|'table'|'bed'|'shelf'|'cabinet'|'rug'|'lamp'|'curtain'|'books'|'plant'|'art'|'display'|'counter'|'fence'|'gate'|'path'|'partition';width:number;depth:number;height:number;surface?:boolean;wall?:boolean};
const item=(id:string,name:string,shape:Furniture['shape'],w:number,d:number,h:number,family:Family='starter',extra:Partial<Furniture>={}):Furniture=>({id,name,shape,width:w,depth:d,height:h,family,tool:'furnish',...extra});
export const FURNITURE:readonly Furniture[]=[
 item('armchair','Linen armchair','seat',1,1,1),item('sofa','Gathering sofa','seat',2.4,1,1),item('bench','Entry bench','seat',1.8,.65,.8),item('stool','Workshop stool','seat',.6,.6,.8,'workshop'),
 item('coffee-table','Coffee table','table',1.4,.8,.5,'starter',{surface:true}),item('dining-table','Family dining table','table',2.4,1.2,.8,'hosting',{surface:true}),item('desk','Reading desk','table',1.6,.8,.8,'reading',{surface:true}),item('workbench','Potter’s workbench','table',2.4,1,.9,'workshop',{surface:true}),
 item('single-bed','Guest bed','bed',1.2,2.2,.6),item('double-bed','Linen double bed','bed',1.8,2.2,.65,'sanctuary'),
 item('bookshelf','Open bookcase','shelf',1.6,.45,2,'reading',{surface:true}),item('display-shelf','Pottery shelf','shelf',1.8,.5,1.6,'gallery',{surface:true}),item('cabinet','Painted cabinet','cabinet',1.6,.6,1.1,'established',{surface:true}),
 item('woven-rug','Woven rug','rug',2.4,1.8,.02),item('runner','Entry runner','rug',1,3,.02),item('lamp','Reading lamp','lamp',.45,.45,1.6),item('pendant','Pendant lamp','lamp',.7,.7,2,'hosting'),
 item('curtains','Linen curtains','curtain',1.6,.15,2,'established',{wall:true}),item('book-stack','Favourite books','books',.4,.3,.3,'reading'),item('fern','Potted fern','plant',.6,.6,.8),item('flowers','Seasonal flowers','plant',.6,.6,.65,'established'),
 item('wall-art','Original coastal print','art',1.2,.12,.9,'established',{wall:true}),item('pedestal','Gallery pedestal','display',.65,.65,1,'gallery',{surface:true}),item('album','Keepsake album','books',.5,.4,.15,'reading'),
 item('counter','Preparation counter','counter',2,.7,1,'hosting',{surface:true}),item('partition','Timber partition','partition',2,.18,2.2,'architecture'),
 item('raised-bed','Planting bed','plant',2,1.2,.5,'starter',{tool:'garden'}),item('garden-path','Stone path','path',2,2,.04,'starter',{tool:'garden'}),item('garden-fence','Garden fence','fence',2,.15,1,'garden',{tool:'garden'}),item('garden-gate','Garden gate','gate',1.6,.15,1,'garden',{tool:'garden'}),
 item('garden-bench','Garden bench','seat',1.8,.65,.8,'starter',{tool:'garden'}),item('lantern','Garden lantern','lamp',.35,.35,1.1,'garden',{tool:'garden'}),item('plant-stand','Botanical stand','shelf',1.6,.7,1,'garden',{tool:'garden',surface:true}),item('garden-display','Garden display plinth','display',.8,.8,.9,'gallery',{tool:'garden',surface:true}),
];
export const FINISHES=[
 {id:'hearth',name:'Warm Hearth',family:'starter',wall:'#e7d3b0',trim:'#faf1dc',roof:'#765b51',floor:'#aa8054',fabric:'#62817a'},
 {id:'coastal',name:'Salt and sea glass',family:'starter',wall:'#9bbebc',trim:'#faf5e4',roof:'#536975',floor:'#ae9d7d',fabric:'#e0c389'},
 {id:'rose',name:'Scrapbook rose',family:'established',wall:'#dcaeaa',trim:'#fff2db',roof:'#836676',floor:'#b28969',fabric:'#b089ac'},
 {id:'jellybean',name:'Jellybean harbour',family:'established',wall:'#b74e43',trim:'#fff1d0',roof:'#394f62',floor:'#a1744b',fabric:'#dcba52'},
 {id:'oak',name:'Library oak',family:'reading',wall:'#b8b093',trim:'#614a37',roof:'#505c57',floor:'#81613d',fabric:'#839080'},
 {id:'clay',name:'Clay and limestone',family:'workshop',wall:'#d9b597',trim:'#ede5d6',roof:'#855d51',floor:'#b9a58a',fabric:'#b67654'},
 {id:'botanical',name:'Botanical glass',family:'sanctuary',wall:'#b1cbb8',trim:'#496857',roof:'#7faaa7',floor:'#a9a491',fabric:'#91a479'},
] as const;
export const ROOFS=['gable','hip','flat','glass'] as const;
export const ARRANGEMENTS=[
 {id:'reading',name:'A quiet reading corner',items:['armchair','desk','bookshelf','lamp','woven-rug']},
 {id:'welcome',name:'A welcoming entry',items:['bench','coffee-table','fern','runner']},
 {id:'hosting',name:'Around the table',items:['dining-table','sofa','counter','cabinet']},
 {id:'making',name:'A place to make',items:['workbench','stool','display-shelf','pedestal']},
 {id:'garden',name:'Evening in the garden',items:['garden-bench','raised-bed','lantern','plant-stand']},
] as const;
export const blueprint=(id:string)=>BLUEPRINTS.find(row=>row.id===id)!;
export const furnishing=(id:string)=>FURNITURE.find(row=>row.id===id)!;
