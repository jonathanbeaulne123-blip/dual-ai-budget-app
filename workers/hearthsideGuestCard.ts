import {DurableObject} from 'cloudflare:workers';
import type {DurableObjectState} from '@cloudflare/workers-types';
import {GUEST_LIMITS,guestAssert,guestOpaque,guestText,type GuestIdentity} from '../src/hearthside/guestContracts.ts';
import {checkedGuestIdentity} from './hearthsideGuestAuthority.ts';
import {GuestArchive} from './hearthsideGuestArchive.ts';
import {guestIndexStub,guestRoomStub,type CallingCard,type GuestEnv,type OwnedCallingCard} from './hearthsideGuestTypes.ts';
const ownView=({subject:_subject,...card}:CallingCard):OwnedCallingCard=>card;
export class HearthsideGuestCard extends DurableObject<GuestEnv>{
  private archive:GuestArchive;
  constructor(ctx:DurableObjectState,env:GuestEnv){super(ctx,env);this.archive=new GuestArchive(this.ctx.storage,env.HEARTHSIDE_GUEST_ARCHIVE);}
  async create(identity:GuestIdentity,id:string,label:string){checkedGuestIdentity(identity);guestOpaque(id);guestText(label,60);const name=`card/${id}`;await this.archive.ready(name);let card=this.archive.get<CallingCard>('card');if(card)guestAssert(card.subject===identity.subject&&card.label===label&&!card.revoked,'GUEST_CARD_UNAVAILABLE');else{card={version:1,id,subject:identity.subject,label,redeemBefore:Date.now()+GUEST_LIMITS.cardMs,revoked:false};this.archive.put('card',card);}await this.archive.flush(name);checkedGuestIdentity(identity);await guestIndexStub(this.env,`street/${identity.subject}`).addCallingCard(identity,ownView(card));return ownView(card);}
  async own(identity:GuestIdentity,id:string){checkedGuestIdentity(identity);await this.archive.ready(`card/${guestOpaque(id)}`);const card=this.archive.get<CallingCard>('card');guestAssert(card?.subject===identity.subject,'GUEST_NOT_FOUND');return ownView(card);}
  async resolve(id:string,redeeming:boolean){await this.archive.ready(`card/${guestOpaque(id)}`);const card=this.archive.get<CallingCard>('card');guestAssert(card&&!card.revoked&&(!redeeming||card.redeemBefore>Date.now()),'GUEST_CARD_UNAVAILABLE');return card;}
  async register(id:string,subject:string,publicationId:string,grantId:string){await this.archive.ready(`card/${guestOpaque(id)}`);guestOpaque(publicationId);guestOpaque(grantId);const key=`grant/${grantId}`,old=this.archive.get<{publicationId:string;grantId:string}>(key),card=await this.resolve(id,!old);guestAssert(card.subject===subject,'GUEST_CARD_UNAVAILABLE');if(old)guestAssert(old.publicationId===publicationId,'GUEST_ID_REUSED');else{guestAssert(this.archive.list('grant/').length<200,'GUEST_CARD_FULL');this.archive.put(key,{publicationId,grantId});}await this.archive.flush(`card/${id}`);await this.resolve(id,false);}
  async revoke(identity:GuestIdentity,id:string){checkedGuestIdentity(identity);await this.archive.ready(`card/${guestOpaque(id)}`);let card=this.archive.get<CallingCard>('card');guestAssert(card?.subject===identity.subject,'GUEST_NOT_FOUND');card={...card,revoked:true};this.archive.put('card',card);await this.archive.flush(`card/${id}`);
    // Deny first. Cross-room cleanup is idempotent and resumes if acknowledgement is lost.
    for(const grant of this.archive.list<{publicationId:string;grantId:string}>('grant/'))await guestRoomStub(this.env,grant.publicationId).revokeByCard(id,identity.subject,grant.publicationId,grant.grantId);
    checkedGuestIdentity(identity);await guestIndexStub(this.env,`street/${identity.subject}`).addCallingCard(identity,ownView(card));return ownView(card);
  }
  async restoreGuestArchive(name:string,maxEntries=128){guestAssert(name.startsWith('card/'));return this.archive.restore(name,maxEntries);}
}
