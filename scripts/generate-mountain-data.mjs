import {createServer} from 'vite';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
process.env.HEARTH_REBAKE='1';
const root=process.cwd(),out=resolve(root,'src/harbour/mountain/generated');
const server=await createServer({root,configFile:false,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}});
try {
  const base=await server.ssrLoadModule('/src/harbour/mountain/terrainBase.ts');
  const ground=await server.ssrLoadModule('/src/harbour/mountain/mountainGround.ts');
  const map=await server.ssrLoadModule('/src/harbour/mountain/mapBuild.ts');
  const places=await server.ssrLoadModule('/src/harbour/mountain/places.ts');
  await mkdir(out,{recursive:true});
  const pack=g=>({...g,data:Buffer.from(g.data.buffer,g.data.byteOffset,g.data.byteLength).toString('base64')});
  const payload={revision:places.GEOGRAPHY_REVISION,base:pack(base.BASE_GRID),ground:pack(ground.GROUND_GRID),conflicts:ground.GROUND_CONFLICTS,conflictCells:ground.GROUND_CONFLICT_CELLS};
  for(const [name,value] of [['terrain.json',payload],['map.json',map.mountainMap()]]){const target=resolve(out,name),text=JSON.stringify(value);if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==text)throw new Error(`Stale generated mountain data: ${name}`);}else await writeFile(target,text);}
  console.log('Generated exact terrain and map',payload.revision,base.BASE_GRID.data.length,ground.GROUND_GRID.data.length);
} finally {await server.close();}
