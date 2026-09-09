import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
const route=process.argv[2]||'home',folder=process.env.HEARTH_ARTIFACTS_DIR||'.artifacts/page-worlds/'+route;
const {records}=JSON.parse(await readFile(folder+'/report.json','utf8'));
const desktop=process.argv.includes('--desktop'),fullMobile=process.argv.includes('--full-mobile'),cell=desktop?400:300,height=desktop?900:fullMobile?1800:769;
if(desktop)records.sort((a,b)=>a.scope.localeCompare(b.scope)||["classic","taylor","newfoundland"].indexOf(a.theme)-["classic","taylor","newfoundland"].indexOf(b.theme));
const images=[];for(let i=0;i<records.length;i++) {const r=records[i];const left=(i%3)*cell,top=Math.floor(i/3)*(height+36);images.push({input:await sharp(folder+'/'+r.theme+'-'+r.scope+(desktop?'-desktop-full.png':fullMobile?'-mobile-full.png':'-390.png')).resize({width:cell,height,fit:'contain',position:desktop?'top':'centre',background:'#fffaf0'}).toBuffer(),left,top:top+36});images.push({input:Buffer.from('<svg width="'+cell+'" height="36"><rect width="'+cell+'" height="36" fill="#fffaf0"/><text x="12" y="24" font-family="sans-serif" font-size="15" fill="#302820">'+r.theme+' · '+r.scope+'</text></svg>'),left,top});}
await mkdir('docs/ux/page-worlds',{recursive:true});await sharp({create:{width:cell*3,height:Math.ceil(records.length/3)*(height+36),channels:3,background:'#fffaf0'}}).composite(images).png().toFile('docs/ux/page-worlds/'+route+(desktop?'-desktop':fullMobile?'-mobile-full':'')+'.png');
