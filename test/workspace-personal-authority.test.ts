import {describe,expect,it,vi} from 'vitest';
vi.mock('cloudflare:workers',()=>({DurableObject:class{}}));
vi.mock('agents',()=>({Agent:class{},getAgentByName:vi.fn()}));
import {LedgerRoom} from '../workers/ledgerRoom.ts';
import {emptyPersonalLife,type PersonalLifeDocument,type PersonalLifeExperience} from '../src/hearthside/personalLifeContracts.ts';
import {decodeWorkspaceExperienceReference,personalWorkspaceExperienceContext,workspaceExperienceReference,type WorkspaceExperienceReference} from '../src/hearthside/workspaceContext.ts';
import type {Scope} from '../src/ledgerSync/protocol.ts';

const OWNER='MEM-001',OTHER='MEM-002';
const scope=(memberId=OWNER):Scope=>({environment:'development',householdId:'HH-WORKSPACE',memberId,subject:`synthetic:${memberId}`,role:'owner',aclEpoch:1,expires:Date.now()+60_000});
const privateExperience=(patch:Partial<PersonalLifeExperience>={}):PersonalLifeExperience=>({
  version:1,id:'PRIVATE-experience',revision:2,title:'A quiet train trip',intention:'See the coast slowly',state:'preparing',horizon:'season',createdBy:OWNER,wishId:null,livedOn:null,
  references:[{audience:'personal',kind:'task',id:'PRIVATE-task-canary'}],...patch,
});
const privateDocument=(experience=privateExperience()):PersonalLifeDocument=>({...emptyPersonalLife(OWNER),experiences:[experience],notes:[{
  version:1,id:'PRIVATE-note-canary',revision:1,authorId:OWNER,text:'Unrelated private note',room:'common',experienceId:experience.id,archived:false,
}]});
const sharedExperience={version:1 as const,id:'EXP-household',revision:3,title:'Our walk',intention:'Take the long way home',state:'dreaming' as const,horizon:'tonight' as const};

function roomFor(personalLife:PersonalLifeDocument=privateDocument()){
  const room:any=Object.create(LedgerRoom.prototype);
  room.serial=async(fn:()=>unknown)=>fn();
  room.archiveBarrier=vi.fn(async()=>{});
  room.hearthsideMember=vi.fn(()=>({household:{personalLife,hearthside:{experiences:[sharedExperience]}}}));
  return room;
}

describe('Workspace Personal experience authority',()=>{
  it('requires an explicit audience, owner and PersonalLife reader capability before any private read',async()=>{
    const personal=personalWorkspaceExperienceContext(privateExperience(),OWNER);
    expect(workspaceExperienceReference(personal)).toEqual({version:1,audience:'personal',ownerMemberId:OWNER,id:'PRIVATE-experience',personalLifeVersion:1});
    expect(workspaceExperienceReference(sharedExperience)).toEqual({version:1,audience:'household',ownerMemberId:null,id:'EXP-household',personalLifeVersion:null});
    expect(()=>decodeWorkspaceExperienceReference('PRIVATE-experience')).toThrow('INVALID_EXPERIENCE_REFERENCE');
    expect(()=>decodeWorkspaceExperienceReference({version:1,audience:'personal',ownerMemberId:OWNER,id:'PRIVATE-experience'})).toThrow('INVALID_EXPERIENCE_REFERENCE');
    const room=roomFor();
    await expect(room.workspaceExperience(scope(),{version:1,audience:'personal',ownerMemberId:OWNER,id:'PRIVATE-experience'} as never)).rejects.toThrow('INVALID_EXPERIENCE_REFERENCE');
    expect(room.hearthsideMember).not.toHaveBeenCalled();
  });

  it('resolves Personal and Household references independently and returns only their minimum projections',async()=>{
    const room=roomFor();
    const personalReference:WorkspaceExperienceReference={version:1,audience:'personal',ownerMemberId:OWNER,id:'PRIVATE-experience',personalLifeVersion:1};
    const personal=await room.workspaceExperience(scope(),personalReference);
    expect(personal).toEqual({version:2,audience:'personal',ownerMemberId:OWNER,id:'PRIVATE-experience',revision:2,title:'A quiet train trip',intention:'See the coast slowly',state:'preparing',horizon:'season',livedOn:null});
    expect(JSON.stringify(personal)).not.toContain('PRIVATE-task-canary');
    expect(JSON.stringify(personal)).not.toContain('PRIVATE-note-canary');
    expect(personal).not.toHaveProperty('references');
    expect(personal).not.toHaveProperty('wishId');

    const shared=await room.workspaceExperience(scope(),{version:1,audience:'household',ownerMemberId:null,id:'EXP-household',personalLifeVersion:null});
    expect(shared).toEqual(sharedExperience);
  });

  it('rejects cross-owner and audience-confused references without falling through to another collection',async()=>{
    const room=roomFor();
    await expect(room.workspaceExperience(scope(),{version:1,audience:'personal',ownerMemberId:OTHER,id:'PRIVATE-experience',personalLifeVersion:1})).rejects.toThrow('FORBIDDEN');
    expect(room.hearthsideMember).not.toHaveBeenCalled();
    await expect(room.workspaceExperience(scope(),{version:1,audience:'household',ownerMemberId:null,id:'PRIVATE-experience',personalLifeVersion:null})).rejects.toThrow('EXPERIENCE_CONTEXT_CHANGED');
    await expect(room.workspaceExperience(scope(OTHER),{version:1,audience:'personal',ownerMemberId:OTHER,id:'PRIVATE-experience',personalLifeVersion:1})).rejects.toThrow('PERSONAL_LIFE_OWNER_MISMATCH');
  });

  it('rechecks the accepted projection after the archive barrier',async()=>{
    const room=roomFor();let reads=0;
    room.hearthsideMember=vi.fn(()=>({household:{personalLife:privateDocument(privateExperience({revision:++reads===1?2:3})),hearthside:{experiences:[sharedExperience]}}}));
    await expect(room.workspaceExperience(scope(),{version:1,audience:'personal',ownerMemberId:OWNER,id:'PRIVATE-experience',personalLifeVersion:1})).rejects.toThrow('EXPERIENCE_CONTEXT_CHANGED');
    expect(room.archiveBarrier).toHaveBeenCalledOnce();
  });
});
