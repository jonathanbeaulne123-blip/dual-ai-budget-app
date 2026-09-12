import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyPackagedWeb} from '../scripts/check-packaged-web.mjs';
import {selectIOSSimulator} from '../scripts/select-ios-simulator.mjs';

async function fixture(run) {
 const root=await mkdtemp(join(tmpdir(),'hearth-native-assets-'));
 try {
  for(const dir of ['dist','native/ios/App/App/public','native/android/app/src/main/assets/public']) {
   await mkdir(join(root,dir,'assets'),{recursive:true});
   await writeFile(join(root,dir,'index.html'),'<html><body><div id="root"></div><script type="module" src="/assets/actual.js"></script></body></html>');
   await writeFile(join(root,dir,'assets/actual.js'),'/* synthetic asset bytes for packaging boundary */');
  }
  await run(root);
 } finally { await rm(root,{recursive:true,force:true}); }
}
test('both platform copies match every shared-build byte and one manifest digest',()=>fixture(async root=>{
 const ios=await verifyPackagedWeb(root,'ios'),android=await verifyPackagedWeb(root,'android');
 assert.equal(ios.files,2);assert.equal(ios.sha256,android.sha256);
}));
test('reject a stale native bundle even when its index still matches',()=>fixture(async root=>{
 await writeFile(join(root,'native/android/app/src/main/assets/public/assets/actual.js'),'old');
 await assert.rejects(verifyPackagedWeb(root,'android'),/differs/);
}));
test('missing packaged asset fails; illustrative placeholder cannot substitute for React',()=>fixture(async root=>{
 await rm(join(root,'native/ios/App/App/public/assets/actual.js'));
 await assert.rejects(verifyPackagedWeb(root,'ios'),/ENOENT/);
 await writeFile(join(root,'dist/index.html'),'<html><body>Coming soon</body></html>');
 await assert.rejects(verifyPackagedWeb(root,'ios'),/React build is missing/);
}));
test('symlinked source assets do not smuggle files into a package',()=>fixture(async root=>{
 await symlink(join(root,'dist/index.html'),join(root,'dist/assets/external'));
 await assert.rejects(verifyPackagedWeb(root,'ios'),/symlinks/);
}));
const device=(name,udid,isAvailable=true)=>({name,udid,isAvailable});
const a='AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',b='BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB';
test('select an available iPhone on the newest supported installed iOS runtime',()=>{
 assert.equal(selectIOSSimulator({devices:{
  'com.apple.CoreSimulator.SimRuntime.iOS-18-5':[device('iPhone 16',a)],
  'com.apple.CoreSimulator.SimRuntime.iOS-26-2':[device('iPhone 17',a)],
  'com.apple.CoreSimulator.SimRuntime.iOS-26-3':[device('iPad Pro',a),device('iPhone 17 Pro',b)],
 }}),b);
});
test('missing or unavailable simulator fails rather than passing with no tests',()=>{
 assert.throws(()=>selectIOSSimulator({devices:{'com.apple.CoreSimulator.SimRuntime.iOS-26-3':[device('iPhone 17',a,false)]}}),/No available iPhone/);
 assert.throws(()=>selectIOSSimulator({devices:{'com.apple.CoreSimulator.SimRuntime.iOS-18-5':[device('iPhone 16',a)]}}),/No available iPhone/);
});
test('checked-in app scheme identifies its actual native target and Swift pin',async()=>{
 const pbx=await readFile(new URL('../ios/App/App.xcodeproj/project.pbxproj',import.meta.url),'utf8');
 const scheme=await readFile(new URL('../ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme',import.meta.url),'utf8');
 const id=/BlueprintIdentifier="([A-F0-9]+)"/.exec(scheme)?.[1];
 assert.ok(id);assert.match(pbx,new RegExp(id+' /\\* App \\*/ = \\{\\s*isa = PBXNativeTarget;'));
 const pin=JSON.parse(await readFile(new URL('./Package.resolved',import.meta.url),'utf8')).pins[0];
 assert.equal(pin.state.version,'8.5.2');assert.match(pin.state.revision,/^[a-f0-9]{40}$/);
});

test('reject unreviewed extra native files, allowing only empty Capacitor Cordova shims',()=>fixture(async root=>{
 await writeFile(join(root,'native/ios/App/App/public/cordova.js'),'');
 await writeFile(join(root,'native/ios/App/App/public/cordova_plugins.js'),'');
 await verifyPackagedWeb(root,'ios');
 await writeFile(join(root,'native/ios/App/App/public/private.txt'),'unreviewed');
 await assert.rejects(verifyPackagedWeb(root,'ios'),/Unreviewed file/);
}));
