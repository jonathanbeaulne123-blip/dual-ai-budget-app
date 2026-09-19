import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function selectIOSSimulator(inventory) {
  const choices=Object.entries(inventory.devices??{}).flatMap(([runtime,devices])=>{
    const match=/^com\.apple\.CoreSimulator\.SimRuntime\.iOS-(\d+)-(\d+)(?:-(\d+))?$/.exec(runtime);
    if(!match || Number(match[1])<26 || !Array.isArray(devices)) return [];
    return devices.filter(device=>device.isAvailable===true && /^iPhone\b/.test(device.name) && /^[a-f0-9-]{36}$/i.test(device.udid)).map(device=>({
      ...device,version:Number(match[1])*10000+Number(match[2])*100+Number(match[3]??0),runtime,
    }));
  }).sort((a,b)=>b.version-a.version || a.name.localeCompare(b.name) || a.udid.localeCompare(b.udid));
  if(!choices.length) throw Error('No available iPhone simulator running iOS 26 or newer. Install one; native tests cannot be skipped.');
  return choices[0].udid;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const output=spawnSync('xcrun',['simctl','list','devices','available','--json'],{encoding:'utf8'});
  if(output.status!==0) throw Error(output.stderr||'The iOS simulator SDK is unavailable.');
  console.log(selectIOSSimulator(JSON.parse(output.stdout)));
}
