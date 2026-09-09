import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
const route=process.argv[2]||'home',folder='.artifacts/page-worlds/'+route;
const {records}=JSON.parse(await readFile(folder+'/report.json','utf8'));
const images=[];for(let i=0;i<records.length;i++) {const r=records[i];const left=(i%3)*300,top=Math.floor(i/3)*805;images.push({input:await sharp(folder+'/'+r.theme+'-'+r.scope+'-390.png').resize({width:300,height:769,fit:'contain',background:'#fffaf0'}).toBuffer(),left,top:top+36});images.push({input:Buffer.from('<svg width="300" height="36"><rect width="300" height="36" fill="#fffaf0"/><text x="12" y="24" font-family="sans-serif" font-size="15" fill="#302820">'+r.theme+' · '+r.scope+'</text></svg>'),left,top});}
await mkdir('docs/ux/page-worlds',{recursive:true});await sharp({create:{width:900,height:Math.ceil(records.length/3)*805,channels:3,background:'#fffaf0'}}).composite(images).png().toFile('docs/ux/page-worlds/'+route+'.png');
