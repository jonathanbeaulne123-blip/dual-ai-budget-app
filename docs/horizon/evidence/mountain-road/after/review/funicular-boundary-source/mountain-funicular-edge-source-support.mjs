// Root-only small query diagnostic; uses the exact already saved v12 bundle.
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';
const ROOT=resolve(process.argv[2]),OUT=resolve(process.argv[3]);mkdirSync(OUT);process.chdir(ROOT);
const api=await import('file:///tmp/mountain-funicular-foot-candidate-proof-v12/runtime-bundle.mjs'),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),world=api.parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))),field=api.decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')),'full'),cuts={...structuredClone(world.collision),solids:structuredClone(world.geometry.solids),diagnostics:[]};
const region=api.createRegionGeography({horizonGround:(x,z)=>api.sampleTerrain(field,x,z),yield:api.terraceBedExclusion(cuts.beds),exclude:api.mouthExclusion(cuts.mouths)}),geo=api.createHorizonGeography(field,cuts);geo.addDynamic(region.provider);
const edges=JSON.parse(readFileSync('/tmp/mountain-funicular-v12-boundary-hosts.json'));
const seen=new Set(),rows=[];
for(const w of edges){const key=JSON.stringify(w.edge);if(seen.has(key))continue;seen.add(key);
 const [a,b]=w.edge;const points=[0,.2,.4,.6,.8,1].map(t=>a.map((v,i)=>v+(b[i]-v)*t));
 rows.push({edge:w.edge,points:points.map(p=>{const[x,y,z]=p;return{p,ground:region.provider.ground(x,z),before:geo.surface(x,z,y,.5),beforeContact:geo.contact(x,z,geo.surface(x,z,y,.5)?.y??y,.3)};})});
}
writeFileSync(OUT+'/edge-source-support.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
