import type {DurableObjectId,R2Bucket} from '@cloudflare/workers-types';
import type {Scope} from '../src/ledgerSync/protocol.ts';
import type {GuestAcceptance,GuestArrangement,GuestIdentity,GuestInvitationReview,GuestPrepareInput,GuestPrincipal,GuestReview,GuestSourceCapture,GuestSourceProof,GuestStreetCard,GuestVisit} from '../src/hearthside/guestContracts.ts';
import type {GuestAuthorityEnv} from './hearthsideGuestAuthority.ts';
export type GuestPublication={version:1;id:string;householdId:string;owner:GuestPrincipal;principals:GuestPrincipal[];arrangement:GuestArrangement;proof:GuestSourceProof;digest:string;state:GuestReview['state'];approvals:GuestPrincipal[];acceptance:GuestAcceptance|null;preparedAt:number};
export type GuestGrant={version:1;id:string;publicationId:string;cardId:string;recipient:{subject:string;label:string};expiresAt:number;digest:string;principals:GuestPrincipal[];approvals:GuestPrincipal[];state:GuestInvitationReview['state']};
export type CallingCard={version:1;id:string;subject:string;label:string;redeemBefore:number;revoked:boolean};
export type OwnedCallingCard=Omit<CallingCard,'subject'>;
export interface GuestSourceRoom {
  captureGuestSource(scope:Scope,input:GuestPrepareInput):Promise<GuestSourceCapture>;
  validateGuestSource(scope:Scope,proof:GuestSourceProof,mode:'activation'|'visit'):Promise<boolean>;
  acceptVaultPublication(scope:Scope,reference:Omit<GuestAcceptance,'receiptId'|'acceptedAt'>):Promise<GuestAcceptance>;
}
export interface GuestRoomRPC {
  hostCommand(scope:Scope,principals:GuestPrincipal[],token:string,input:unknown):Promise<unknown>;
  hostReview(scope:Scope,id:string):Promise<{publication:GuestReview;invitations:GuestInvitationReview[]}>;
  streetCard(identity:GuestIdentity,token:string,id:string,grantId:string):Promise<GuestStreetCard|null>;
  visit(identity:GuestIdentity,token:string,id:string,input:unknown):Promise<GuestVisit|{left:true}>;
  mediaFor(identity:GuestIdentity,token:string,publicationId:string,grantId:string,id:string):Promise<Response>;
  reviewMedia(scope:Scope,publicationId:string,id:string):Promise<Response>;
  revokeByCard(cardId:string,subject:string,publicationId:string,grantId:string):Promise<void>;
}
export interface GuestIndexRPC {
  addCallingCard(identity:GuestIdentity,card:OwnedCallingCard):Promise<void>;
  ownCards(identity:GuestIdentity):Promise<OwnedCallingCard[]>;
  addGrant(subject:string,card:GuestStreetCard):Promise<void>;
  revokeGrant(subject:string,grantId:string):Promise<void>;
  grantPointers(identity:GuestIdentity):Promise<GuestStreetCard[]>;
  addHostPublication(scope:Scope,id:string):Promise<void>;
  hostPublicationIds(scope:Scope):Promise<string[]>;
}
export interface GuestCardRPC {
  create(identity:GuestIdentity,id:string,label:string):Promise<OwnedCallingCard>;
  own(identity:GuestIdentity,id:string):Promise<OwnedCallingCard>;
  resolve(id:string,redeeming:boolean):Promise<CallingCard>;
  register(id:string,subject:string,publicationId:string,grantId:string):Promise<void>;
  revoke(identity:GuestIdentity,id:string):Promise<OwnedCallingCard>;
}
export type GuestNamespace<T>={idFromName(name:string):DurableObjectId;get(id:DurableObjectId):T};
/** Optional bindings are deliberately assembled without activating deployment configuration. */
export type GuestEnv=GuestAuthorityEnv&{
  HEARTHSIDE_GUESTS_ENABLED?:string;HEARTHSIDE_GUEST_PUBLICATION?:string;
  HEARTHSIDE_GUEST_ARCHIVE?:R2Bucket;HEARTHSIDE_GUEST_MEDIA?:R2Bucket;
  HEARTHSIDE_GUEST_ROOMS?:GuestNamespace<GuestRoomRPC>;
  HEARTHSIDE_GUEST_INDEXES?:GuestNamespace<GuestIndexRPC>;
  HEARTHSIDE_GUEST_CARDS?:GuestNamespace<GuestCardRPC>;
  LEDGER_ROOMS?:GuestNamespace<GuestSourceRoom>;
};
export const guestPrivateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"};
export const guestRoomStub=(env:GuestEnv,id:string)=>{if(!env.HEARTHSIDE_GUEST_ROOMS)throw Error('GUEST_DISABLED');return env.HEARTHSIDE_GUEST_ROOMS.get(env.HEARTHSIDE_GUEST_ROOMS.idFromName(`development/room/${id}`));};
export const guestCardStub=(env:GuestEnv,id:string)=>{if(!env.HEARTHSIDE_GUEST_CARDS)throw Error('GUEST_DISABLED');return env.HEARTHSIDE_GUEST_CARDS.get(env.HEARTHSIDE_GUEST_CARDS.idFromName(`development/card/${id}`));};
export const guestIndexStub=(env:GuestEnv,name:string)=>{if(!env.HEARTHSIDE_GUEST_INDEXES)throw Error('GUEST_DISABLED');return env.HEARTHSIDE_GUEST_INDEXES.get(env.HEARTHSIDE_GUEST_INDEXES.idFromName(`development/${name}`));};
