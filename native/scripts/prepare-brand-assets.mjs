import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Reuse the authored Hearth identity. No generated household content or remote assets.
const native=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(native,'..');
const source=await readFile(resolve(root,'public/hercules-mark.svg'),'utf8');
const mark=source.replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/,'').replace(/<!--.*?-->/sg,'').replaceAll('currentColor','#342b25').replaceAll('var(--herc-coat, #fdfbf6)','#fdfbf6').replace(/[ \t]+$/gm,'');
const background='#f3ead8';
function svg(width,height,size,fill=true){return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>Hearth</title>${fill?`<rect width="${width}" height="${height}" fill="${background}"/>`:''}<svg x="${(width-size)/2}" y="${(height-size)/2}" width="${size}" height="${size}" viewBox="0 0 64 64">${mark}</svg></svg>\n`;}
await mkdir(resolve(native,'assets'),{recursive:true});
await writeFile(resolve(native,'assets/hearth-app-icon.svg'),svg(1024,1024,704));
await writeFile(resolve(native,'assets/hearth-splash.svg'),svg(2732,2732,384));
async function files(path){const entries=await readdir(path,{withFileTypes:true});return(await Promise.all(entries.map(entry=>entry.isDirectory()?files(resolve(path,entry.name)):[resolve(path,entry.name)]))).flat();}
const candidates=[...await files(resolve(native,'ios/App/App/Assets.xcassets')),...await files(resolve(native,'android/app/src/main/res'))].filter(path=>/\/(?:AppIcon-512@2x|splash[^/]*|ic_launcher(?:_foreground|_round)?)\.png$/.test(path));
const manifest=[];
for(const path of candidates){
 const {width,height}=await sharp(path).metadata();if(!width||!height)throw Error('Missing image dimensions: '+relative(native,path));
 const foreground=path.endsWith('ic_launcher_foreground.png'),splash=/\/splash[^/]*\.png$/.test(path),size=Math.round(Math.min(width,height)*(splash?.14:foreground?.63:.6875));
 let image=sharp(Buffer.from(svg(width,height,size,!foreground)));
 if(path.endsWith('ic_launcher_round.png'))image=image.composite([{input:Buffer.from(`<svg width="${width}" height="${height}"><circle cx="${width/2}" cy="${height/2}" r="${Math.min(width,height)/2}" fill="#fff"/></svg>`),blend:'dest-in'}]);
 if(path.includes('/ios/')&&!splash)image=image.removeAlpha();
 await image.png().toFile(path+'.new');const bytes=await readFile(path+'.new');await writeFile(path,bytes);await (await import('node:fs/promises')).unlink(path+'.new');
 manifest.push({path:relative(native,path),width,height,kind:splash?'launch':foreground?'adaptive foreground':'launcher'});
}
await writeFile(resolve(native,'assets/manifest.json'),JSON.stringify({source:'public/hercules-mark.svg',background,generatedBy:'native/scripts/prepare-brand-assets.mjs',files:manifest},null,2)+'\n');
console.log(`Prepared ${manifest.length} native assets from the existing Hearth mark.`);
