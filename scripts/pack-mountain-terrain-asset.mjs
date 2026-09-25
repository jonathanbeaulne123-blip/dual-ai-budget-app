import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=process.cwd();
const source=JSON.parse(await readFile(resolve(root,'src/harbour/mountain/generated/terrain.json'),'utf8'));
const revision=source.revision;
if(!/^hearth-mountain-geo-[0-9]+$/.test(revision))throw new Error('Invalid terrain geography revision');
const base=Buffer.from(source.base.data,'base64');
const ground=Buffer.from(source.ground.data,'base64');
const gridMeta=({data,...meta})=>meta;
for(const [name,grid,bytes] of [['base',source.base,base],['ground',source.ground,ground]]){
  if(bytes.byteLength!==grid.cols*grid.rows*4)throw new Error(`Invalid ${name} grid bytes`);
}
const header=Buffer.from(JSON.stringify({revision,base:gridMeta(source.base),ground:gridMeta(source.ground),conflicts:source.conflicts,conflictCells:source.conflictCells}));
const length=Buffer.alloc(4);length.writeUInt32LE(header.byteLength);
const asset=Buffer.concat([length,header,base,ground]);
if(asset.byteLength>2_500_000)throw new Error('Mountain terrain exceeds the 2.5 MB budget');
const target=resolve(root,'public/mountain/terrain',`${revision}.bin`);
if(process.argv.includes('--check')){
  const existing=await readFile(target);
  if(!existing.equals(asset))throw new Error(`Stale mountain terrain asset: ${target}`);
}else{
  await mkdir(resolve(root,'public/mountain/terrain'),{recursive:true});
  await writeFile(target,asset);
}
console.log(`${revision}: ${asset.byteLength} bytes`);
