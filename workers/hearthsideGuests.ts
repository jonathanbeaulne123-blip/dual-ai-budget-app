import {GUEST_LIMITS,decodeGuestPrepare,guestAssert,guestChoice,guestId,guestOpaque,guestRecord,guestText} from '../src/hearthside/guestContracts.ts';
import {guestBearer,guestBoundedJson,resolveGuestAuthority} from './hearthsideGuestAuthority.ts';
import {guestCardStub,guestIndexStub,guestPrivateHeaders,guestRoomStub,type GuestEnv} from './hearthsideGuestTypes.ts';
export {HearthsideGuestRoom} from './hearthsideGuestRoom.ts';
export {HearthsideGuestCard} from './hearthsideGuestCard.ts';
export {HearthsideGuestIndex} from './hearthsideGuestIndex.ts';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:guestPrivateHeaders});
const safeCodes=new Set(['GUEST_INVALID_INPUT','GUEST_INPUT_TOO_LARGE','GUEST_INVALID_SCOPE','GUEST_UNAUTHENTICATED','GUEST_DISABLED','GUEST_PUBLICATION_DISABLED','GUEST_UNAVAILABLE','GUEST_SOURCE_UNAVAILABLE','GUEST_SOURCE_CHANGED','GUEST_MEDIA_UNAVAILABLE','GUEST_MEDIA_CHANGED','GUEST_SELECTION_TOO_LARGE','GUEST_ROSTER_CHANGED','GUEST_COMPOSITION_CHANGED','GUEST_ACCEPTANCE_CHANGED','GUEST_NOT_FOUND','GUEST_CLOSED','GUEST_APPROVAL_REQUIRED','GUEST_REVIEW_CLOSED','GUEST_CREATOR_REQUIRED','GUEST_ID_REUSED','GUEST_CARD_UNAVAILABLE','GUEST_CARD_FULL','GUEST_GRANT_REVOKED','GUEST_HOST_AWAY','GUEST_ROOM_FULL','GUEST_STREET_FULL','GUEST_HOST_INDEX_FULL','GUEST_SESSION_CHANGED','GUEST_TOY_PAUSE','GUEST_RESTORE_REQUIRED','GUEST_RESTORE_RETRY_REQUIRED','GUEST_ARCHIVE_CORRUPT','GUEST_ARCHIVE_CONFLICT','GUEST_SCOPE_MISMATCH']);
async function body(request:Request){guestAssert(request.headers.get('Content-Type')?.split(';')[0]==='application/json');return guestBoundedJson(new Response(request.body),GUEST_LIMITS.requestBytes);}
/** Return null for unrelated paths, so the host can retain its existing asset routing. */
export async function handleHearthsideGuests(request:Request,env:GuestEnv):Promise<Response|null>{
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/hearthside-guests/'))return null;
  if(env.HEARTHSIDE_GUESTS_ENABLED!=='true')return reply({code:'GUEST_DISABLED'},404);
  try{
    guestAssert(!url.search&&!url.hash&&['GET','POST'].includes(request.method));
    const match=/^\/api\/hearthside-guests\/development\/(street|cards|host|visit)(?:\/([^/]+))?(?:\/media\/([^/]+))?$/.exec(url.pathname);guestAssert(match,'GUEST_INVALID_SCOPE');const [,kind,target,assetId]=match,token=guestBearer(request);
    if(kind==='street'){
      guestAssert(!target&&!assetId);const auth=await resolveGuestAuthority(env,token,null);guestAssert(request.method==='GET');const index=guestIndexStub(env,`street/${auth.identity.subject}`),pointers=await index.grantPointers(auth.identity),cards=await index.ownCards(auth.identity);
      const visits=(await Promise.all(pointers.map(pointer=>guestRoomStub(env,pointer.publicationId).streetCard(auth.identity,token,pointer.publicationId,pointer.id)))).filter(Boolean);
      const ownCards=await Promise.all(cards.map(card=>guestCardStub(env,card.id).own(auth.identity,card.id)));return reply({version:1,visits,cards:ownCards});
    }
    if(kind==='cards'){
      guestAssert(!target&&!assetId&&request.method==='POST');const auth=await resolveGuestAuthority(env,token,null),r=guestRecord(await body(request),['operation','id','label']),operation=guestChoice(r.operation,['create','revoke']);const id=guestOpaque(r.id);
      if(operation==='create'){guestRecord(r,['operation','id','label']);return reply(await guestCardStub(env,id).create(auth.identity,id,guestText(r.label,60)));}
      guestRecord(r,['operation','id']);return reply(await guestCardStub(env,id).revoke(auth.identity,id));
    }
    if(kind==='host'){
      guestAssert(target&&/^HH-[A-Za-z0-9_-]{1,96}$/.test(target),'GUEST_INVALID_SCOPE');const auth=await resolveGuestAuthority(env,token,target);guestAssert(auth.hostScope,'GUEST_NOT_FOUND');
      if(assetId){guestAssert(request.method==='GET');const publicationId=guestOpaque(request.headers.get('X-Guest-Publication'));return await guestRoomStub(env,publicationId).reviewMedia(auth.hostScope,publicationId,guestId(assetId));}
      if(request.method==='GET'){const ids=await guestIndexStub(env,`host/${target}`).hostPublicationIds(auth.hostScope);const reviews=await Promise.all(ids.map(async id=>{try{return await guestRoomStub(env,id).hostReview(auth.hostScope!,id);}catch{return null;}}));return reply({version:1,publications:reviews.filter(Boolean),memberId:auth.hostScope.memberId});}
      const raw=await body(request),r=guestRecord(raw,['operation','input','id','publicationId','digest','sessionId','label']);const id=r.operation==='prepare'?decodeGuestPrepare(r.input).publicationId:guestOpaque(r.publicationId);return reply(await guestRoomStub(env,id).hostCommand(auth.hostScope,auth.principals,token,raw));
    }
    guestAssert(kind==='visit'&&target);const id=guestOpaque(target),auth=await resolveGuestAuthority(env,token,null);
    if(assetId){guestAssert(request.method==='GET');const grantId=guestOpaque(request.headers.get('X-Guest-Grant'));return await guestRoomStub(env,id).mediaFor(auth.identity,token,id,grantId,guestId(assetId));}
    guestAssert(request.method==='POST');return reply(await guestRoomStub(env,id).visit(auth.identity,token,id,await body(request)));
  }catch(error){const raw=error instanceof Error?error.message:'GUEST_UNAVAILABLE',code=safeCodes.has(raw)?raw:'GUEST_UNAVAILABLE';return reply({code},code==='GUEST_UNAUTHENTICATED'?401:['GUEST_NOT_FOUND','GUEST_CLOSED','GUEST_CARD_UNAVAILABLE','GUEST_HOST_AWAY','GUEST_SOURCE_UNAVAILABLE'].includes(code)?404:code==='GUEST_UNAVAILABLE'||code.includes('ARCHIVE')||code==='GUEST_RESTORE_REQUIRED'?503:code.startsWith('GUEST_INVALID')||code==='GUEST_INPUT_TOO_LARGE'?400:409);}
}
