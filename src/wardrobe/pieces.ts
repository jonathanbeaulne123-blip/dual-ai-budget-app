/** Original garment recipes shared by the exporter, 3D scene and ink figure. */
export const COLLECTIONS = [
  {id:'cozy',name:'Cozy at home',note:'Soft knits. A quiet afternoon. Entirely overdressed for it.'},
  {id:'office',name:'Tiny office manager',note:'He has reviewed the agenda. There will be a tea break.'},
  {id:'rain',name:'Newfoundland rain',note:'A little weather is no reason to abandon a good outfit.'},
  {id:'applause',name:'Dressing for applause',note:'The occasion? His arrival, naturally.'},
  {id:'kitchen',name:'Kitchen royalty',note:'An apron on, a whisk nearby, and absolutely no washing up.'},
  {id:'sunday',name:'Sunday best',note:'Careful stitching and nowhere in particular to hurry.'},
] as const;
export type PieceSlot='head'|'eyewear'|'neckwear'|'body'|'outerwear'|'charm';
export type Piece={id:string;collection:string;slot:PieceSlot;name:string;shape:string;detail:string;variants:readonly string[];coversBody?:boolean;legacy?:boolean};
const fabric=['cream','moss','rose','slate'],office=['ink','oat','claret','sage'],rain=['yellow','navy','seafoam','coral'],applause=['plum','midnight','ruby','ivory'],kitchen=['ivory','sage','terracotta','blue'],sunday=['oat','claret','sage','midnight'],metal=['silver','brass','rose-gold'];
const rows: [string,string,PieceSlot,string,string,string,readonly string[],boolean?][]=[
 ['cozy-sweater','cozy','body','Cable-knit sweater','cable','Raised cables · fitted sleeves',fabric],
 ['cozy-cardigan','cozy','body','Cardigan','cardigan','Open V · pearl buttons · patch pockets',fabric],
 ['cozy-toque','cozy','head','Pom-pom toque','toque','Ribbed brim · softly rounded crown',fabric],
 ['cozy-scarf','cozy','neckwear','Soft scarf','scarf','Wrapped knit · fringed ends',fabric],
 ['cozy-glasses','cozy','eyewear','Round reading glasses','round','Fine metal rims · open temples',metal],
 ['cozy-teacup','cozy','charm','Teacup charm','teacup','A little cup on a fine chain',metal],
 ['office-waistcoat','office','body','Waistcoat','waistcoat','Pointed hem · three buttons',office],
 ['office-jacket','office','outerwear','Pinstripe jacket','pinstripe','Notched lapels · fine chalk stripes',office,true],
 ['office-visor','office','head','Green visor','visor','Open crown · curved shade',office],
 ['office-glasses','office','eyewear','Rectangular glasses','rectangle','Squared frames · rounded corners',metal],
 ['office-tie','office','neckwear','Silk tie','tie','A small knot · tapered blade',office],
 ['office-watch','office','charm','Pocket-watch charm','watch','Raised bezel · hands at teatime',metal],
 ['rain-coat','rain','outerwear','Yellow raincoat','raincoat','Storm flap · double pockets · long hem',rain,true],
 ['rain-souwester','rain','head','Sou’wester','souwester','Wide weather brim · low crown',rain],
 ['rain-sweater','rain','body','Fisherman’s sweater','fisherman','Textured yoke · horizontal knit bands',rain],
 ['rain-cap','rain','head','Knitted watch cap','watchcap','Close knit · deep folded brim',rain],
 ['rain-neckerchief','rain','neckwear','Nautical neckerchief','neckerchief','Triangular fold · sailor stripe',rain],
 ['rain-puffin','rain','charm','Puffin charm','puffin','Rounded wings · proud little beak',metal],
 ['applause-cape','applause','outerwear','Velvet cape','cape','Draped folds · scalloped hem · clasp',applause],
 ['applause-jacket','applause','outerwear','Sequin jacket','sequin','Raised sequins · cropped evening cut',applause,true],
 ['applause-crown','applause','head','Miniature crown','crown','Five points · inset stones',metal],
 ['applause-glasses','applause','eyewear','Star glasses','star','Five-point frames · a theatrical flourish',metal],
 ['applause-bow','applause','neckwear','Satin bow','bow','Sculpted loops · ribbon tails',applause],
 ['applause-star','applause','charm','Star pendant','starpendant','A polished star on a fine chain',metal],
 ['kitchen-tunic','kitchen','body','Chef tunic','tunic','Double-breasted front · piping',kitchen],
 ['kitchen-apron','kitchen','outerwear','Apron','apron','Bib · waist ties · generous front pocket',kitchen],
 ['kitchen-hat','kitchen','head','Tall chef hat','chef','Pleated band · cloud-shaped crown',kitchen],
 ['kitchen-cap','kitchen','head','Baker’s cap','bakercap','Soft gathered crown · narrow band',kitchen],
 ['kitchen-neckerchief','kitchen','neckwear','Gingham neckerchief','gingham','Woven checks · neatly tied ends',kitchen],
 ['kitchen-whisk','kitchen','charm','Whisk charm','whisk','Wire loops · tiny handle',metal],
 ['sunday-coat','sunday','outerwear','Tailored coat','tailcoat','Long split tails · rolled lapels',sunday,true],
 ['sunday-vest','sunday','body','Embroidered vest','vest','Leaf embroidery · scalloped edging',sunday],
 ['sunday-beret','sunday','head','Beret','beret','Tilted crown · small stem',sunday],
 ['sunday-glasses','sunday','eyewear','Oval glasses','oval','Elongated rims · delicate bridge',metal],
 ['sunday-collar','sunday','neckwear','Ribbon collar','ribbon','A narrow ribbon with a rosette',sunday],
 ['sunday-cameo','sunday','charm','Cameo charm','cameo','Oval setting · raised cat silhouette',metal],
];
export const NEW_PIECES:Piece[]=rows.map(([id,collection,slot,name,shape,detail,variants,coversBody])=>({id,collection,slot,name,shape,detail,variants,coversBody}));
const legacy:[string,PieceSlot,string,string][]=[['toque','head','Kitchen toque','toque'],['visor','head','Bill visor','visor'],['chef','head','Sit-down chef hat','chef'],['specs','eyewear','Audit spectacles','round'],['copper','charm','Copper chain','chain'],['gold','charm','Gold chain','chain'],['bell','neckwear','Collar bell','bell'],['yarn','neckwear','Yarn collar','yarn'],['fish','charm','Fish treat','fish'],['clip','charm','Card clip','clip'],['tooth','charm','Tooth charm','tooth'],['ink','charm','Green-ink stamp','stamp']];
export const LEGACY_PIECES:Piece[]=legacy.map(([id,slot,name,shape])=>({id,collection:'legacy',slot,name,shape,detail:'From the original wardrobe · always available',variants:['legacy-original'],legacy:true}));
export const PIECES=[...NEW_PIECES,...LEGACY_PIECES];
