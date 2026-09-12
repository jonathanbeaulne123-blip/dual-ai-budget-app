// Run only after verifying the dedicated Hearth project's Free tier in AI Studio.
// The key is read without echo and passed to Wrangler over stdin, never argv/files.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if (!process.stdin.isTTY) throw Error('Use an interactive terminal so the key is not echoed.');
process.stdout.write('Paste the dedicated Hearth free API key, then Return (input hidden): ');
process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
let secret='';
const key=await new Promise((resolveKey,reject)=>{
  const read=chunk=>{
    if(chunk.includes('\u0003')){process.stdin.off('data',read);reject(Error('Cancelled'));return;}
    secret+=chunk;
    if(/[\r\n]/.test(secret)){process.stdin.off('data',read);resolveKey(secret.trim());}
  };
  process.stdin.on('data',read);
}).finally(()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');});
if(!/^[A-Za-z0-9_.-]{30,200}$/.test(key))throw Error('Invalid API-key format; nothing saved.');
const verifiedAt=new Date().toISOString();
if(Date.now()>Date.parse('2026-09-30T00:00:00Z'))throw Error('Reverify the project and its limits before provisioning.');
const quotas={version:1,projectId:'hearth-506304',tier:'free',exclusive:true,keySha256:createHash('sha256').update(key).digest('hex'),verifiedAt,expiresAt:'2026-09-30T00:00:00Z',models:{
  'gemini-3.1-flash-lite':{rpm:15,tpm:250000,rpd:500,usedOnVerificationDay:0},
  'gemini-3.8-flash':{rpm:5,tpm:250000,rpd:20,usedOnVerificationDay:0},
}};
const child=spawn(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),'secret','bulk'],{cwd:root,stdio:['pipe','inherit','inherit']});
child.stdin.end(JSON.stringify({HERCULES_GEMINI_FREE_KEY:key,HERCULES_GEMINI_FREE_QUOTAS:JSON.stringify(quotas)}));
const code=await new Promise((resolveCode,reject)=>{child.once('error',reject);child.once('close',resolveCode);});
if(code!==0)throw Error('Wrangler did not confirm storage. Retry the setup; do not paste the key into chat.');
console.log('Hearth free-project key and quota configuration stored. Key value was not printed or written to a local file.');
