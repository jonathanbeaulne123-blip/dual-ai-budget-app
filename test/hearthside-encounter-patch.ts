import {readFile} from 'node:fs/promises';
import type {Plugin} from 'esbuild';
/** Apply the exact returned integration patch in memory; shared writer files stay untouched. */
export function encounterPatchPlugin():Plugin{return{name:'encounter-vault-integration',setup(builder){builder.onLoad({filter:/workers\/hearthsideVault(?:Archive)?\.ts$/},async args=>{
  const path=args.path.split('/').slice(-2).join('/'),patch=await readFile('workers/hearthsideVaultEncounters.integration.patch','utf8');
  const lines=patch.split('\n'),header=lines.indexOf(`--- a/${path}`);if(header<0)return;const source=(await readFile(args.path,'utf8')).split('\n'),out:string[]=[];let at=0;
  for(let i=header+2;i<lines.length&&!lines[i]!.startsWith('--- a/');){const line=lines[i]!;if(!line.startsWith('@@')){i++;continue;}
    const start=Number(line.match(/^@@ -(\d+)/)![1])-1;out.push(...source.slice(at,start));at=start;i++;
    while(i<lines.length&&!lines[i]!.startsWith('@@')&&!lines[i]!.startsWith('--- a/')){const h=lines[i++]!;if(h.startsWith(' ')){if(source[at]!==h.slice(1))throw Error('Integration patch context changed');out.push(source[at++]!);}else if(h.startsWith('-')){if(source[at]!==h.slice(1))throw Error('Integration patch deletion changed');at++;}else if(h.startsWith('+'))out.push(h.slice(1));}
  }out.push(...source.slice(at));return{contents:out.join('\n'),loader:'ts',resolveDir:args.path.slice(0,args.path.lastIndexOf('/'))};
});}};}
