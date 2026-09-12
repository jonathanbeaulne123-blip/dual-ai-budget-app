import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function verifyPackagedWeb(repository, platform) {
  if (!['ios','android'].includes(platform)) throw Error('Choose ios or android.');
  const source=resolve(repository,'dist');
  const target=resolve(repository,platform==='ios'?'native/ios/App/App/public':'native/android/app/src/main/assets/public');
  const html=await readFile(resolve(source,'index.html'),'utf8');
  if(!html.includes('<html') || !html.includes('id="root"') || !/<script\b[^>]*\bsrc=["'][^"']+\.js/.test(html)) throw Error('The shared React build is missing.');
  const entries=[];
  async function walk(directory, found) {
    for(const entry of await readdir(directory,{withFileTypes:true})) {
      const file=resolve(directory,entry.name);
      if(entry.isSymbolicLink()) throw Error('Built assets must not follow symlinks.');
      if(entry.isDirectory()) await walk(file, found);
      else if(entry.isFile()) found.push(file);
    }
  }
  await walk(source, entries);
  if(entries.length<2) throw Error('The shared React build has no asset files.');
  const digest=createHash('sha256');
  for(const file of entries.sort()) {
    const key=relative(source,file), original=await readFile(file), packaged=await readFile(resolve(target,key));
    if(!original.equals(packaged)) throw Error(`Native web asset differs from the shared build: ${key}`);
    digest.update(key.split(sep).join('/')).update('\0').update(original).update('\0');
  }
  const originals=new Set(entries.map(file=>relative(source,file))), copied=[];
  await walk(target,copied);
  for(const file of copied) {
    const key=relative(target,file);
    if(originals.has(key)) continue;
    // Capacitor writes two empty shims when this workspace has no Cordova plugins.
    if(['cordova.js','cordova_plugins.js'].includes(key) && (await readFile(file)).length===0) continue;
    throw Error(`Unreviewed file in native web assets: ${key}`);
  }
  return {platform,files:entries.length,sha256:digest.digest('hex')};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
  console.log(JSON.stringify(await verifyPackagedWeb(root,process.argv[2])));
}
