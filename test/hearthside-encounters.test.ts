import {createEncounterDesign} from '../src/hearthside/encounterDesign.ts';
import {expect,it} from 'vitest';
import {ENCOUNTER_PACKS} from '../src/hearthside/encounterPacks.ts';
import {applyEncounterCommand,type EncounterAuthority} from '../src/hearthside/encounterService.ts';
import {decodeSharedEncounter,encounterCompositionDigest,type EncounterChoice,type EncounterRevealBinding} from '../src/hearthside/encounterContracts.ts';
import {encounterSceneMarkup,encounterStudioRecipe,encounterKeepsakeSvg} from '../src/hearthside/encounterKeepsake.ts';
const authority:EncounterAuthority={actorId:'A',memberIds:['A','B'],experienceIds:['EXISTING'],wardrobeIds:['real-item']};
const binding=(packId:string):EncounterRevealBinding=>({version:1,id:'reveal-one',encounterId:'encounter-one',packId,generation:3,digest:'a'.repeat(64)});
it('keeps all twelve authored three-stage packs interactive, distinct and deterministic',async()=>{
  expect(ENCOUNTER_PACKS).toHaveLength(12);expect(new Set(ENCOUNTER_PACKS.map(p=>p.mechanic)).size).toBe(12);const scenes=new Set<string>();
  for(const pack of ENCOUNTER_PACKS){
    let e=await applyEncounterCommand(null,{kind:'encounter.start',id:'encounter-one',packId:pack.id,participantMemberIds:['A','B'],experienceId:null},authority);
    const revealEvidence=binding(pack.id),a={...authority,revealEvidence};
    e=await applyEncounterCommand(e,{kind:'encounter.reveal',id:e.id,expectedRevision:e.revision,binding:revealEvidence},a);
    const choice=(memberId:string):EncounterChoice=>({memberId,revision:1,colourId:pack.make.colours[memberId==='A'?0:1]!.id,order:pack.make.items.map(i=>i.id),words:pack.mechanic==='incise'?`${memberId} room`:`${memberId} supplied these words`,drawing:[],wardrobeId:pack.mechanic==='mummers'?'real-item':null});
    e=await applyEncounterCommand(e,{kind:'encounter.choose',id:e.id,expectedChoiceRevision:0,choice:choice('A')},a);
    e=await applyEncounterCommand(e,{kind:'encounter.choose',id:e.id,expectedChoiceRevision:0,choice:choice('B')},{...a,actorId:'B'});
    const digest=await encounterCompositionDigest(e);e=await applyEncounterCommand(e,{kind:'encounter.keep',id:e.id,digest},a);e=await applyEncounterCommand(e,{kind:'encounter.keep',id:e.id,digest},{...a,actorId:'B'});
    expect(e.keptMemberIds).toEqual(['A','B']);const scene=encounterSceneMarkup(pack,e.choices);scenes.add(scene);
    expect(encounterSceneMarkup(pack,[{...e.choices[0]!,colourId:pack.make.colours[2]!.id},e.choices[1]!])).not.toBe(scene);
    const svg=encounterKeepsakeSvg(e,[{memberId:'A',revision:1,text:'<script>private words become chosen text</script>',objectId:pack.notice.objects[0]!.id,wardrobeId:null},{memberId:'B',revision:1,text:'A second account',objectId:pack.notice.objects[1]!.id,wardrobeId:null}],{A:'Alex',B:'Sam'},[{id:'real-item',stamp:{id:'real-stamp',anchor:'chest',kind:'scarf',color:'#aabbcc',size:.2,rotation:0}}]);
    expect(svg).not.toContain('<script>');expect(svg).toContain('&lt;script&gt;');expect(svg).toContain('A second account');
    if(pack.keep.medium==='studio'){const doc=await createEncounterDesign(e,{environment:'development',householdId:'HH-test',memberId:'A'},'2026-09-12T00:00:00.000Z');expect(doc.operations.length).toBeGreaterThan(1);const recipe=await encounterStudioRecipe(e);expect(recipe.kind).toBe('authored-encounter-recipe');expect(recipe.attributedChoices.map(c=>c.memberId)).toEqual(['A','B']);expect(recipe).not.toHaveProperty('strokes');expect(recipe.stamps.every(stamp=>stamp.color!==recipe.base)).toBe(true);}
    const changed=await applyEncounterCommand(e,{kind:'encounter.choose',id:e.id,expectedChoiceRevision:1,choice:{...choice('A'),revision:2,words:'Edited'}},a);expect(changed.keptMemberIds).toEqual([]);expect(await encounterCompositionDigest(changed)).not.toBe(digest);
    expect(e.outcomes).toEqual([]);expect(e.experienceId).toBeNull();
  }expect(scenes.size).toBe(12);
});
it('requires actual actor, current exact reveal, canonical refs and separate pause without moving responsibility',async()=>{
  const pack=ENCOUNTER_PACKS[0]!,revealEvidence=binding(pack.id),a={...authority,revealEvidence};
  let e=await applyEncounterCommand(null,{kind:'encounter.start',id:'encounter-one',packId:pack.id,participantMemberIds:['A','B'],experienceId:'EXISTING'},authority);
  expect(()=>decodeSharedEncounter({...e,answer:'private'})).toThrow();
  await expect(applyEncounterCommand(e,{kind:'encounter.reveal',id:e.id,expectedRevision:e.revision,binding:revealEvidence},authority)).rejects.toThrow('REVEAL_REQUIRED');
  e=await applyEncounterCommand(e,{kind:'encounter.reveal',id:e.id,expectedRevision:e.revision,binding:revealEvidence},a);
  const choice:EncounterChoice={memberId:'B',revision:1,colourId:pack.make.colours[0]!.id,order:pack.make.items.map(i=>i.id),words:'No spoof',drawing:[],wardrobeId:null};
  await expect(applyEncounterCommand(e,{kind:'encounter.choose',id:e.id,expectedChoiceRevision:0,choice},a)).rejects.toThrow();
  await expect(applyEncounterCommand(e,{kind:'encounter.choose',id:e.id,expectedChoiceRevision:0,choice:{...choice,memberId:'A'}},authority)).rejects.toThrow('REVEAL_REQUIRED');
  e=await applyEncounterCommand(e,{kind:'encounter.pause',id:e.id},a);expect(e.pausedMemberIds).toEqual(['A']);expect(e.choices).toEqual([]);
  await expect(applyEncounterCommand(e,{kind:'encounter.choose',id:e.id,expectedChoiceRevision:0,choice:{...choice,memberId:'A'}},a)).rejects.toThrow('ENCOUNTER_PAUSED');
  e=await applyEncounterCommand(e,{kind:'encounter.resume',id:e.id},a);expect(e.pausedMemberIds).toEqual([]);
  await expect(applyEncounterCommand(e,{kind:'encounter.link',id:e.id,expectedRevision:e.revision,experienceId:'NEW-BANK'},a)).rejects.toThrow('ENCOUNTER_CHANGED');
  await expect(applyEncounterCommand(e,{kind:'encounter.keep',id:e.id,digest:await encounterCompositionDigest(e)},{...a,memberIds:['A','replacement']})).rejects.toThrow('ENCOUNTER_SCOPE_CHANGED');
});
