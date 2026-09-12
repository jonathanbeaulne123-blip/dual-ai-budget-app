/** Fictional catalog; local command authority only. Run from repository root. */
import {createServer} from 'vite';
import assert from 'node:assert/strict';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{const core=await server.ssrLoadModule('/src/core/index.ts'),design=await server.ssrLoadModule('/src/core/kittyNestDesigns.ts'),capture=await server.ssrLoadModule('/src/ledgerSync/capture.ts'),protocol=await server.ssrLoadModule('/src/ledgerSync/protocol.ts'),authority=await server.ssrLoadModule('/src/ledgerSync/authority.ts');
 const h=core.catalogHousehold(),memberId='MEM-001',one=core.splitForSync(h,memberId),two=core.splitForSync(h,'MEM-002'),state={sequence:h.revision,shared:one.shared,personal:new Map([[memberId,one.personal],['MEM-002',two.personal]])},scope={environment:h.environment,householdId:h.householdId,memberId,subject:'synthetic-one',role:'owner',aclEpoch:1,expires:Date.now()+60000};
 const result=design.saveKittyNestDesign(h,{memberId,view:'personal',bankKey:'king',expectedRevision:0,name:'Private fictional King',glaze:'rose'}),command=await protocol.commandFromCapture(capture.capturedIntent(result.household),scope,crypto.randomUUID());assert.equal(command.kittyNestVersion,1);const accepted=await authority.prepareCommand(state,command,scope,()=>{});assert.equal(accepted.shared.kittyNestDesigns?.length,0);assert.equal(accepted.personal.kittyNestDesigns[0].name,'Private fictional King');
 const obsolete={...command,commandId:crypto.randomUUID()};delete obsolete.kittyNestVersion;await assert.rejects(authority.prepareCommand(state,obsolete,scope,()=>{}),/CLIENT_RELOAD_REQUIRED/);console.log(JSON.stringify({privateAuthorityAccepted:true,sharedDisclosure:false,oldWriterRejected:true}));
}finally{await server.close();}
